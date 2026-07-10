#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(ROOT, 'apps/api/prisma/schema.prisma');
const POLICY_PATH = path.join(ROOT, 'infra/sql/production-rls-policies.sql');
const INITIAL_MIGRATION_PATH = path.join(ROOT, 'apps/api/prisma/migrations/0001_postgresql_initial/migration.sql');

export const REQUIRED_TABLES = ['deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts'];
export const REQUIRED_CONTEXT_SETTINGS = ['app.current_user_id','app.current_org_id','app.current_tenant_id','app.current_role','app.current_session_id'];
export const LEGACY_PERMISSIVE_POLICIES = [
  ['deals_app_access','deals'],
  ['audit_insert_only','audit_events'],
  ['audit_select_all','audit_events'],
  ['ledger_insert_only','ledger_entries'],
  ['ledger_select_all','ledger_entries'],
];

const FORBIDDEN_PATTERNS = [
  ['Prisma model table Deal', /(?:ALTER TABLE|ON)\s+(?:public\.)?"Deal"/],
  ['Prisma model table AuditEvent', /(?:ALTER TABLE|ON)\s+(?:public\.)?"AuditEvent"/],
  ['Prisma model table LedgerEntry', /(?:ALTER TABLE|ON)\s+(?:public\.)?"LedgerEntry"/],
  ['Prisma model table IntegrationEvent', /(?:ALTER TABLE|ON)\s+(?:public\.)?"IntegrationEvent"/],
  ['Prisma model table OutboxEntry', /(?:ALTER TABLE|ON)\s+(?:public\.)?"OutboxEntry"/],
  ['unsupported CREATE POLICY IF NOT EXISTS', /CREATE\s+POLICY\s+IF\s+NOT\s+EXISTS/i],
  ['broad FOR ALL policy', /CREATE\s+POLICY\s+[a-z0-9_]+\s+ON\s+[^;]+?\s+FOR\s+ALL\b/i],
  ['legacy set_app_context creation', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?set_app_context/i],
  ['session-level set_config', /set_config\([^;]+,\s*false\s*\)/is],
  ['embedded transaction BEGIN', /^\s*BEGIN\s*;/im],
  ['embedded transaction COMMIT', /^\s*COMMIT\s*;/im],
];
const APPEND_ONLY_TABLES = ['audit_events','ledger_entries','integration_events','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts'];

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function validateRlsArtifacts(schema, sql, initialMigration = '') {
  const errors = [];
  for (const table of REQUIRED_TABLES) {
    if (!schema.includes(`@@map("${table}")`)) errors.push(`Prisma schema is missing @@map("${table}")`);
    const escaped = escapeRegExp(table);
    if (!new RegExp(`ALTER\\s+TABLE\\s+public\\."${escaped}"\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i').test(sql)) errors.push(`${table}: ENABLE ROW LEVEL SECURITY missing`);
    if (!new RegExp(`ALTER\\s+TABLE\\s+public\\."${escaped}"\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i').test(sql)) errors.push(`${table}: FORCE ROW LEVEL SECURITY missing`);
  }
  for (const setting of REQUIRED_CONTEXT_SETTINGS) if (!sql.includes(`current_setting('${setting}', true)`)) errors.push(`RLS SQL is missing trusted context setting ${setting}`);
  for (const [label, pattern] of FORBIDDEN_PATTERNS) if (pattern.test(sql)) errors.push(`Forbidden construct: ${label}`);
  for (const table of APPEND_ONLY_TABLES) {
    const escaped = escapeRegExp(table);
    if (new RegExp(`CREATE\\s+POLICY\\s+[a-z0-9_]+\\s+ON\\s+public\\."${escaped}"\\s+FOR\\s+(?:UPDATE|DELETE|ALL)\\b`, 'i').test(sql)) errors.push(`${table}: append-only table has UPDATE, DELETE or ALL policy`);
  }
  for (const [policy, table] of LEGACY_PERMISSIVE_POLICIES) {
    const p = escapeRegExp(policy); const t = escapeRegExp(table);
    if (initialMigration && !new RegExp(`CREATE\\s+POLICY\\s+\"?${p}\"?\\s+ON\\s+\"?${t}\"?`, 'i').test(initialMigration)) errors.push(`Expected legacy migration policy not found: ${policy} on ${table}`);
    if (!new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+\"?${p}\"?\\s+ON\\s+public\\.\"${t}\"`, 'i').test(sql)) errors.push(`Legacy permissive policy is not removed: ${policy} on ${table}`);
  }
  const createdPolicies = [...sql.matchAll(/CREATE\s+POLICY\s+([a-z0-9_]+)/gi)].map((match) => match[1]);
  const duplicates = createdPolicies.filter((name, index) => createdPolicies.indexOf(name) !== index);
  if (duplicates.length) errors.push(`Duplicate policy names: ${[...new Set(duplicates)].join(', ')}`);
  for (const policy of createdPolicies) if (!new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${policy}\\s+ON`, 'i').test(sql)) errors.push(`${policy}: matching DROP POLICY IF EXISTS missing`);
  if (!/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.set_app_context\s*\(TEXT,\s*TEXT,\s*TEXT\)/i.test(sql)) errors.push('Legacy three-argument set_app_context is not explicitly removed');
  if (!/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.app_rls_context_ready\s*\(\s*\)/i.test(sql)) errors.push('Fail-closed app_rls_context_ready function is missing');
  if (!/SECURITY\s+INVOKER/i.test(sql)) errors.push('Deal visibility helper must remain SECURITY INVOKER');
  return { valid: errors.length === 0, errors, policies: createdPolicies.length };
}

export async function validateRlsFiles() {
  const [schema, sql, initialMigration] = await Promise.all([readFile(SCHEMA_PATH,'utf8'), readFile(POLICY_PATH,'utf8'), readFile(INITIAL_MIGRATION_PATH,'utf8')]);
  return validateRlsArtifacts(schema, sql, initialMigration);
}
async function cli() { const result = await validateRlsFiles(); process.stdout.write(`${JSON.stringify(result,null,2)}\n`); if (!result.valid) process.exitCode = 1; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });

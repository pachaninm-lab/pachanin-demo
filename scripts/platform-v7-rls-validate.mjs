#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SCHEMA_PATH = path.join(ROOT, 'apps/api/prisma/schema.prisma');
const POLICY_PATH = path.join(ROOT, 'infra/sql/production-rls-policies.sql');

export const REQUIRED_TABLES = [
  'deals',
  'organizations',
  'audit_events',
  'ledger_entries',
  'integration_events',
  'outbox_entries',
  'deal_workspace_runtime_snapshots',
  'deal_workspace_runtime_transaction_attempts',
];

export const REQUIRED_CONTEXT_SETTINGS = [
  'app.current_user_id',
  'app.current_org_id',
  'app.current_tenant_id',
  'app.current_role',
  'app.current_session_id',
];

const FORBIDDEN_PATTERNS = [
  ['Prisma model table Deal', /(?:ALTER TABLE|ON)\s+(?:public\.)?"Deal"/],
  ['Prisma model table AuditEvent', /(?:ALTER TABLE|ON)\s+(?:public\.)?"AuditEvent"/],
  ['Prisma model table LedgerEntry', /(?:ALTER TABLE|ON)\s+(?:public\.)?"LedgerEntry"/],
  ['Prisma model table IntegrationEvent', /(?:ALTER TABLE|ON)\s+(?:public\.)?"IntegrationEvent"/],
  ['Prisma model table OutboxEntry', /(?:ALTER TABLE|ON)\s+(?:public\.)?"OutboxEntry"/],
  ['unsupported CREATE POLICY IF NOT EXISTS', /CREATE\s+POLICY\s+IF\s+NOT\s+EXISTS/i],
  ['legacy set_app_context creation', /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?set_app_context/i],
  ['session-level set_config', /set_config\([^;]+,\s*false\s*\)/is],
  ['embedded transaction BEGIN', /^\s*BEGIN\s*;/im],
  ['embedded transaction COMMIT', /^\s*COMMIT\s*;/im],
];

export function validateRlsArtifacts(schema, sql) {
  const errors = [];

  for (const table of REQUIRED_TABLES) {
    if (!schema.includes(`@@map("${table}")`)) {
      errors.push(`Prisma schema is missing @@map(\"${table}\")`);
    }

    const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const enable = new RegExp(`ALTER\\s+TABLE\\s+public\\.\"${escaped}\"\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
    const force = new RegExp(`ALTER\\s+TABLE\\s+public\\.\"${escaped}\"\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
    if (!enable.test(sql)) errors.push(`${table}: ENABLE ROW LEVEL SECURITY missing`);
    if (!force.test(sql)) errors.push(`${table}: FORCE ROW LEVEL SECURITY missing`);
  }

  for (const setting of REQUIRED_CONTEXT_SETTINGS) {
    if (!sql.includes(`current_setting('${setting}', true)`)) {
      errors.push(`RLS SQL is missing trusted context setting ${setting}`);
    }
  }

  for (const [label, pattern] of FORBIDDEN_PATTERNS) {
    if (pattern.test(sql)) errors.push(`Forbidden construct: ${label}`);
  }

  const createdPolicies = [...sql.matchAll(/CREATE\s+POLICY\s+([a-z0-9_]+)/gi)].map((match) => match[1]);
  const duplicatePolicies = createdPolicies.filter((name, index) => createdPolicies.indexOf(name) !== index);
  if (duplicatePolicies.length > 0) {
    errors.push(`Duplicate policy names: ${[...new Set(duplicatePolicies)].join(', ')}`);
  }

  for (const policy of createdPolicies) {
    const drop = new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${policy}\\s+ON`, 'i');
    if (!drop.test(sql)) errors.push(`${policy}: matching DROP POLICY IF EXISTS missing`);
  }

  if (!/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.set_app_context\s*\(TEXT,\s*TEXT,\s*TEXT\)/i.test(sql)) {
    errors.push('Legacy three-argument set_app_context is not explicitly removed');
  }

  return { valid: errors.length === 0, errors, policies: createdPolicies.length };
}

export async function validateRlsFiles() {
  const [schema, sql] = await Promise.all([
    readFile(SCHEMA_PATH, 'utf8'),
    readFile(POLICY_PATH, 'utf8'),
  ]);
  return validateRlsArtifacts(schema, sql);
}

async function cli() {
  const result = await validateRlsFiles();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

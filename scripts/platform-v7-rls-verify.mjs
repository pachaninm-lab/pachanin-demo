#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const schemaPath = path.join(root, 'apps/api/prisma/schema.prisma');
const policyPath = path.join(root, 'infra/sql/production-rls-policies.sql');
const rollbackPath = path.join(root, 'infra/sql/production-rls-policies.rollback.sql');

const schema = fs.readFileSync(schemaPath, 'utf8');
const policy = fs.readFileSync(policyPath, 'utf8');
const rollback = fs.readFileSync(rollbackPath, 'utf8');

const errors = [];
const requireText = (source, text, label) => {
  if (!source.includes(text)) errors.push(`${label}: missing ${text}`);
};
const forbidText = (source, text, label) => {
  if (source.includes(text)) errors.push(`${label}: forbidden ${text}`);
};

const physicalTables = [
  'deals',
  'organizations',
  'audit_events',
  'ledger_entries',
  'integration_events',
  'outbox_entries',
  'deal_workspace_runtime_snapshots',
  'deal_workspace_runtime_transaction_attempts',
];

for (const table of physicalTables) {
  requireText(schema, `@@map("${table}")`, 'Prisma schema');
  requireText(policy, `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`, 'RLS policy');
  requireText(policy, `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`, 'RLS policy');
  requireText(rollback, `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`, 'RLS rollback');
}

for (const modelTable of ['"Deal"', '"AuditEvent"', '"LedgerEntry"', '"IntegrationEvent"', '"OutboxEntry"']) {
  forbidText(policy, modelTable, 'RLS policy physical table alignment');
}

for (const unsafe of [
  'CREATE POLICY IF NOT EXISTS',
  '$executeRawUnsafe',
  "set_config('app.current_role', COALESCE(p_role, ''), false)",
  'CREATE OR REPLACE FUNCTION set_app_context',
]) {
  forbidText(policy, unsafe, 'RLS policy safety');
}

for (const contextKey of [
  'app.current_user_id',
  'app.current_org_id',
  'app.current_tenant_id',
  'app.current_role',
]) {
  requireText(policy, contextKey, 'RLS policy trusted context');
}

requireText(policy, "current_user = 'app_service'", 'RLS service principal');
forbidText(policy, "IN ('ADMIN', 'ACCOUNTING'", 'RLS accounting authority');
requireText(policy, 'CREATE POLICY ledger_entries_update_denied', 'Immutable ledger');
requireText(policy, 'CREATE POLICY audit_events_update_denied', 'Append-only audit');
requireText(policy, 'CREATE POLICY runtime_attempts_update_denied', 'Append-only runtime attempts');

for (const destructive of ['DROP TABLE', 'DROP COLUMN', 'TRUNCATE', 'DELETE FROM']) {
  forbidText(rollback, destructive, 'RLS rollback');
}

const policyNames = [...policy.matchAll(/CREATE POLICY\s+([a-z0-9_]+)/gi)].map((match) => match[1]);
for (const name of policyNames) {
  requireText(rollback, `DROP POLICY IF EXISTS ${name}`, 'RLS rollback coverage');
}

if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  physicalTables,
  policyCount: policyNames.length,
  productionDatabaseModified: false,
}, null, 2));

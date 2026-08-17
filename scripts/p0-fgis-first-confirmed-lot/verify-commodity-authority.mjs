#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const migrationPath = resolve(
  root,
  'apps/api/prisma/migrations/20260802210000_fgis_commodity_authority/migration.sql',
);
const sql = readFileSync(migrationPath, 'utf8');
const failures = [];

function requireText(label, needle) {
  if (!sql.includes(needle)) failures.push(`${label}: missing ${JSON.stringify(needle)}`);
}

function forbid(label, pattern) {
  if (pattern.test(sql)) failures.push(`${label}: forbidden pattern ${pattern}`);
}

for (const table of [
  'organization_connections',
  'sync_runs',
  'party_snapshots',
  'party_current',
  'reservations',
  'lot_passports',
  'reconciliation_cases',
]) {
  requireText(`table ${table}`, `CREATE TABLE fgis_commodity.${table}`);
  requireText(`RLS ${table}`, `ALTER TABLE fgis_commodity.%I ENABLE ROW LEVEL SECURITY`);
  requireText(`FORCE RLS ${table}`, `ALTER TABLE fgis_commodity.%I FORCE ROW LEVEL SECURITY`);
}

requireText('tenant authority', "current_setting('app.tenant_id', true)");
requireText('organization authority', "current_setting('app.organization_id', true)");
requireText('volume precision', 'numeric(24,6)');
requireText('snapshot immutability', 'fgis_party_snapshots_immutable');
requireText('published passport immutability', 'fgis_published_passports_immutable');
requireText('reservation idempotency', 'fgis_commodity_reservation_idempotency');
requireText('active sync uniqueness', 'fgis_commodity_sync_one_active');
requireText('cross-scope foreign keys', 'tenant_id, organization_id');
requireText('no direct runtime DML', 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE');
requireText('no raw XML guard', 'fgis_commodity_snapshot_no_raw_xml');

forbid('no float volumes', /\b(real|double precision|float\d*)\b/i);
forbid('no provider endpoint', /https?:\/\//i);
forbid('no credential bytes', /BEGIN (RSA )?PRIVATE KEY/i);
forbid('no live claim', /LIVE_CONFIRMED\s*=\s*1|CONFIRMED_LIVE|status\s*=\s*['"]LIVE['"]/i);
forbid('no destructive migration', /\b(DROP\s+(TABLE|SCHEMA)|TRUNCATE\s+TABLE)\b/i);
forbid('no quarantine removal', /DROP\s+TRIGGER\s+auction_lots_fgis_verified_guard/i);

const evidence = {
  schemaVersion: 'p0.2-2a-commodity-authority-verifier.v1',
  migration: '20260802210000_fgis_commodity_authority',
  checks: {
    requiredTables: 7,
    forceRls: true,
    numericVolumes: true,
    immutableSnapshots: true,
    immutablePublishedPassports: true,
    directRuntimeDmlDenied: true,
    providerTransportAdded: false,
    liveClaimAdded: false,
  },
  failures,
};

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length > 0) process.exit(1);

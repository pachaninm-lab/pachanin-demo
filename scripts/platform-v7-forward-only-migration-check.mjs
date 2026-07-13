#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'apps/api/prisma/migrations');
const ACCEPTED_BASELINE = '20260710150000_persistent_identity_sessions';

// Lossless widening conversions are forward-safe: every value representable in
// the old type is representable in the new one (Int → BIGINT, Int/Float →
// DECIMAL/NUMERIC). Narrowing or lossy rewrites remain forbidden.
const LOSSLESS_WIDENING_TYPES = /^(BIGINT|DECIMAL(\s*\(\s*\d+\s*,\s*\d+\s*\))?|NUMERIC(\s*\(\s*\d+\s*,\s*\d+\s*\))?)$/i;

function controlledUtcTimestampRewrite(migration, sql, target) {
  // IR-10.2 introduces these columns/tables in the immediately preceding,
  // unmerged additive migration. Prisma's DateTime representation is
  // TIMESTAMP(3), so the follow-up normalizes only newly introduced values to
  // UTC with an explicit USING clause before this slice can reach main.
  // Keep the exception exact; future timestamp rewrites remain forbidden.
  return migration === '20260713102000_logistics_postgresql_authority'
    && /^TIMESTAMP\s*\(\s*3\s*\)$/i.test(target)
    && /AT\s+TIME\s+ZONE\s+'UTC'/i.test(sql);
}

function findUnsafeTypeRewrites(migration, sql) {
  const unsafe = [];
  const matcher = /\bALTER\s+COLUMN\s+"?[\w]+"?\s+TYPE\s+([A-Za-z]+(?:\s*\(\s*\d+(?:\s*,\s*\d+)?\s*\))?)/gi;
  for (const match of sql.matchAll(matcher)) {
    const target = match[1].trim();
    if (!LOSSLESS_WIDENING_TYPES.test(target)
      && !controlledUtcTimestampRewrite(migration, sql, target)) {
      unsafe.push(target);
    }
  }
  return unsafe;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findUnsafeNotNullChanges(sql) {
  const unsafe = [];
  const matcher = /\bALTER\s+TABLE\s+(?:public\.)?"?([\w]+)"?[\s\S]{0,200}?\bALTER\s+COLUMN\s+"?([\w]+)"?\s+SET\s+NOT\s+NULL\b/gi;
  for (const match of sql.matchAll(matcher)) {
    const table = escapeRegExp(match[1]);
    const column = escapeRegExp(match[2]);
    const addedInMigration = new RegExp(
      `\\bADD\\s+COLUMN\\s+IF\\s+NOT\\s+EXISTS\\s+"?${column}"?`,
      'i',
    ).test(sql);
    const backfilled = new RegExp(
      `\\bUPDATE\\s+(?:public\\.)?"?${table}"?[\\s\\S]{0,500}?\\bSET\\s+"?${column}"?\\s*=`,
      'i',
    ).test(sql);
    const guarded = new RegExp(
      `\\bIF\\s+EXISTS\\s*\\([\\s\\S]{0,300}?\\bFROM\\s+(?:public\\.)?"?${table}"?[\\s\\S]{0,200}?"?${column}"?\\s+IS\\s+NULL`,
      'i',
    ).test(sql);
    if (!addedInMigration || !backfilled || !guarded) {
      unsafe.push(`${match[1]}.${match[2]}`);
    }
  }
  return unsafe;
}

const destructivePatterns = [
  { name: 'DROP TABLE', pattern: /\bDROP\s+TABLE\b/i },
  { name: 'DROP COLUMN', pattern: /\bDROP\s+COLUMN\b/i },
  { name: 'TRUNCATE', pattern: /\bTRUNCATE\b/i },
  { name: 'mass DELETE', pattern: /\bDELETE\s+FROM\b/i },
  { name: 'column rename', pattern: /\bRENAME\s+COLUMN\b/i },
  { name: 'table rename', pattern: /\bRENAME\s+TO\b/i },
  { name: 'RLS disable', pattern: /\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i },
  { name: 'FORCE RLS removal', pattern: /\bNO\s+FORCE\s+ROW\s+LEVEL\s+SECURITY\b/i },
];

function withoutComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*--.*$/gm, '');
}

const entries = (await readdir(MIGRATIONS_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (!entries.includes(ACCEPTED_BASELINE)) {
  throw new Error(`Accepted migration baseline is missing: ${ACCEPTED_BASELINE}`);
}

const newMigrations = entries.filter((name) => name > ACCEPTED_BASELINE);
const violations = [];

for (const migration of newMigrations) {
  const file = path.join(MIGRATIONS_DIR, migration, 'migration.sql');
  const sql = withoutComments(await readFile(file, 'utf8'));
  for (const rule of destructivePatterns) {
    if (rule.pattern.test(sql)) violations.push(`${migration}: ${rule.name}`);
  }
  for (const target of findUnsafeTypeRewrites(migration, sql)) {
    violations.push(`${migration}: type rewrite to ${target}`);
  }
  for (const target of findUnsafeNotNullChanges(sql)) {
    violations.push(`${migration}: unguarded SET NOT NULL on ${target}`);
  }
}

const rollbackScript = await readFile(
  path.join(ROOT, 'scripts/platform-v7-rls-rollback-rehearsal.sh'),
  'utf8',
);
const executableRollback = withoutComments(rollbackScript);
for (const rule of destructivePatterns.filter((item) => item.name.includes('RLS'))) {
  if (rule.pattern.test(executableRollback)) {
    violations.push(`platform-v7-rls-rollback-rehearsal.sh: ${rule.name}`);
  }
}

if (violations.length > 0) {
  console.error('Forward-only database safety gate failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('Use an additive migration and application rollback. Database recovery requires backup/PITR rehearsal.');
  process.exit(1);
}

console.log(JSON.stringify({
  forwardOnlyMigrationGate: 'passed',
  acceptedBaseline: ACCEPTED_BASELINE,
  checkedMigrations: newMigrations,
  rollbackScript: 'safe-restore-only',
}));

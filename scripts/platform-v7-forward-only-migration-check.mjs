#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'apps/api/prisma/migrations');
const ACCEPTED_BASELINE = '20260710150000_persistent_identity_sessions';

const destructivePatterns = [
  { name: 'DROP TABLE', pattern: /\bDROP\s+TABLE\b/i },
  { name: 'DROP COLUMN', pattern: /\bDROP\s+COLUMN\b/i },
  { name: 'TRUNCATE', pattern: /\bTRUNCATE\b/i },
  { name: 'mass DELETE', pattern: /\bDELETE\s+FROM\b/i },
  { name: 'column rename', pattern: /\bRENAME\s+COLUMN\b/i },
  { name: 'table rename', pattern: /\bRENAME\s+TO\b/i },
  { name: 'type rewrite', pattern: /\bALTER\s+COLUMN\b[\s\S]{0,160}\bTYPE\b/i },
  { name: 'SET NOT NULL', pattern: /\bALTER\s+COLUMN\b[\s\S]{0,160}\bSET\s+NOT\s+NULL\b/i },
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

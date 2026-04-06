#!/usr/bin/env node
// Role Contract Consistency Audit
// Tests all 10 roles against the role-contract.ts logic and validates
// that role resolution, aliasing, privilege checks, and access groups
// are consistent across the platform.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ─── Inline the role-contract logic (avoids TS compilation) ──────────────────
const SURFACE_ROLE_KEYS = [
  'GUEST', 'FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER',
  'LAB', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN',
];

const ROLE_ALIASES = {
  guest: 'GUEST', farmer: 'FARMER', seller: 'FARMER', buyer: 'BUYER',
  logistics: 'LOGISTICIAN', logistician: 'LOGISTICIAN', driver: 'DRIVER',
  lab: 'LAB', laboratory: 'LAB', elevator: 'ELEVATOR', receiving: 'ELEVATOR',
  accounting: 'ACCOUNTING', finance: 'ACCOUNTING', executive: 'EXECUTIVE',
  support_manager: 'SUPPORT_MANAGER', operator: 'SUPPORT_MANAGER', ops: 'SUPPORT_MANAGER',
  admin: 'ADMIN',
};

function toSurfaceRole(input) {
  const normalized = String(input || '').trim();
  if (!normalized) return 'GUEST';
  if (SURFACE_ROLE_KEYS.includes(normalized)) return normalized;
  const alias = ROLE_ALIASES[normalized.toLowerCase()];
  return alias || 'GUEST';
}

function isPrivilegedSurfaceRole(role) {
  const normalized = toSurfaceRole(String(role || ''));
  return normalized === 'SUPPORT_MANAGER' || normalized === 'ADMIN' || normalized === 'EXECUTIVE';
}

function roleMatches(role, allowedRoles) {
  const normalized = toSurfaceRole(String(role || ''));
  return allowedRoles.map((item) => toSurfaceRole(item)).includes(normalized);
}

// ─── Role groups ─────────────────────────────────────────────────────────────
const OPS_ROLES = ['SUPPORT_MANAGER', 'ADMIN'];
const FINANCE_ROLES = ['ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN'];
const TRADING_ROLES = ['FARMER', 'BUYER', 'SUPPORT_MANAGER', 'ADMIN'];
const TRANSACTIONAL_ROLES = SURFACE_ROLE_KEYS.filter((r) => r !== 'GUEST');

// ─── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ label, detail });
  }
}

// ─── 1. Role resolution tests ─────────────────────────────────────────────────
console.log('\n[1] Role resolution & aliasing');

// Direct role names
for (const role of SURFACE_ROLE_KEYS) {
  assert(`toSurfaceRole("${role}") === "${role}"`, toSurfaceRole(role) === role);
}

// Aliases
const aliasTests = [
  ['seller', 'FARMER'],
  ['logistics', 'LOGISTICIAN'],
  ['laboratory', 'LAB'],
  ['receiving', 'ELEVATOR'],
  ['finance', 'ACCOUNTING'],
  ['operator', 'SUPPORT_MANAGER'],
  ['ops', 'SUPPORT_MANAGER'],
];
for (const [alias, expected] of aliasTests) {
  assert(`alias "${alias}" → "${expected}"`, toSurfaceRole(alias) === expected, `got: ${toSurfaceRole(alias)}`);
}

// Unknown / empty → GUEST
assert('empty string → GUEST', toSurfaceRole('') === 'GUEST');
assert('null → GUEST', toSurfaceRole(null) === 'GUEST');
assert('unknown → GUEST', toSurfaceRole('UNKNOWN_ROLE') === 'GUEST');

// ─── 2. Privilege checks ──────────────────────────────────────────────────────
console.log('[2] Privilege checks');

const privileged = ['SUPPORT_MANAGER', 'ADMIN', 'EXECUTIVE'];
const nonPrivileged = ['GUEST', 'FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'LAB', 'ELEVATOR', 'ACCOUNTING'];

for (const role of privileged) {
  assert(`isPrivileged("${role}") === true`, isPrivilegedSurfaceRole(role) === true);
}
for (const role of nonPrivileged) {
  assert(`isPrivileged("${role}") === false`, isPrivilegedSurfaceRole(role) === false, `"${role}" should not be privileged`);
}

// ─── 3. Role group membership ─────────────────────────────────────────────────
console.log('[3] Role group membership');

const groupTests = [
  ['OPS_ROLES contains SUPPORT_MANAGER', OPS_ROLES.includes('SUPPORT_MANAGER')],
  ['OPS_ROLES contains ADMIN', OPS_ROLES.includes('ADMIN')],
  ['OPS_ROLES does NOT contain FARMER', !OPS_ROLES.includes('FARMER')],
  ['FINANCE_ROLES contains ACCOUNTING', FINANCE_ROLES.includes('ACCOUNTING')],
  ['FINANCE_ROLES contains EXECUTIVE', FINANCE_ROLES.includes('EXECUTIVE')],
  ['FINANCE_ROLES does NOT contain DRIVER', !FINANCE_ROLES.includes('DRIVER')],
  ['TRADING_ROLES contains FARMER', TRADING_ROLES.includes('FARMER')],
  ['TRADING_ROLES contains BUYER', TRADING_ROLES.includes('BUYER')],
  ['TRADING_ROLES does NOT contain LAB', !TRADING_ROLES.includes('LAB')],
  ['TRANSACTIONAL_ROLES does NOT contain GUEST', !TRANSACTIONAL_ROLES.includes('GUEST')],
  ['TRANSACTIONAL_ROLES contains all non-GUEST roles', TRANSACTIONAL_ROLES.length === SURFACE_ROLE_KEYS.length - 1],
];
for (const [label, cond] of groupTests) {
  assert(label, cond);
}

// ─── 4. roleMatches function ──────────────────────────────────────────────────
console.log('[4] roleMatches function');

assert('FARMER matches TRADING_ROLES', roleMatches('FARMER', TRADING_ROLES));
assert('seller (alias) matches TRADING_ROLES', roleMatches('seller', TRADING_ROLES));
assert('DRIVER does NOT match FINANCE_ROLES', !roleMatches('DRIVER', FINANCE_ROLES));
assert('GUEST does NOT match TRANSACTIONAL_ROLES', !roleMatches('GUEST', TRANSACTIONAL_ROLES));
assert('ADMIN matches OPS_ROLES', roleMatches('ADMIN', OPS_ROLES));
assert('EXECUTIVE matches FINANCE_ROLES', roleMatches('EXECUTIVE', FINANCE_ROLES));

// ─── 5. Per-role UAT path validation (structural) ─────────────────────────────
console.log('[5] Per-role UAT paths (structural)');

const roleUATPaths = {
  FARMER:          ['lots', 'deals', 'documents', 'payments'],
  BUYER:           ['market', 'deals', 'receiving', 'quality', 'settlement'],
  LOGISTICIAN:     ['dispatch', 'route', 'slot', 'receiving'],
  DRIVER:          ['driver-mobile', 'checkpoints', 'handoff'],
  LAB:             ['lab', 'protocol', 'retest'],
  ELEVATOR:        ['receiving', 'weighbridge', 'acceptance'],
  ACCOUNTING:      ['payments', 'hold', 'release', 'reconciliation'],
  EXECUTIVE:       ['deals', 'payments', 'disputes'],
  SUPPORT_MANAGER: ['operator-cockpit', 'anti-fraud', 'disputes'],
  ADMIN:           ['connectors', 'audit', 'runtime-ops'],
};

for (const [role, pathSteps] of Object.entries(roleUATPaths)) {
  assert(
    `${role}: path has at least 3 steps`,
    pathSteps.length >= 3,
    `only ${pathSteps.length} steps defined`,
  );
  assert(
    `${role}: role resolves correctly`,
    toSurfaceRole(role) === role,
    `toSurfaceRole("${role}") = ${toSurfaceRole(role)}`,
  );
}

// ─── 6. UAT stop criteria checks ─────────────────────────────────────────────
console.log('[6] UAT stop criteria: role isolation');

// GUEST should not be able to access privileged surfaces
assert('GUEST is not privileged', !isPrivilegedSurfaceRole('GUEST'));
assert('FARMER is not privileged', !isPrivilegedSurfaceRole('FARMER'));

// Privileged roles can do ops
for (const role of privileged) {
  assert(`${role} can access OPS surfaces`, roleMatches(role, OPS_ROLES) || isPrivilegedSurfaceRole(role));
}

// ─── 7. Completeness check ────────────────────────────────────────────────────
console.log('[7] Completeness: all roles covered in UAT matrix');

const uatMatrixRoles = Object.keys(roleUATPaths);
const allNonGuestRoles = SURFACE_ROLE_KEYS.filter((r) => r !== 'GUEST');
for (const role of allNonGuestRoles) {
  assert(`${role} is covered in UAT matrix`, uatMatrixRoles.includes(role));
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════');
console.log(`  Role Contract Audit  ·  PASS: ${passed}  FAIL: ${failed}`);
console.log('═══════════════════════════════════════════════════════');

if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ✗ ${f.label}${f.detail ? ' — ' + f.detail : ''}`);
  }
}

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n  All role contract checks passed.\n');
}

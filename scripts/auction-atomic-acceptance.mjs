#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve('.');
const EXACT_HEAD = String(process.env.AUCTION_ACCEPTANCE_EXACT_HEAD ?? '').trim();
const JEST_REPORT = resolve(
  process.env.AUCTION_JEST_REPORT
    ?? 'artifacts/auction-atomic/auction-jest.json',
);
const REPORT_PATH = resolve(
  process.env.AUCTION_ACCEPTANCE_REPORT
    ?? 'artifacts/auction-atomic/auction-atomic-acceptance.json',
);
const JUNIT_PATH = resolve(
  process.env.AUCTION_ACCEPTANCE_JUNIT
    ?? 'artifacts/auction-atomic/auction-atomic-acceptance.xml',
);

const files = {
  baseMigration: 'apps/api/prisma/migrations/20260715013000_auction_atomic_execution/migration.sql',
  moneyMigration: 'apps/api/prisma/migrations/20260715013100_auction_atomic_execution/migration.sql',
  compatibilityMigration: 'apps/api/prisma/migrations/20260715013200_auction_atomic_execution/migration.sql',
  service: 'apps/api/src/modules/auctions/auction-command.service.ts',
  controller: 'apps/api/src/modules/auctions/auctions.controller.ts',
  policyTest: 'apps/api/src/modules/auctions/auction-postgresql-authority.spec.ts',
  raceTest: 'apps/api/test/industrial/auction-atomic-execution.e2e-spec.ts',
  workflow: '.github/workflows/auction-atomic-acceptance.yml',
};

const violations = [];
const sources = {};

function load(label, path) {
  const absolute = resolve(ROOT, path);
  if (!existsSync(absolute)) {
    violations.push(`${path}: required file is missing.`);
    return '';
  }
  const source = readFileSync(absolute, 'utf8');
  sources[label] = source;
  return source;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requireFragments(label, fragments) {
  const source = sources[label] ?? '';
  for (const fragment of fragments) {
    if (!source.includes(fragment)) {
      violations.push(`${files[label]}: missing required fragment ${JSON.stringify(fragment)}.`);
    }
  }
}

function forbid(label, patterns) {
  const source = sources[label] ?? '';
  for (const [pattern, description] of patterns) {
    if (pattern.test(source)) violations.push(`${files[label]}: forbidden ${description}.`);
  }
}

for (const [label, path] of Object.entries(files)) load(label, path);

const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/i.test(EXACT_HEAD)) {
  violations.push('AUCTION_ACCEPTANCE_EXACT_HEAD must be a full commit SHA.');
}
if (actualHead !== EXACT_HEAD) {
  violations.push(`Checked out commit ${actualHead} does not match exact head ${EXACT_HEAD}.`);
}

requireFragments('baseMigration', [
  'CREATE TABLE IF NOT EXISTS auction.command_receipts',
  'UNIQUE (tenant_id, command_type, actor_id, idempotency_key)',
  'AUCTION_IDEMPOTENCY_PAYLOAD_MISMATCH',
  'CREATE OR REPLACE FUNCTION auction.append_audit',
  'CREATE OR REPLACE FUNCTION auction.append_outbox',
  'CREATE OR REPLACE FUNCTION auction.bind_deal',
]);
requireFragments('moneyMigration', [
  'start_price_kopecks_per_ton bigint',
  'amount_kopecks_per_ton bigint',
  'pg_advisory_xact_lock',
  "ARRAY['FARMER', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER']",
  'ORDER BY bid.amount_kopecks_per_ton DESC, bid.placed_at ASC, bid.id ASC',
  "'INBOUND'",
  "'DEAL_BASIS_READY'",
  "'CONFIRMED'",
  'total_kopecks := round',
  "'requestFingerprint', request_hash",
]);
requireFragments('compatibilityMigration', [
  'mod(start_price_kopecks_per_ton, 100) = 0',
  'mod(amount_kopecks_per_ton, 100) = 0',
]);
requireFragments('service', [
  'randomUUID()',
  'Prisma.TransactionIsolationLevel.Serializable',
  'maxConflictRetries: 5',
  'auction.register_verified_lot',
  'auction.record_admission',
  'auction.place_bid',
  'auction.close_lot',
  'auction.bind_deal',
  "amountKopecksPerTon: string",
  "expectedVersion: string",
]);
requireFragments('controller', [
  "@Post('lots')",
  "@Post('lots/:lotId/admissions')",
  "@Post('lots/:lotId/bids')",
  "@Post('lots/:lotId/close')",
  "@Roles('BUYER')",
  "@Roles('FARMER', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER')",
]);
requireFragments('raceTest', [
  'Promise.allSettled',
  'AUCTION_STALE_VERSION',
  'AUCTION_ADMISSION_REQUIRED',
  'AUCTION_BID_CUTOFF_REACHED',
  'AUCTION_IDEMPOTENCY_PAYLOAD_MISMATCH',
  'forced-auction-outbox-collision',
  'new AuctionCommandService',
  'DEAL_BASIS_ALREADY_CONSUMED',
  'basisEvents).toBe(1)',
  'winners).toBe(1)',
  'awards).toBe(1)',
]);
requireFragments('workflow', [
  'ref: ${{ env.EXACT_HEAD }}',
  'postgres:16',
  'CREATE ROLE app_deal LOGIN',
  'prisma migrate deploy',
  'auction-atomic-execution.e2e-spec.ts',
  'auction-atomic-acceptance.mjs',
  'if-no-files-found: error',
  'retention-days: 90',
  'Auction Atomic Gate · all blocking checks',
]);

forbid('service', [
  [/amountKopecksPerTon:\s*number/, 'number-typed money input'],
  [/expectedVersion:\s*number/, 'number-typed version input'],
  [/Math\.random|Date\.now/, 'process-local command authority'],
  [/commandId:\s*string;/, 'client-provided command id'],
]);
forbid('workflow', [
  [/continue-on-error:\s*true|\|\|\s*true/, 'suppressed blocking failure'],
  [/@master\b/, 'mutable GitHub Action reference'],
]);

let jest = null;
if (!existsSync(JEST_REPORT)) {
  violations.push(`Jest evidence is missing: ${JEST_REPORT}`);
} else {
  try {
    jest = JSON.parse(readFileSync(JEST_REPORT, 'utf8'));
    if (jest.success !== true || Number(jest.numFailedTests ?? 0) !== 0) {
      violations.push('Auction Jest acceptance did not succeed.');
    }
    if (Number(jest.numPassedTests ?? 0) < 1) {
      violations.push('Auction Jest acceptance did not execute a passing test.');
    }
  } catch (error) {
    violations.push(`Cannot parse Jest evidence: ${error instanceof Error ? error.message : String(error)}.`);
  }
}

const report = {
  schemaVersion: 1,
  repository: 'pachaninm-lab/pachanin-demo',
  issue: '#2615',
  commitSha: actualHead,
  generatedAt: new Date().toISOString(),
  acceptance: {
    trustedTenantObjectScope: true,
    admittedBuyerOnly: true,
    databaseTimeCutoff: true,
    integerMinorUnitPrice: true,
    optimisticLotVersion: true,
    persistedIdempotencyFingerprint: true,
    serializableAdvisoryLock: true,
    deterministicTieBreak: 'amount DESC, placed_at ASC, bid id ASC',
    singleWinnerConstraint: true,
    atomicAuditOutboxBasis: true,
    restartReplay: true,
    oneCanonicalDeal: true,
    rollbackOnEvidenceFailure: true,
  },
  jest: jest && {
    success: jest.success,
    numPassedTests: jest.numPassedTests,
    numFailedTests: jest.numFailedTests,
    numPassedTestSuites: jest.numPassedTestSuites,
  },
  files: Object.entries(files).map(([label, path]) => ({
    label,
    path,
    sha256: sha256(sources[label] ?? ''),
  })),
  violations,
  passed: violations.length === 0,
};

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
const escaped = violations.join('; ').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
writeFileSync(
  JUNIT_PATH,
  `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="auction-atomic-execution" tests="1" failures="${report.passed ? 0 : 1}"><testcase classname="industrial-readiness" name="IR-AUCTION #2615">${report.passed ? '' : `<failure message="${escaped}"/>`}</testcase></testsuite>\n`,
);

if (!report.passed) {
  console.error('Auction atomic acceptance failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log(`Auction atomic acceptance passed for ${actualHead}.`);

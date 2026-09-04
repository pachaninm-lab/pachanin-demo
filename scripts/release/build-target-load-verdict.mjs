#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const evidenceDir = process.argv[2] || process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness/load';
const profile = process.env.TARGET_LOAD_PROFILE || 'target';
const exactHead = process.env.EXACT_HEAD || null;
const scenarios = ['session', 'sustained', 'burst', 'bid', 'bank', 'close'];

async function jsonFile(name) {
  try {
    return JSON.parse(await readFile(path.join(evidenceDir, name), 'utf8'));
  } catch (error) {
    return { missing: true, error: String(error) };
  }
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metric(document, name, key = 'count') {
  return numeric(document?.metrics?.[name]?.values?.[key]);
}

const seed = await jsonFile('seed-summary.json');
const reconciliation = await jsonFile('database-reconciliation.json');
const environment = await jsonFile('environment.json');
const runs = Object.fromEntries(await Promise.all(
  scenarios.map(async (scenario) => [scenario, await jsonFile(`${scenario}.json`)]),
));

const checks = [];
function requireCheck(id, passed, observed, expected) {
  checks.push({ id, passed: Boolean(passed), observed, expected });
}

for (const scenario of scenarios) {
  const run = runs[scenario];
  requireCheck(
    `scenario.${scenario}.evidence`,
    !run.missing && run.scenario === scenario,
    run.missing ? run.error : run.scenario,
    scenario,
  );
  requireCheck(
    `scenario.${scenario}.thresholds`,
    !run.missing && run.passed === true,
    run.missing ? 'missing' : run.failedThresholds,
    'all k6 thresholds pass',
  );
  requireCheck(
    `scenario.${scenario}.exactHead`,
    !exactHead || run.exactHead === exactHead,
    run.exactHead ?? null,
    exactHead,
  );
}

const sessionTarget = numeric(seed.buyerSessions);
const bankTarget = Math.min(numeric(seed.bankOperations), metric(runs.bank, 'iterations'));
const bidSuccesses = metric(runs.bid, 'bid_successes');
const commandSuccesses = metric(runs.sustained, 'command_successes');

requireCheck('sessions.seeded', numeric(reconciliation?.sessions?.buyersSeeded) >= sessionTarget,
  reconciliation?.sessions?.buyersSeeded, `>= ${sessionTarget}`);
requireCheck('sessions.concurrentAuthenticatedFloor', metric(runs.session, 'session_successes') >= sessionTarget,
  metric(runs.session, 'session_successes'), `>= ${sessionTarget}`);
requireCheck('sessions.persistentlyTouched', numeric(reconciliation?.sessions?.buyersTouched) >= sessionTarget,
  reconciliation?.sessions?.buyersTouched, `>= ${sessionTarget}`);
requireCheck('tenantIsolation.http', metric(runs.session, 'tenant_isolation_successes') >= sessionTarget,
  metric(runs.session, 'tenant_isolation_successes'), `>= ${sessionTarget}`);

requireCheck('deals.seeded', numeric(reconciliation?.deals?.seeded) >= numeric(seed.deals),
  reconciliation?.deals?.seeded, `>= ${numeric(seed.deals)}`);
requireCheck('events.persisted', numeric(reconciliation?.events?.baseline) >= numeric(seed.domainEvents),
  reconciliation?.events?.baseline, `>= ${numeric(seed.domainEvents)}`);
requireCheck('commands.committed', commandSuccesses > 0 && numeric(reconciliation?.deals?.admissionApproved) >= commandSuccesses,
  { httpSuccesses: commandSuccesses, persisted: reconciliation?.deals?.admissionApproved },
  'persisted >= successful command responses > 0');

requireCheck('auction.bidsPersisted', bidSuccesses > 0 && numeric(reconciliation?.auction?.bids) >= bidSuccesses,
  { httpSuccesses: bidSuccesses, persisted: reconciliation?.auction?.bids },
  'persisted >= successful bid responses > 0');
requireCheck('auction.singleWinner', numeric(reconciliation?.auction?.winningBids) === 1,
  reconciliation?.auction?.winningBids, 1);
requireCheck('auction.singleAward', numeric(reconciliation?.auction?.awards) === 1,
  reconciliation?.auction?.awards, 1);
requireCheck('auction.singleDealBinding', numeric(reconciliation?.auction?.dealAwards) === 1,
  reconciliation?.auction?.dealAwards, 1);

requireCheck('settlement.callbacksPersisted', bankTarget > 0 && numeric(reconciliation?.settlement?.callbacks) >= bankTarget,
  reconciliation?.settlement?.callbacks, `>= ${bankTarget}`);
requireCheck('settlement.callbackUniqueness',
  numeric(reconciliation?.settlement?.callbacks) === numeric(reconciliation?.settlement?.distinctCallbackEvents),
  { callbacks: reconciliation?.settlement?.callbacks, distinct: reconciliation?.settlement?.distinctCallbackEvents },
  'callbacks = distinct(partner,event)');
requireCheck('settlement.oneLedgerPerOperation',
  numeric(reconciliation?.settlement?.ledgerEntries) === numeric(reconciliation?.settlement?.confirmedOperations),
  { ledger: reconciliation?.settlement?.ledgerEntries, confirmed: reconciliation?.settlement?.confirmedOperations },
  'ledger entries = confirmed operations');
requireCheck('settlement.noDuplicateLedgerOperation', numeric(reconciliation?.settlement?.duplicateLedgerOperations) === 0,
  reconciliation?.settlement?.duplicateLedgerOperations, 0);
requireCheck('settlement.noDuplicateLedgerKey', numeric(reconciliation?.settlement?.duplicateLedgerIdempotencyKeys) === 0,
  reconciliation?.settlement?.duplicateLedgerIdempotencyKeys, 0);

requireCheck('database.noUngrantedLocks', numeric(reconciliation?.database?.ungrantedLocks) === 0,
  reconciliation?.database?.ungrantedLocks, 0);
requireCheck('database.connectionBound', numeric(reconciliation?.database?.activeConnections) <= 100,
  reconciliation?.database?.activeConnections, '<= 100 PostgreSQL connections');
requireCheck('outbox.drained', numeric(reconciliation?.outbox?.pending) === 0,
  reconciliation?.outbox?.pending, 0);
requireCheck('outbox.noDeadLetters', numeric(reconciliation?.outbox?.deadLetters) === 0,
  reconciliation?.outbox?.deadLetters, 0);

const failedChecks = checks.filter((check) => !check.passed);
const passed = failedChecks.length === 0;
const qualification = profile === 'target';
const verdict = qualification
  ? (passed ? 'PASS' : 'FAIL')
  : (passed ? 'SMOKE_PASS' : 'SMOKE_FAIL');

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  exactHead,
  profile,
  qualification,
  verdict,
  passed,
  note: qualification
    ? 'PASS is valid only for this exact Git commit and the recorded disposable environment.'
    : 'Smoke mode validates the harness only and is not a capacity qualification.',
  seed,
  environment,
  scenarioSummary: Object.fromEntries(scenarios.map((scenario) => [scenario, {
    passed: runs[scenario]?.passed === true,
    failedThresholds: runs[scenario]?.failedThresholds ?? [],
    metrics: runs[scenario]?.metrics ?? {},
  }])),
  reconciliation,
  checks,
  failedChecks,
};

const output = path.join(evidenceDir, 'target-load-acceptance.json');
await mkdir(evidenceDir, { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output, verdict, failedChecks: failedChecks.map((check) => check.id) }, null, 2)}\n`);

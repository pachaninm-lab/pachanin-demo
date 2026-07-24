import fs from 'node:fs';
import path from 'node:path';

const exactHead = process.env.EXACT_HEAD || process.env.GITHUB_SHA;
const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness/load';
const evidencePath = path.join(evidenceDir, 'target-load-acceptance.json');
const junitPath = path.join(evidenceDir, 'target-load-acceptance.junit.xml');

if (!exactHead) throw new Error('EXACT_HEAD or GITHUB_SHA is required');
if (!fs.existsSync(evidencePath)) throw new Error(`Missing canonical evidence: ${evidencePath}`);
if (!fs.existsSync(junitPath)) throw new Error(`Missing JUnit evidence: ${junitPath}`);

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const errors = [];
const observed = evidence.observed || {};
const db = evidence.databaseInvariants || {};

if (evidence.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
if (evidence.evidenceClass !== 'TARGET_LOAD_AND_BURST') errors.push('unexpected evidenceClass');
if (evidence.exactCommit !== exactHead) errors.push(`exactCommit ${evidence.exactCommit} does not match ${exactHead}`);
if (evidence.environment !== 'production-like-multi-node-kind') errors.push('unexpected environment');
if (evidence.pass !== true || evidence.decision !== 'PASS') errors.push('acceptance decision is not PASS');
if (!Array.isArray(evidence.violations) || evidence.violations.length !== 0) errors.push('violations must be empty');
if (evidence.workload?.authenticatedSessions !== 5000) errors.push('5,000-session profile missing');
if (evidence.workload?.loadDeals !== 50000) errors.push('50,000-Deal dataset missing');
if (evidence.workload?.persistedEvents !== 10000000) errors.push('10,000,000-event dataset missing');
if (evidence.workload?.sustained?.rps !== 500 || evidence.workload?.sustained?.durationSeconds !== 1800) errors.push('500 RPS / 30 minute profile missing');
if (evidence.workload?.burst?.rps !== 1000 || evidence.workload?.burst?.durationSeconds !== 300) errors.push('1,000 RPS / 5 minute burst missing');
if ((observed.sustained?.p95ReadMs ?? Infinity) > 500) errors.push('sustained read p95 > 500ms');
if ((observed.burst?.p95ReadMs ?? Infinity) > 500) errors.push('burst read p95 > 500ms');
if ((observed.commands?.p95Ms ?? Infinity) > 1000) errors.push('command p95 > 1000ms');
if ((observed.auction?.p95Ms ?? Infinity) > 1000) errors.push('auction p95 > 1000ms');
if ((observed.callbacks?.p95Ms ?? Infinity) > 1000) errors.push('callback p95 > 1000ms');
const latencyFields = {
  sustained: ['p50ReadMs', 'p95ReadMs', 'p99ReadMs'],
  burst: ['p50ReadMs', 'p95ReadMs', 'p99ReadMs'],
  commands: ['p50Ms', 'p95Ms', 'p99Ms'],
  auction: ['p50Ms', 'p95Ms', 'p99Ms'],
  callbacks: ['p50Ms', 'p95Ms', 'p99Ms'],
};
for (const [profile, fields] of Object.entries(latencyFields)) {
  for (const field of fields) {
    if (!Number.isFinite(observed[profile]?.[field])) errors.push(`${profile} ${field} missing`);
  }
}
if ((observed.sessions?.maxVUs ?? 0) < 5000) errors.push('5,000 simultaneous k6 VUs not proven');
if ((observed.sustained?.achievedRps ?? 0) < 495) errors.push('sustained achieved RPS < 495');
if ((observed.burst?.achievedRps ?? 0) < 990) errors.push('burst achieved RPS < 990');
if ((observed.commands?.achievedRps ?? 0) < 148.5) errors.push('command achieved RPS < 148.5');
if ((observed.auction?.achievedRps ?? 0) < 198) errors.push('auction achieved attempts/s < 198');
if ((observed.callbacks?.achievedRps ?? 0) < 198) errors.push('callback achieved attempts/s < 198');
for (const profile of ['sessions', 'isolation', 'sustained', 'burst', 'commands', 'auction', 'callbacks']) {
  if ((observed[profile]?.httpErrorRate ?? 1) >= 0.005) errors.push(`${profile} HTTP error rate >= 0.5%`);
  if ((observed[profile]?.unexpectedErrorRate ?? 1) >= 0.005) errors.push(`${profile} unexpected error rate >= 0.5%`);
}
if (observed.isolation?.leakageCount !== 0) errors.push('tenant leakage detected');
if (Number(db.activeSessions) !== 5000) errors.push('activeSessions != 5000');
if (Number(db.loadDeals) !== 50000) errors.push('loadDeals != 50000');
if (Number(db.totalSeededEvents) !== 10000000) errors.push('totalSeededEvents != 10000000');
if (Number(db.duplicateLedgerEffects) !== 0) errors.push('duplicate money effects detected');
if (Number(db.doubleAuctionWinners) !== 0) errors.push('double auction winner detected');
if (Number(db.activeLeaseDuplicates) !== 0) errors.push('duplicate active lease token detected');
if (!String(evidence.supplyChain?.k6Image || '').includes(':1.7.1@sha256:')) errors.push('k6 image is not tag+digest pinned');
if (evidence.maturity?.acceptedLevel !== 'PRODUCTION_LIKE_ACCEPTED') errors.push('acceptedLevel mismatch');

if (errors.length) {
  console.error(JSON.stringify({ evidencePath, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  evidencePath,
  exactCommit: evidence.exactCommit,
  decision: evidence.decision,
  p95ReadMs: Math.max(observed.sustained.p95ReadMs, observed.burst.p95ReadMs),
  p95CommandMs: observed.commands.p95Ms,
  activeSessions: db.activeSessions,
  loadDeals: db.loadDeals,
  totalSeededEvents: db.totalSeededEvents,
}, null, 2));

import fs from 'node:fs';
import path from 'node:path';

const exactHead = process.env.EXACT_HEAD || process.env.GITHUB_SHA || 'unknown';
const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness/load';
const rawDir = path.join(evidenceDir, 'raw');
const outputPath = path.join(evidenceDir, 'target-load-acceptance.json');

const profiles = ['sessions', 'isolation', 'sustained', 'burst', 'commands', 'auction', 'callbacks'];
const summaries = Object.fromEntries(profiles.map((profile) => {
  const file = path.join(rawDir, `k6-${profile}-summary.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing k6 summary: ${file}`);
  return [profile, JSON.parse(fs.readFileSync(file, 'utf8'))];
}));

const db = JSON.parse(fs.readFileSync(path.join(rawDir, 'db-invariants.json'), 'utf8'));
const topology = JSON.parse(fs.readFileSync(path.join(rawDir, 'topology.json'), 'utf8'));
const scaleEvents = JSON.parse(fs.readFileSync(path.join(rawDir, 'scale-events.json'), 'utf8'));
const k6Image = fs.readFileSync(path.join(rawDir, 'k6-image.txt'), 'utf8').trim();

function metric(profile, name, key, fallback = 0) {
  return summaries[profile]?.metrics?.[name]?.values?.[key] ?? fallback;
}
function count(profile, name = 'iterations') {
  return Number(metric(profile, name, 'count', 0));
}
function rate(profile, name) {
  return Number(metric(profile, name, 'rate', 0));
}
function p95(profile, name) {
  return Number(metric(profile, name, 'p(95)', Number.POSITIVE_INFINITY));
}
function deployment(name) {
  return topology.deployments.find((item) => item.name === name);
}

const observed = {
  sessions: {
    iterations: count('sessions'),
    achievedRps: rate('sessions', 'iterations'),
    maxVUs: Number(metric('sessions', 'vus_max', 'max', 0)),
    httpErrorRate: rate('sessions', 'http_req_failed'),
    unexpectedErrorRate: rate('sessions', 'unexpected_errors'),
  },
  isolation: {
    iterations: count('isolation'),
    achievedRps: rate('isolation', 'iterations'),
    maxVUs: Number(metric('isolation', 'vus_max', 'max', 0)),
    leakageCount: count('isolation', 'tenant_leakage'),
    httpErrorRate: rate('isolation', 'http_req_failed'),
    unexpectedErrorRate: rate('isolation', 'unexpected_errors'),
  },
  sustained: {
    iterations: count('sustained'),
    achievedRps: rate('sustained', 'iterations'),
    maxVUs: Number(metric('sustained', 'vus_max', 'max', 0)),
    droppedIterations: count('sustained', 'dropped_iterations'),
    p50ReadMs: Number(metric('sustained', 'authoritative_read_duration', 'med', Number.POSITIVE_INFINITY)),
    p95ReadMs: p95('sustained', 'authoritative_read_duration'),
    p99ReadMs: Number(metric('sustained', 'authoritative_read_duration', 'p(99)', Number.POSITIVE_INFINITY)),
    httpErrorRate: rate('sustained', 'http_req_failed'),
    unexpectedErrorRate: rate('sustained', 'unexpected_errors'),
    durationMs: Number(summaries.sustained.state?.testRunDurationMs ?? 0),
  },
  burst: {
    iterations: count('burst'),
    achievedRps: rate('burst', 'iterations'),
    maxVUs: Number(metric('burst', 'vus_max', 'max', 0)),
    droppedIterations: count('burst', 'dropped_iterations'),
    p50ReadMs: Number(metric('burst', 'authoritative_read_duration', 'med', Number.POSITIVE_INFINITY)),
    p95ReadMs: p95('burst', 'authoritative_read_duration'),
    p99ReadMs: Number(metric('burst', 'authoritative_read_duration', 'p(99)', Number.POSITIVE_INFINITY)),
    httpErrorRate: rate('burst', 'http_req_failed'),
    unexpectedErrorRate: rate('burst', 'unexpected_errors'),
    durationMs: Number(summaries.burst.state?.testRunDurationMs ?? 0),
  },
  commands: {
    iterations: count('commands'),
    achievedRps: rate('commands', 'iterations'),
    maxVUs: Number(metric('commands', 'vus_max', 'max', 0)),
    accepted: count('commands', 'command_accepted'),
    droppedIterations: count('commands', 'dropped_iterations'),
    p50Ms: Number(metric('commands', 'authoritative_command_duration', 'med', Number.POSITIVE_INFINITY)),
    p95Ms: p95('commands', 'authoritative_command_duration'),
    p99Ms: Number(metric('commands', 'authoritative_command_duration', 'p(99)', Number.POSITIVE_INFINITY)),
    httpErrorRate: rate('commands', 'http_req_failed'),
    unexpectedErrorRate: rate('commands', 'unexpected_errors'),
  },
  auction: {
    iterations: count('auction'),
    achievedRps: rate('auction', 'iterations'),
    maxVUs: Number(metric('auction', 'vus_max', 'max', 0)),
    accepted: count('auction', 'auction_accepted'),
    expectedConflicts: count('auction', 'auction_expected_conflicts'),
    droppedIterations: count('auction', 'dropped_iterations'),
    p50Ms: Number(metric('auction', 'auction_command_duration', 'med', Number.POSITIVE_INFINITY)),
    p95Ms: p95('auction', 'auction_command_duration'),
    p99Ms: Number(metric('auction', 'auction_command_duration', 'p(99)', Number.POSITIVE_INFINITY)),
    httpErrorRate: rate('auction', 'http_req_failed'),
    unexpectedErrorRate: rate('auction', 'unexpected_errors'),
  },
  callbacks: {
    iterations: count('callbacks'),
    achievedRps: rate('callbacks', 'iterations'),
    maxVUs: Number(metric('callbacks', 'vus_max', 'max', 0)),
    accepted: count('callbacks', 'callback_accepted'),
    droppedIterations: count('callbacks', 'dropped_iterations'),
    p50Ms: Number(metric('callbacks', 'bank_callback_duration', 'med', Number.POSITIVE_INFINITY)),
    p95Ms: p95('callbacks', 'bank_callback_duration'),
    p99Ms: Number(metric('callbacks', 'bank_callback_duration', 'p(99)', Number.POSITIVE_INFINITY)),
    httpErrorRate: rate('callbacks', 'http_req_failed'),
    unexpectedErrorRate: rate('callbacks', 'unexpected_errors'),
  },
};

const thresholds = {
  activeSessions: 5000,
  loadDeals: 50000,
  totalPersistedEvents: 10000000,
  sustainedRps: 500,
  sustainedSeconds: 1800,
  burstRps: 1000,
  burstSeconds: 300,
  auctionAttemptsPerSecond: 200,
  auctionSeconds: 120,
  callbackAttemptsPerSecond: 200,
  callbackSeconds: 120,
  readP95Ms: 500,
  commandP95Ms: 1000,
  unexpectedErrorRate: 0.005,
  tenantLeakage: 0,
  duplicateMoneyEffects: 0,
  doubleAuctionWinners: 0,
  lostCommittedEvents: 0,
};

const violations = [];
const require = (condition, code, details) => { if (!condition) violations.push({ code, details }); };
const atLeast = (actual, expected) => actual >= Math.floor(expected * 0.99);

require(observed.sessions.iterations >= thresholds.activeSessions, 'SESSION_CONCURRENCY_NOT_PROVEN', observed.sessions);
require(observed.sessions.maxVUs >= thresholds.activeSessions, 'SESSION_VU_CONCURRENCY_NOT_PROVEN', observed.sessions);
require(observed.sessions.httpErrorRate < thresholds.unexpectedErrorRate, 'SESSION_HTTP_ERROR_RATE_EXCEEDED', observed.sessions);
require(observed.sessions.unexpectedErrorRate < thresholds.unexpectedErrorRate, 'SESSION_ERROR_RATE_EXCEEDED', observed.sessions);
require(observed.isolation.iterations >= 1000, 'TENANT_ISOLATION_SAMPLE_INCOMPLETE', observed.isolation);
require(observed.isolation.leakageCount === 0, 'TENANT_LEAKAGE_DETECTED', observed.isolation);
require(observed.isolation.httpErrorRate < thresholds.unexpectedErrorRate, 'ISOLATION_HTTP_ERROR_RATE_EXCEEDED', observed.isolation);
require(observed.isolation.unexpectedErrorRate < thresholds.unexpectedErrorRate, 'ISOLATION_ERROR_RATE_EXCEEDED', observed.isolation);
require(atLeast(observed.sustained.iterations, thresholds.sustainedRps * thresholds.sustainedSeconds), 'SUSTAINED_RATE_NOT_ACHIEVED', observed.sustained);
require(observed.sustained.droppedIterations === 0, 'SUSTAINED_DROPPED_ITERATIONS', observed.sustained);
require(observed.sustained.p95ReadMs <= thresholds.readP95Ms, 'SUSTAINED_READ_P95_EXCEEDED', observed.sustained);
require(observed.sustained.achievedRps >= thresholds.sustainedRps * 0.99, 'SUSTAINED_RPS_NOT_ACHIEVED', observed.sustained);
require(Number.isFinite(observed.sustained.p50ReadMs) && Number.isFinite(observed.sustained.p95ReadMs) && Number.isFinite(observed.sustained.p99ReadMs), 'SUSTAINED_LATENCY_DISTRIBUTION_MISSING', observed.sustained);
require(observed.sustained.httpErrorRate < thresholds.unexpectedErrorRate, 'SUSTAINED_HTTP_ERROR_RATE_EXCEEDED', observed.sustained);
require(observed.sustained.unexpectedErrorRate < thresholds.unexpectedErrorRate, 'SUSTAINED_ERROR_RATE_EXCEEDED', observed.sustained);
require(atLeast(observed.burst.iterations, thresholds.burstRps * thresholds.burstSeconds), 'BURST_RATE_NOT_ACHIEVED', observed.burst);
require(observed.burst.droppedIterations === 0, 'BURST_DROPPED_ITERATIONS', observed.burst);
require(observed.burst.p95ReadMs <= thresholds.readP95Ms, 'BURST_READ_P95_EXCEEDED', observed.burst);
require(observed.burst.achievedRps >= thresholds.burstRps * 0.99, 'BURST_RPS_NOT_ACHIEVED', observed.burst);
require(Number.isFinite(observed.burst.p50ReadMs) && Number.isFinite(observed.burst.p95ReadMs) && Number.isFinite(observed.burst.p99ReadMs), 'BURST_LATENCY_DISTRIBUTION_MISSING', observed.burst);
require(observed.burst.httpErrorRate < thresholds.unexpectedErrorRate, 'BURST_HTTP_ERROR_RATE_EXCEEDED', observed.burst);
require(observed.burst.unexpectedErrorRate < thresholds.unexpectedErrorRate, 'BURST_ERROR_RATE_EXCEEDED', observed.burst);
require(atLeast(observed.commands.iterations, 150 * 240), 'COMMAND_RATE_NOT_ACHIEVED', observed.commands);
require(observed.commands.accepted === observed.commands.iterations, 'COMMAND_ACCEPTANCE_GAP', observed.commands);
require(observed.commands.p95Ms <= thresholds.commandP95Ms, 'COMMAND_P95_EXCEEDED', observed.commands);
require(observed.commands.achievedRps >= 150 * 0.99, 'COMMAND_RPS_NOT_ACHIEVED', observed.commands);
require(Number.isFinite(observed.commands.p50Ms) && Number.isFinite(observed.commands.p95Ms) && Number.isFinite(observed.commands.p99Ms), 'COMMAND_LATENCY_DISTRIBUTION_MISSING', observed.commands);
require(observed.commands.httpErrorRate < thresholds.unexpectedErrorRate, 'COMMAND_HTTP_ERROR_RATE_EXCEEDED', observed.commands);
require(observed.commands.unexpectedErrorRate < thresholds.unexpectedErrorRate, 'COMMAND_ERROR_RATE_EXCEEDED', observed.commands);
require(atLeast(observed.auction.iterations, thresholds.auctionAttemptsPerSecond * thresholds.auctionSeconds), 'AUCTION_ATTEMPT_RATE_NOT_ACHIEVED', observed.auction);
require(observed.auction.accepted + observed.auction.expectedConflicts === observed.auction.iterations, 'AUCTION_UNCLASSIFIED_RESULTS', observed.auction);
require(observed.auction.p95Ms <= thresholds.commandP95Ms, 'AUCTION_P95_EXCEEDED', observed.auction);
require(observed.auction.achievedRps >= thresholds.auctionAttemptsPerSecond * 0.99, 'AUCTION_RPS_NOT_ACHIEVED', observed.auction);
require(Number.isFinite(observed.auction.p50Ms) && Number.isFinite(observed.auction.p95Ms) && Number.isFinite(observed.auction.p99Ms), 'AUCTION_LATENCY_DISTRIBUTION_MISSING', observed.auction);
require(observed.auction.httpErrorRate < thresholds.unexpectedErrorRate, 'AUCTION_HTTP_ERROR_RATE_EXCEEDED', observed.auction);
require(observed.auction.unexpectedErrorRate < thresholds.unexpectedErrorRate, 'AUCTION_ERROR_RATE_EXCEEDED', observed.auction);
require(atLeast(observed.callbacks.iterations, thresholds.callbackAttemptsPerSecond * thresholds.callbackSeconds), 'CALLBACK_RATE_NOT_ACHIEVED', observed.callbacks);
require(observed.callbacks.accepted === observed.callbacks.iterations, 'CALLBACK_ACCEPTANCE_GAP', observed.callbacks);
require(observed.callbacks.p95Ms <= thresholds.commandP95Ms, 'CALLBACK_P95_EXCEEDED', observed.callbacks);
require(observed.callbacks.achievedRps >= thresholds.callbackAttemptsPerSecond * 0.99, 'CALLBACK_RPS_NOT_ACHIEVED', observed.callbacks);
require(Number.isFinite(observed.callbacks.p50Ms) && Number.isFinite(observed.callbacks.p95Ms) && Number.isFinite(observed.callbacks.p99Ms), 'CALLBACK_LATENCY_DISTRIBUTION_MISSING', observed.callbacks);
require(observed.callbacks.httpErrorRate < thresholds.unexpectedErrorRate, 'CALLBACK_HTTP_ERROR_RATE_EXCEEDED', observed.callbacks);
require(observed.callbacks.unexpectedErrorRate < thresholds.unexpectedErrorRate, 'CALLBACK_ERROR_RATE_EXCEEDED', observed.callbacks);

require(Number(db.activeSessions) === thresholds.activeSessions, 'ACTIVE_SESSION_COUNT_MISMATCH', db.activeSessions);
require(Number(db.loadDeals) === thresholds.loadDeals, 'LOAD_DEAL_COUNT_MISMATCH', db.loadDeals);
require(Number(db.totalSeededEvents) === thresholds.totalPersistedEvents, 'PERSISTED_EVENT_COUNT_MISMATCH', db.totalSeededEvents);
require(Number(db.callbackRows) === observed.callbacks.accepted, 'CALLBACK_PERSISTENCE_MISMATCH', { db: db.callbackRows, accepted: observed.callbacks.accepted });
require(Number(db.confirmedReserveOperations) === observed.callbacks.accepted, 'CONFIRMED_OPERATION_MISMATCH', db.confirmedReserveOperations);
require(Number(db.confirmedPayments) === observed.callbacks.accepted, 'CONFIRMED_PAYMENT_MISMATCH', db.confirmedPayments);
require(Number(db.duplicateLedgerEffects) === 0, 'DUPLICATE_MONEY_EFFECT', db.duplicateLedgerEffects);
require(Number(db.doubleAuctionWinners) === 0, 'DOUBLE_AUCTION_WINNER', db.doubleAuctionWinners);
require(Number(db.activeLeaseDuplicates) === 0, 'DUPLICATE_ACTIVE_LEASE_TOKEN', db.activeLeaseDuplicates);

const api = deployment('grainflow-api');
const worker = deployment('grainflow-outbox-worker');
const pgbouncer = deployment('pgbouncer');
require(api?.desired === 4 && api?.ready === 4 && api?.available === 4, 'API_SCALE_FINAL_STATE_INVALID', api);
require(worker?.desired === 4 && worker?.ready === 4 && worker?.available === 4, 'WORKER_SCALE_FINAL_STATE_INVALID', worker);
require(pgbouncer?.desired === 2 && pgbouncer?.ready === 2, 'PGBOUNCER_STATE_INVALID', pgbouncer);
require(scaleEvents.some((item) => item.event === 'api_scale_out' && item.apiReplicas === 6), 'API_SCALE_OUT_NOT_PROVEN', scaleEvents);
require(scaleEvents.some((item) => item.event === 'api_scale_in' && item.apiReplicas === 4), 'API_SCALE_IN_NOT_PROVEN', scaleEvents);
require(k6Image.includes(':1.7.1@sha256:'), 'K6_IMAGE_NOT_IMMUTABLE', k6Image);

const evidence = {
  schemaVersion: 1,
  evidenceClass: 'TARGET_LOAD_AND_BURST',
  exactCommit: exactHead,
  environment: 'production-like-multi-node-kind',
  generatedAt: new Date().toISOString(),
  decision: violations.length === 0 ? 'PASS' : 'FAIL',
  pass: violations.length === 0,
  workload: {
    authenticatedSessions: 5000,
    loadDeals: 50000,
    persistedEvents: 10000000,
    sustained: { rps: 500, durationSeconds: 1800 },
    burst: { rps: 1000, durationSeconds: 300 },
    dealCommands: { rps: 150, durationSeconds: 240 },
    auctionHotLot: { attemptsPerSecond: 200, durationSeconds: 120 },
    signedBankCallbacks: { attemptsPerSecond: 200, durationSeconds: 120 },
  },
  observed,
  databaseInvariants: db,
  topology,
  scaleEvents,
  supplyChain: { k6Image },
  thresholds,
  violations,
  maturity: {
    acceptedLevel: violations.length === 0 ? 'PRODUCTION_LIKE_ACCEPTED' : 'NOT_ACCEPTED',
    permittedClaim: violations.length === 0
      ? 'Target sustained, burst and canonical Deal workload capacity is accepted on the tested production-like infrastructure.'
      : null,
    prohibitedClaims: [
      'fully operational production',
      'capacity of an unselected real cloud provider',
      'live user behaviour',
      'live external integrations',
      'permanent production history',
    ],
  },
};

fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);

const junitPath = path.join(evidenceDir, 'target-load-acceptance.junit.xml');
const xmlEscape = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');
const cases = violations.length === 0
  ? ['  <testcase classname="industrial-readiness.load" name="target-load-and-burst-acceptance"/>']
  : violations.map((violation) => [
      `  <testcase classname="industrial-readiness.load" name="${xmlEscape(violation.code)}">`,
      `    <failure message="${xmlEscape(violation.code)}">${xmlEscape(JSON.stringify(violation.details))}</failure>`,
      '  </testcase>',
    ].join('\n'));
fs.writeFileSync(junitPath, [
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<testsuite name="target-load-and-burst-acceptance" tests="${cases.length}" failures="${violations.length}" time="0">`,
  ...cases,
  '</testsuite>',
  '',
].join('\n'));

console.log(JSON.stringify({
  outputPath,
  junitPath,
  decision: evidence.decision,
  violationCount: violations.length,
}, null, 2));

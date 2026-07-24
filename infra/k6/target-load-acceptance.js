import http from 'k6/http';
import crypto from 'k6/crypto';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const TOKENS_FILE = __ENV.TARGET_LOAD_TOKENS_FILE || './target-load-tokens.json';
const BASE_URL = __ENV.TARGET_LOAD_BASE_URL || 'http://127.0.0.1:8080';
const INGRESS_HOST = __ENV.TARGET_LOAD_INGRESS_HOST || 'api.acceptance.grainflow.invalid';
const SCENARIO = __ENV.TARGET_LOAD_SCENARIO || 'session';
const RESULT_PATH = __ENV.TARGET_LOAD_RESULT_PATH || `target-load-${SCENARIO}.json`;

const BUYER_COUNT = numberEnv('TARGET_LOAD_BUYER_SESSIONS', 5000);
const COMPLIANCE_COUNT = numberEnv('TARGET_LOAD_COMPLIANCE_SESSIONS', 100);
const SESSION_COUNT = numberEnv('TARGET_LOAD_SESSIONS', BUYER_COUNT);
const DEAL_COUNT = numberEnv('TARGET_LOAD_DEALS', 50000);
const BANK_COUNT = numberEnv('TARGET_LOAD_BANK_OPERATIONS', 1000);
const SUSTAINED_RPS = numberEnv('TARGET_LOAD_SUSTAINED_RPS', 500);
const COMMAND_RPS = numberEnv('TARGET_LOAD_COMMAND_RPS', 20);
const BURST_RPS = numberEnv('TARGET_LOAD_BURST_RPS', 1000);
const BID_RPS = numberEnv('TARGET_LOAD_BID_RPS', 200);
const BANK_BATCH_RPS = numberEnv('TARGET_LOAD_BANK_BATCH_RPS', 100);
const READ_P95_MS = numberEnv('TARGET_LOAD_READ_P95_MS', 500);
const COMMAND_P95_MS = numberEnv('TARGET_LOAD_COMMAND_P95_MS', 1000);
const ERROR_RATE = numberEnv('TARGET_LOAD_ERROR_RATE', 0.005);

const buyers = new SharedArray('target-load-buyers', () => JSON.parse(open(TOKENS_FILE)).buyers);
const compliance = new SharedArray('target-load-compliance', () => JSON.parse(open(TOKENS_FILE)).compliance);
const farmer = new SharedArray('target-load-farmer', () => [JSON.parse(open(TOKENS_FILE)).farmer]);

const businessFailures = new Rate('business_failures');
const sessionSuccesses = new Counter('session_successes');
const tenantIsolationSuccesses = new Counter('tenant_isolation_successes');
const readSuccesses = new Counter('read_successes');
const commandSuccesses = new Counter('command_successes');
const bidSuccesses = new Counter('bid_successes');
const bidConflicts = new Counter('bid_conflicts');
const bankHttpSuccesses = new Counter('bank_http_successes');
const closeSuccesses = new Counter('close_successes');
const readDuration = new Trend('read_duration', true);
const commandDuration = new Trend('command_duration', true);
const bidDuration = new Trend('bid_duration', true);
const bankDuration = new Trend('bank_duration', true);

export const options = buildOptions();

function numberEnv(name, fallback) {
  const value = Number(__ENV[name] || fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

function durationEnv(name, fallback) {
  return String(__ENV[name] || fallback);
}

function buildOptions() {
  const common = {
    discardResponseBodies: true,
    noConnectionReuse: false,
    userAgent: `grainflow-target-load/${SCENARIO}`,
    thresholds: {
      business_failures: [`rate<${ERROR_RATE}`],
    },
  };

  if (SCENARIO === 'session') {
    return {
      ...common,
      scenarios: {
        session_floor: {
          executor: 'per-vu-iterations',
          exec: 'sessionFloor',
          vus: SESSION_COUNT,
          iterations: 1,
          maxDuration: durationEnv('TARGET_LOAD_SESSION_MAX_DURATION', '8m'),
          gracefulStop: '30s',
        },
      },
      thresholds: {
        ...common.thresholds,
        session_successes: [`count>=${SESSION_COUNT}`],
        tenant_isolation_successes: [`count>=${SESSION_COUNT}`],
      },
    };
  }

  if (SCENARIO === 'sustained') {
    const readRate = SUSTAINED_RPS - (COMMAND_RPS * 2);
    if (readRate < 1) throw new Error('Sustained RPS must exceed two HTTP requests per command iteration');
    const duration = durationEnv('TARGET_LOAD_SUSTAINED_DURATION', '30m');
    return {
      ...common,
      scenarios: {
        sustained_reads: {
          executor: 'constant-arrival-rate',
          exec: 'readDeal',
          rate: readRate,
          timeUnit: '1s',
          duration,
          preAllocatedVUs: Math.min(BUYER_COUNT, numberEnv('TARGET_LOAD_READ_PREALLOCATED_VUS', 800)),
          maxVUs: BUYER_COUNT,
          gracefulStop: '30s',
        },
        sustained_commands: {
          executor: 'constant-arrival-rate',
          exec: 'approveDeal',
          rate: COMMAND_RPS,
          timeUnit: '1s',
          duration,
          preAllocatedVUs: Math.min(COMPLIANCE_COUNT, numberEnv('TARGET_LOAD_COMMAND_PREALLOCATED_VUS', COMPLIANCE_COUNT)),
          maxVUs: Math.max(COMPLIANCE_COUNT, 200),
          gracefulStop: '30s',
        },
      },
      thresholds: {
        ...common.thresholds,
        read_duration: [`p(95)<${READ_P95_MS}`],
        command_duration: [`p(95)<${COMMAND_P95_MS}`],
        dropped_iterations: ['count==0'],
      },
    };
  }

  if (SCENARIO === 'burst') {
    return {
      ...common,
      scenarios: {
        burst_reads: {
          executor: 'constant-arrival-rate',
          exec: 'readDeal',
          rate: BURST_RPS,
          timeUnit: '1s',
          duration: durationEnv('TARGET_LOAD_BURST_DURATION', '5m'),
          preAllocatedVUs: Math.min(BUYER_COUNT, numberEnv('TARGET_LOAD_BURST_PREALLOCATED_VUS', 1500)),
          maxVUs: BUYER_COUNT,
          gracefulStop: '30s',
        },
      },
      thresholds: {
        ...common.thresholds,
        read_duration: [`p(95)<${READ_P95_MS}`],
        dropped_iterations: ['count==0'],
      },
    };
  }

  if (SCENARIO === 'bid') {
    return {
      ...common,
      scenarios: {
        hot_lot: {
          executor: 'constant-arrival-rate',
          exec: 'placeHotBid',
          rate: BID_RPS,
          timeUnit: '1s',
          duration: durationEnv('TARGET_LOAD_BID_DURATION', '5m'),
          preAllocatedVUs: Math.min(BUYER_COUNT, numberEnv('TARGET_LOAD_BID_PREALLOCATED_VUS', 1000)),
          maxVUs: BUYER_COUNT,
          gracefulStop: '1m',
        },
      },
      thresholds: {
        ...common.thresholds,
        bid_successes: [`rate>=${BID_RPS * (1 - ERROR_RATE)}`],
        bid_duration: [`p(95)<${COMMAND_P95_MS}`],
        dropped_iterations: ['count==0'],
      },
    };
  }

  if (SCENARIO === 'bank') {
    return {
      ...common,
      scenarios: {
        callback_storm: {
          executor: 'constant-arrival-rate',
          exec: 'bankCallbackStorm',
          rate: BANK_BATCH_RPS,
          timeUnit: '1s',
          duration: durationEnv('TARGET_LOAD_BANK_DURATION', '1m'),
          preAllocatedVUs: numberEnv('TARGET_LOAD_BANK_PREALLOCATED_VUS', 400),
          maxVUs: BUYER_COUNT,
          gracefulStop: '1m',
        },
      },
      thresholds: {
        ...common.thresholds,
        bank_http_successes: [`rate>=${BANK_BATCH_RPS * 3 * (1 - ERROR_RATE)}`],
        bank_duration: [`p(95)<${COMMAND_P95_MS}`],
        dropped_iterations: ['count==0'],
      },
    };
  }

  if (SCENARIO === 'close') {
    return {
      ...common,
      scenarios: {
        close_hot_lot: {
          executor: 'shared-iterations',
          exec: 'closeHotLot',
          vus: 1,
          iterations: 1,
          maxDuration: '2m',
        },
      },
      thresholds: {
        ...common.thresholds,
        close_successes: ['count==1'],
      },
    };
  }

  throw new Error(`Unknown TARGET_LOAD_SCENARIO=${SCENARIO}`);
}

function suffix(value, width) {
  return String(value).padStart(width, '0');
}

function commonHeaders(token, extra = {}) {
  return {
    Host: INGRESS_HOST,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function params(token, kind, expected = [200]) {
  return {
    headers: commonHeaders(token),
    tags: { kind, scenario: SCENARIO },
    responseType: 'text',
    responseCallback: http.expectedStatuses(...expected),
    timeout: '30s',
  };
}

function parseJson(response) {
  try {
    return response.json();
  } catch (_) {
    return null;
  }
}

function dealForBuyer(iteration, buyer) {
  const cycle = Math.floor(iteration / BUYER_COUNT);
  const candidate = buyer.index + ((cycle % Math.ceil(DEAL_COUNT / BUYER_COUNT)) * BUYER_COUNT);
  return Math.min(candidate, DEAL_COUNT);
}

export function sessionFloor() {
  const buyer = buyers[(__VU - 1) % buyers.length];
  const me = http.get(`${BASE_URL}/api/auth/me`, params(buyer.token, 'session'));
  const sessionOk = check(me, { 'authenticated session accepted': (r) => r.status === 200 });
  sessionSuccesses.add(sessionOk ? 1 : 0);

  const otherBuyerIndex = (buyer.index % BUYER_COUNT) + 1;
  const inaccessibleDeal = suffix(otherBuyerIndex, 6);
  const denied = http.get(
    `${BASE_URL}/api/deals/load-deal-${inaccessibleDeal}/execution-workspace`,
    params(buyer.token, 'tenant-probe', [403, 404]),
  );
  const isolationOk = check(denied, { 'cross-scope Deal denied': (r) => r.status === 403 || r.status === 404 });
  tenantIsolationSuccesses.add(isolationOk ? 1 : 0);
  businessFailures.add(!(sessionOk && isolationOk));
}

export function readDeal() {
  const iteration = exec.scenario.iterationInTest;
  const buyer = buyers[iteration % buyers.length];
  const dealNumber = dealForBuyer(iteration, buyer);
  const response = http.get(
    `${BASE_URL}/api/deals/load-deal-${suffix(dealNumber, 6)}/execution-workspace`,
    params(buyer.token, 'read'),
  );
  readDuration.add(response.timings.duration);
  const ok = check(response, { 'Deal workspace read accepted': (r) => r.status === 200 });
  readSuccesses.add(ok ? 1 : 0);
  businessFailures.add(!ok);
}

export function approveDeal() {
  const iteration = exec.scenario.iterationInTest;
  if (iteration >= DEAL_COUNT) {
    businessFailures.add(true);
    return;
  }
  const dealNumber = iteration + 1;
  const dealId = `load-deal-${suffix(dealNumber, 6)}`;
  const actor = compliance[(dealNumber - 1) % compliance.length];
  const read = http.get(`${BASE_URL}/api/deals/${dealId}`, params(actor.token, 'command-read'));
  const snapshot = parseJson(read);
  if (read.status !== 200 || !snapshot?.updatedAt || snapshot?.version === undefined) {
    businessFailures.add(true);
    return;
  }

  const payload = JSON.stringify({
    commandId: `load-command-${dealNumber}`,
    idempotencyKey: `load-command-idempotency-${dealNumber}`,
    expectedUpdatedAt: snapshot.updatedAt,
    expectedVersion: String(snapshot.version),
    payload: {},
  });
  const started = Date.now();
  const response = http.post(
    `${BASE_URL}/api/deals/${dealId}/commands/approve_admission`,
    payload,
    params(actor.token, 'command', [200, 201]),
  );
  commandDuration.add(Date.now() - started);
  const ok = check(response, { 'Deal command committed': (r) => r.status === 200 || r.status === 201 });
  commandSuccesses.add(ok ? 1 : 0);
  businessFailures.add(!ok);
}

export function placeHotBid() {
  const iteration = exec.scenario.iterationInTest;
  const buyer = buyers[iteration % buyers.length];
  const started = Date.now();
  let ok = false;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const workspace = http.get(
      `${BASE_URL}/api/auctions/lots/load-hot-lot/workspace`,
      params(buyer.token, 'bid-read'),
    );
    const snapshot = parseJson(workspace);
    const version = Number(snapshot?.authority?.version);
    if (workspace.status !== 200 || !Number.isFinite(version)) break;

    const amount = 1_000_000 + ((version + 1) * 100);
    const response = http.post(
      `${BASE_URL}/api/auctions/lots/load-hot-lot/bids`,
      JSON.stringify({
        amountKopecksPerTon: String(amount),
        volumeTons: '100',
        expectedVersion: String(version),
        idempotencyKey: `load-bid-${iteration}-${attempt}`,
      }),
      params(buyer.token, 'bid', [200, 201, 409]),
    );
    if (response.status === 200 || response.status === 201) {
      ok = true;
      break;
    }
    if (response.status !== 409) break;
    bidConflicts.add(1);
    sleep(Math.random() * 0.02);
  }

  bidDuration.add(Date.now() - started);
  bidSuccesses.add(ok ? 1 : 0);
  businessFailures.add(!ok);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function bankCallbackStorm() {
  const iteration = exec.scenario.iterationInTest;
  const index = (iteration % BANK_COUNT) + 1;
  const id = suffix(index, 5);
  const eventId = `load-bank-event-${id}`;
  const body = {
    bankRef: `LOAD-BANK-REF-${id}`,
    dealId: `load-bank-deal-${id}`,
    eventId,
    operation: 'RESERVE',
    operationId: `load-bank-operation-${id}`,
    status: 'SUCCESS',
  };
  const encoded = stableStringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyHash = crypto.sha256(encoded, 'hex');
  const signedPayload = [
    'POST',
    '/api/settlement-engine/bank-callback',
    'safe-deals',
    'primary',
    String(timestamp),
    eventId,
    bodyHash,
  ].join('\n');
  const signature = `hmac-sha256=${crypto.hmac('sha256', __ENV.BANK_HMAC_SECRET, signedPayload, 'hex')}`;
  const callbackParams = {
    headers: commonHeaders('', {
      Authorization: undefined,
      'x-bank-signature': signature,
      'x-bank-timestamp': String(timestamp),
      'x-bank-event-id': eventId,
      'x-bank-partner-id': 'safe-deals',
      'x-bank-key-id': 'primary',
    }),
    tags: { kind: 'bank', scenario: SCENARIO },
    responseType: 'text',
    responseCallback: http.expectedStatuses(200),
    timeout: '30s',
  };
  delete callbackParams.headers.Authorization;

  const request = ['POST', `${BASE_URL}/api/settlement-engine/bank-callback`, encoded, callbackParams];
  const started = Date.now();
  const responses = http.batch([request, request, request]);
  bankDuration.add(Date.now() - started);
  const succeeded = responses.filter((response) => response.status === 200).length;
  bankHttpSuccesses.add(succeeded);
  businessFailures.add(succeeded !== 3);
}

export function closeHotLot() {
  const actor = farmer[0];
  const workspace = http.get(
    `${BASE_URL}/api/auctions/lots/load-hot-lot/workspace`,
    params(actor.token, 'close-read'),
  );
  const snapshot = parseJson(workspace);
  const version = snapshot?.authority?.version;
  if (workspace.status !== 200 || version === undefined) {
    businessFailures.add(true);
    return;
  }
  const response = http.post(
    `${BASE_URL}/api/auctions/lots/load-hot-lot/close`,
    JSON.stringify({ expectedVersion: String(version), idempotencyKey: 'load-hot-lot-close-idempotency' }),
    params(actor.token, 'close', [200, 201]),
  );
  const ok = response.status === 200 || response.status === 201;
  closeSuccesses.add(ok ? 1 : 0);
  businessFailures.add(!ok);
}

export function handleSummary(data) {
  const metrics = {};
  for (const [name, metric] of Object.entries(data.metrics || {})) {
    if (
      name.startsWith('http_')
      || name.endsWith('_duration')
      || name.endsWith('_successes')
      || name === 'business_failures'
      || name === 'dropped_iterations'
      || name === 'iterations'
      || name === 'bid_conflicts'
    ) {
      metrics[name] = {
        type: metric.type,
        values: metric.values || {},
        thresholds: metric.thresholds || {},
      };
    }
  }
  const failedThresholds = Object.entries(metrics).flatMap(([metricName, metric]) =>
    Object.entries(metric.thresholds || {})
      .filter(([, threshold]) => threshold.ok === false)
      .map(([expression]) => ({ metric: metricName, expression })),
  );
  const normalized = {
    schemaVersion: 1,
    exactHead: __ENV.EXACT_HEAD || null,
    scenario: SCENARIO,
    generatedAt: new Date().toISOString(),
    passed: failedThresholds.length === 0,
    failedThresholds,
    targets: {
      sessions: SESSION_COUNT,
      deals: DEAL_COUNT,
      sustainedRps: SUSTAINED_RPS,
      commandRps: COMMAND_RPS,
      burstRps: BURST_RPS,
      bidRps: BID_RPS,
      bankBatchRps: BANK_BATCH_RPS,
      readP95Ms: READ_P95_MS,
      commandP95Ms: COMMAND_P95_MS,
      maxBusinessErrorRate: ERROR_RATE,
    },
    metrics,
  };
  const encoded = `${JSON.stringify(normalized, null, 2)}\n`;
  return { stdout: encoded, [RESULT_PATH]: encoded };
}

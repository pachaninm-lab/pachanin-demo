import http from 'k6/http';
import crypto from 'k6/crypto';
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

const profile = __ENV.PROFILE || 'sessions';
const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:8080';
const hostHeader = __ENV.HOST_HEADER || 'api.acceptance.grainflow.invalid';
const tokensPath = __ENV.TOKENS_PATH || '/evidence/tokens.json';
const bankSecret = __ENV.BANK_HMAC_SECRET || '';
const bankPartnerId = __ENV.BANK_PARTNER_ID || 'safe-deals';
const bankKeyId = __ENV.BANK_HMAC_KEY_ID || 'load-primary';
const dealUpdatedAt = __ENV.DEAL_UPDATED_AT || '2026-07-17T00:00:00.000Z';

const tokenDocument = new SharedArray('load-tokens', () => {
  const parsed = JSON.parse(open(tokensPath));
  return [parsed];
})[0];

const unexpectedErrors = new Rate('unexpected_errors');
const tenantLeakage = new Counter('tenant_leakage');
const readDuration = new Trend('authoritative_read_duration', true);
const commandDuration = new Trend('authoritative_command_duration', true);
const auctionDuration = new Trend('auction_command_duration', true);
const callbackDuration = new Trend('bank_callback_duration', true);
const commandAccepted = new Counter('command_accepted');
const auctionAccepted = new Counter('auction_accepted');
const auctionConflicts = new Counter('auction_expected_conflicts');
const callbackAccepted = new Counter('callback_accepted');

const defaultThresholds = {
  unexpected_errors: ['rate<0.005'],
  http_req_failed: ['rate<0.005'],
  dropped_iterations: ['count==0'],
};

const scenarios = {
  sessions: {
    executor: 'per-vu-iterations',
    vus: 5000,
    iterations: 1,
    maxDuration: '5m',
    exec: 'sessionProbe',
  },
  isolation: {
    executor: 'shared-iterations',
    vus: 50,
    iterations: 1000,
    maxDuration: '2m',
    exec: 'isolationProbe',
  },
  sustained: {
    executor: 'constant-arrival-rate',
    rate: 500,
    timeUnit: '1s',
    duration: '30m',
    preAllocatedVUs: 750,
    maxVUs: 3000,
    exec: 'readWorkspace',
  },
  burst: {
    executor: 'constant-arrival-rate',
    rate: 1000,
    timeUnit: '1s',
    duration: '5m',
    preAllocatedVUs: 1500,
    maxVUs: 5000,
    exec: 'readWorkspace',
  },
  commands: {
    executor: 'constant-arrival-rate',
    rate: 150,
    timeUnit: '1s',
    duration: '4m',
    preAllocatedVUs: 300,
    maxVUs: 2000,
    exec: 'executeDealCommand',
  },
  auction: {
    executor: 'constant-arrival-rate',
    rate: 200,
    timeUnit: '1s',
    duration: '2m',
    preAllocatedVUs: 500,
    maxVUs: 2500,
    exec: 'placeHotLotBid',
  },
  callbacks: {
    executor: 'constant-arrival-rate',
    rate: 200,
    timeUnit: '1s',
    duration: '2m',
    preAllocatedVUs: 500,
    maxVUs: 2500,
    exec: 'sendBankCallback',
  },
};

if (!scenarios[profile]) throw new Error(`Unknown PROFILE=${profile}`);
if (profile === 'callbacks' && bankSecret.length < 32) throw new Error('BANK_HMAC_SECRET is required for callback profile');

export const options = {
  discardResponseBodies: profile === 'sustained' || profile === 'burst' || profile === 'sessions',
  scenarios: { [profile]: scenarios[profile] },
  thresholds: {
    ...defaultThresholds,
    ...(profile === 'sustained' || profile === 'burst'
      ? { authoritative_read_duration: ['p(95)<500'] }
      : {}),
    ...(profile === 'commands'
      ? { authoritative_command_duration: ['p(95)<1000'] }
      : {}),
    ...(profile === 'auction'
      ? { auction_command_duration: ['p(95)<1000'] }
      : {}),
    ...(profile === 'callbacks'
      ? { bank_callback_duration: ['p(95)<1000'] }
      : {}),
    tenant_leakage: ['count==0'],
  },
  summaryTrendStats: ['min', 'med', 'avg', 'p(90)', 'p(95)', 'p(99)', 'max'],
  noConnectionReuse: false,
  userAgent: `grainflow-industrial-load/${profile}`,
};

function headers(token, extra = {}) {
  return {
    Host: hostHeader,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra,
  };
}

function tokenAt(list, offset = 0) {
  return list[(exec.scenario.iterationInTest + offset) % list.length];
}

function recordExpected(response, expectedStatuses, durationMetric) {
  if (durationMetric) durationMetric.add(response.timings.duration);
  const expected = expectedStatuses.includes(response.status);
  unexpectedErrors.add(!expected);
  return expected;
}

export function sessionProbe() {
  const token = tokenDocument.all[(__VU - 1) % tokenDocument.all.length];
  const response = http.get(`${baseUrl}/api/auth/me`, { headers: headers(token), tags: { operation: 'auth_me' } });
  recordExpected(response, [200]);
}

export function isolationProbe() {
  const token = tokenAt(tokenDocument.isolated);
  const response = http.get(`${baseUrl}/api/deals/DEAL-INDUSTRIAL-001/workspace`, {
    headers: headers(token),
    tags: { operation: 'tenant_isolation' },
    responseCallback: http.expectedStatuses(403, 404),
  });
  if (response.status === 200) tenantLeakage.add(1);
  recordExpected(response, [403, 404]);
}

export function readWorkspace() {
  const mainCount = tokenDocument.all.length - tokenDocument.isolated.length;
  const token = tokenDocument.all[exec.scenario.iterationInTest % mainCount];
  const response = http.get(`${baseUrl}/api/deals/DEAL-INDUSTRIAL-001/workspace`, {
    headers: headers(token),
    tags: { operation: 'deal_workspace_read' },
  });
  recordExpected(response, [200], readDuration);
}

export function executeDealCommand() {
  const index = exec.scenario.iterationInTest + 1;
  const dealIndex = String(index).padStart(6, '0');
  const token = tokenAt(tokenDocument.compliance);
  const body = JSON.stringify({
    commandId: `load-command-${dealIndex}`,
    idempotencyKey: `load-command-idem-${dealIndex}`,
    expectedUpdatedAt: dealUpdatedAt,
    expectedVersion: '0',
    payload: { source: 'industrial-target-load', sequence: index },
  });
  const response = http.post(`${baseUrl}/api/deals/DEAL-LOAD-${dealIndex}/commands/approve_admission`, body, {
    headers: headers(token),
    tags: { operation: 'deal_authoritative_command' },
  });
  if (recordExpected(response, [200, 201], commandDuration)) commandAccepted.add(1);
}

export function placeHotLotBid() {
  const token = tokenAt(tokenDocument.buyers);
  const view = http.get(`${baseUrl}/api/auctions/lots/lot-load-hot/workspace`, {
    headers: headers(token),
    tags: { operation: 'auction_workspace_read' },
  });
  let version = 1;
  if (view.status === 200) {
    try {
      const payload = view.json();
      version = Number(payload.version ?? payload.lot?.version ?? 1);
    } catch (_) {
      unexpectedErrors.add(true);
      return;
    }
  } else {
    recordExpected(view, [200]);
    return;
  }

  const iteration = exec.scenario.iterationInTest + 1;
  const amountKopecksPerTon = 1200000 + iteration * 10000;
  const response = http.post(`${baseUrl}/api/auctions/lots/lot-load-hot/bids`, JSON.stringify({
    amountKopecksPerTon: String(amountKopecksPerTon),
    volumeTons: '1.000000',
    expectedVersion: String(version),
    commandId: `load-auction-command-${iteration}`,
    idempotencyKey: `load-auction-idem-${iteration}`,
  }), {
    headers: headers(token),
    tags: { operation: 'auction_hot_lot_bid' },
    responseCallback: http.expectedStatuses(200, 201, 409),
  });

  auctionDuration.add(response.timings.duration);
  if ([200, 201].includes(response.status)) {
    auctionAccepted.add(1);
    unexpectedErrors.add(false);
  } else if (response.status === 409) {
    auctionConflicts.add(1);
    unexpectedErrors.add(false);
  } else {
    unexpectedErrors.add(true);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const output = {};
    Object.keys(value).sort().forEach((key) => { output[key] = stable(value[key]); });
    return output;
  }
  return value;
}

export function sendBankCallback() {
  const index = exec.scenario.iterationInTest + 1;
  const padded = String(index).padStart(6, '0');
  const eventId = `load-callback-${padded}`;
  const bodyObject = {
    bankRef: `load-bank-ref-${padded}`,
    dealId: `DEAL-LOAD-${padded}`,
    eventId,
    operation: 'RESERVE',
    operationId: `operation-load-${padded}`,
    status: 'SUCCESS',
  };
  const body = JSON.stringify(bodyObject);
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyHash = crypto.sha256(JSON.stringify(stable(bodyObject)), 'hex');
  const signaturePayload = [
    'POST',
    '/api/settlement-engine/bank-callback',
    bankPartnerId,
    bankKeyId,
    String(timestamp),
    eventId,
    bodyHash,
  ].join('\n');
  const signature = `hmac-sha256=${crypto.hmac('sha256', bankSecret, signaturePayload, 'hex')}`;

  const response = http.post(`${baseUrl}/api/settlement-engine/bank-callback`, body, {
    headers: {
      Host: hostHeader,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-bank-signature': signature,
      'x-bank-timestamp': String(timestamp),
      'x-bank-event-id': eventId,
      'x-bank-partner-id': bankPartnerId,
      'x-bank-key-id': bankKeyId,
    },
    tags: { operation: 'bank_callback_authoritative' },
  });
  if (recordExpected(response, [200], callbackDuration)) callbackAccepted.add(1);
}

export function handleSummary(data) {
  const summaryPath = __ENV.K6_SUMMARY_PATH || `summary-${profile}.json`;
  return {
    [summaryPath]: `${JSON.stringify(data, null, 2)}\n`,
    stdout: `target-load profile=${profile} durationMs=${data.state?.testRunDurationMs ?? 'unknown'}\n`,
  };
}

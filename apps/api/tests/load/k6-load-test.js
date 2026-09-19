/**
 * k6 Load Test — GrainFlow API
 * ТЗ 15.3: baseline + stress scenarios, NFR: p95 < 500ms, error rate < 1%
 *
 * Run:
 *   k6 run k6-load-test.js
 *   k6 run --env BASE_URL=https://api.grainflow.ru k6-load-test.js
 *   k6 run --stage 15s:100 --stage 30s:500 k6-load-test.js  (quick smoke)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-jwt-token';

// Custom metrics
const failedRequests = new Counter('failed_requests');
const dealCreationDuration = new Trend('deal_creation_ms', true);
const settlementDuration = new Trend('settlement_ms', true);
const analyticsLatency = new Trend('analytics_ms', true);
const errorRate = new Rate('error_rate');

// ─── Scenarios ────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Baseline: normal production load
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 },    // ramp-up
        { duration: '10m', target: 500 },   // normal load
        { duration: '5m', target: 0 },      // ramp-down
      ],
      tags: { scenario: 'baseline' },
      gracefulRampDown: '30s',
    },

    // Stress: 3x peak load per ТЗ 15.3
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      startTime: '21m',
      stages: [
        { duration: '3m', target: 500 },
        { duration: '5m', target: 1500 },  // 3x peak
        { duration: '3m', target: 0 },
      ],
      tags: { scenario: 'stress' },
      gracefulRampDown: '30s',
    },

    // Spike: sudden burst (100→1000 in 1 min)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      startTime: '32m',
      stages: [
        { duration: '1m', target: 1000 },
        { duration: '3m', target: 1000 },
        { duration: '1m', target: 0 },
      ],
      tags: { scenario: 'spike' },
    },
  },

  thresholds: {
    // NFR from ТЗ 15.3: p95 < 500ms, p99 < 2000ms
    'http_req_duration': ['p(95)<500', 'p(99)<2000'],
    // Error rate < 1%
    'http_req_failed': ['rate<0.01'],
    'error_rate': ['rate<0.01'],
    // Critical paths must be faster
    'deal_creation_ms': ['p(95)<800'],
    'settlement_ms': ['p(95)<1000'],
    'analytics_ms': ['p(95)<300'],
  },
};

// ─── Shared headers ───────────────────────────────────────────────────────────

function headers(extraHeaders = {}) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    ...extraHeaders,
  };
}

function checkResponse(res, name) {
  const ok = check(res, {
    [`${name}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name}: response time < 2s`]: (r) => r.timings.duration < 2000,
  });
  if (!ok) {
    failedRequests.add(1);
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
  return ok;
}

// ─── Test scenarios ───────────────────────────────────────────────────────────

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || 'baseline';

  // Weight: 60% read-heavy, 30% deal operations, 10% financial operations
  const rand = Math.random();

  if (rand < 0.30) {
    groupReadOperations();
  } else if (rand < 0.60) {
    groupDealOperations();
  } else if (rand < 0.80) {
    groupAnalytics();
  } else if (rand < 0.90) {
    groupSettlementOperations();
  } else {
    groupHealthChecks();
  }

  sleep(Math.random() * 2 + 0.5); // 0.5s – 2.5s think time
}

function groupReadOperations() {
  group('Read Operations', () => {
    // Lots listing
    let res = http.get(`${BASE_URL}/api/lots`, { headers: headers() });
    checkResponse(res, 'GET /api/lots');

    // Deals listing
    res = http.get(`${BASE_URL}/api/deals`, { headers: headers() });
    checkResponse(res, 'GET /api/deals');

    // Single deal (use a known test ID)
    res = http.get(`${BASE_URL}/api/deals/test-deal-001`, { headers: headers() });
    // 404 is acceptable for a read of potentially non-existent deal
    check(res, { 'deal detail: response time < 500ms': (r) => r.timings.duration < 500 });

    // Outbox status
    res = http.get(`${BASE_URL}/api/settlement-engine/outbox`, { headers: headers() });
    checkResponse(res, 'GET /outbox');
  });
}

function groupDealOperations() {
  group('Deal Operations', () => {
    const startMs = Date.now();

    // Create a lot
    const lotRes = http.post(
      `${BASE_URL}/api/lots`,
      JSON.stringify({
        title: `k6-test-lot-${Date.now()}`,
        culture: 'Пшеница',
        cropClass: '3',
        region: 'Краснодарский край',
        volumeTons: Math.floor(Math.random() * 500 + 50),
        pricePerTonRub: 14500 + Math.floor(Math.random() * 1000 - 500),
      }),
      { headers: headers() },
    );
    const lotOk = checkResponse(lotRes, 'POST /api/lots');
    if (!lotOk) return;

    const lotId = lotRes.json('id');
    if (!lotId) return;

    // Get lot detail
    const detailRes = http.get(`${BASE_URL}/api/lots/${lotId}`, { headers: headers() });
    checkResponse(detailRes, 'GET /api/lots/:id');

    dealCreationDuration.add(Date.now() - startMs);
  });
}

function groupAnalytics() {
  group('Analytics', () => {
    const startMs = Date.now();

    // Unit economics
    let res = http.get(`${BASE_URL}/api/analytics/unit-economics`, { headers: headers() });
    checkResponse(res, 'GET /analytics/unit-economics');

    // Commission preview
    res = http.get(
      `${BASE_URL}/api/analytics/commission-preview?amount=${Math.floor(Math.random() * 5_000_000 + 500_000)}`,
      { headers: headers() },
    );
    checkResponse(res, 'GET /analytics/commission-preview');

    // Price prediction
    const cultures = ['пшеница', 'ячмень', 'кукуруза', 'подсолнечник'];
    const regions = ['Краснодарский край', 'Ростовская область', 'Ставропольский край'];
    res = http.get(
      `${BASE_URL}/api/analytics/price-prediction?culture=${cultures[Math.floor(Math.random() * cultures.length)]}&region=${regions[Math.floor(Math.random() * regions.length)]}`,
      { headers: headers() },
    );
    checkResponse(res, 'GET /analytics/price-prediction');

    analyticsLatency.add(Date.now() - startMs);
  });
}

function groupSettlementOperations() {
  group('Settlement Read', () => {
    const startMs = Date.now();

    // Payment list
    let res = http.get(`${BASE_URL}/api/settlement-engine/payments`, { headers: headers() });
    checkResponse(res, 'GET /settlement-engine/payments');

    // Factoring applications
    res = http.get(`${BASE_URL}/api/factoring/applications`, { headers: headers() });
    checkResponse(res, 'GET /factoring/applications');

    settlementDuration.add(Date.now() - startMs);
  });
}

function groupHealthChecks() {
  group('Health', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health: status 200': (r) => r.status === 200,
      'health: response time < 100ms': (r) => r.timings.duration < 100,
    });
  });
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

export function setup() {
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`API is not healthy: ${BASE_URL}/health returned ${res.status}`);
  }
  console.log(`✅ API is up at ${BASE_URL}`);
  return { baseUrl: BASE_URL };
}

export function teardown(data) {
  console.log('Load test completed.');
  console.log(`Base URL: ${data.baseUrl}`);
}

// ─── Smoke test (quick validation) ───────────────────────────────────────────
// Run with: k6 run --env K6_SMOKE=true --vus 1 --iterations 5 k6-load-test.js
export function smokeTest() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'smoke: health ok': (r) => r.status === 200 });
}

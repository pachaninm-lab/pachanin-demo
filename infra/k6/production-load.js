/**
 * k6 нагрузочное тестирование GrainFlow — Production Load Test
 * ТЗ 15.3: p95 < 500ms, p99 < 2000ms, error rate < 1%
 *
 * Run: k6 run infra/k6/production-load.js
 * Env: API_BASE_URL (default http://localhost:3001)
 *
 * Сценарии:
 *  - Baseline: 500 VU (normal)
 *  - Peak: 1500 VU (3× peak load)
 *  - Soak: длительная стабильная нагрузка
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const BASE = __ENV.API_BASE_URL || 'http://localhost:3001';

// Custom metrics
const dealApiLatency = new Trend('deal_api_latency_ms', true);
const authLatency = new Trend('auth_latency_ms', true);
const analyticsLatency = new Trend('analytics_latency_ms', true);
const errorRate = new Rate('error_rate');
const totalRequests = new Counter('total_requests');

export const options = {
  stages: [
    { duration: '5m', target: 100 },   // ramp up
    { duration: '10m', target: 500 },  // normal load
    { duration: '5m', target: 1500 },  // peak (3×)
    { duration: '5m', target: 0 },     // ramp down
  ],
  thresholds: {
    // Core SLOs from ТЗ 15.3
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
    error_rate: ['rate<0.01'],
    // Endpoint-specific
    deal_api_latency_ms: ['p(95)<500', 'p(99)<2000'],
    auth_latency_ms: ['p(95)<800'],
    analytics_latency_ms: ['p(95)<1000'],
  },
};

// Test users pool
const USERS = [
  { email: 'farmer@demo.ru', password: 'demo1234', role: 'FARMER' },
  { email: 'buyer@demo.ru', password: 'demo1234', role: 'BUYER' },
  { email: 'admin@demo.ru', password: 'demo1234', role: 'ADMIN' },
  { email: 'accounting@demo.ru', password: 'demo1234', role: 'ACCOUNTING' },
  { email: 'lab@demo.ru', password: 'demo1234', role: 'LAB' },
  { email: 'logistician@demo.ru', password: 'demo1234', role: 'LOGISTICIAN' },
];

function randomUser() {
  return USERS[Math.floor(Math.random() * USERS.length)];
}

function headers(token) {
  return { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };
}

function checkResponse(res, name) {
  const ok = check(res, {
    [`${name}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name}: < 500ms`]: (r) => r.timings.duration < 500,
  });
  errorRate.add(!ok);
  totalRequests.add(1);
  return ok;
}

export function setup() {
  // Warm up: login as admin to pre-check connectivity
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: 'admin@demo.ru', password: 'demo1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200 && res.status !== 201) {
    console.error(`Setup failed: auth returned ${res.status}`);
  }
  return {};
}

export default function () {
  const user = randomUser();

  // ── 1. Аутентификация ────────────────────────────────────────────────
  group('auth', () => {
    const start = Date.now();
    const loginRes = http.post(
      `${BASE}/api/auth/login`,
      JSON.stringify({ email: user.email, password: user.password }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    authLatency.add(Date.now() - start);

    const loginOk = check(loginRes, {
      'auth: status 200': (r) => r.status === 200 || r.status === 201,
      'auth: has accessToken': (r) => {
        try { return !!JSON.parse(r.body).accessToken; } catch { return false; }
      },
    });
    errorRate.add(!loginOk);
    totalRequests.add(1);

    if (!loginOk) { sleep(1); return; }

    let token;
    try { token = JSON.parse(loginRes.body).accessToken; } catch { sleep(1); return; }

    // ── 2. Список сделок ──────────────────────────────────────────────
    group('deals', () => {
      const start2 = Date.now();
      const dealsRes = http.get(`${BASE}/api/deals`, headers(token));
      dealApiLatency.add(Date.now() - start2);
      checkResponse(dealsRes, 'deals:list');

      // Одна сделка (если есть)
      let deals = [];
      try { deals = JSON.parse(dealsRes.body); } catch {}
      if (Array.isArray(deals) && deals.length > 0) {
        const dealId = deals[0].id;
        const start3 = Date.now();
        const dealRes = http.get(`${BASE}/api/deals/${dealId}`, headers(token));
        dealApiLatency.add(Date.now() - start3);
        checkResponse(dealRes, 'deals:getOne');
      }
    });

    // ── 3. Health check ───────────────────────────────────────────────
    group('health', () => {
      const healthRes = http.get(`${BASE}/health`);
      checkResponse(healthRes, 'health');

      const readyRes = http.get(`${BASE}/ready`);
      checkResponse(readyRes, 'ready');
    });

    // ── 4. Аналитика (Executive/Admin) ────────────────────────────────
    if (user.role === 'ADMIN' || user.role === 'ACCOUNTING') {
      group('analytics', () => {
        const start4 = Date.now();
        const econRes = http.get(`${BASE}/api/analytics/unit-economics`, headers(token));
        analyticsLatency.add(Date.now() - start4);
        checkResponse(econRes, 'analytics:unit-economics');
      });
    }

    // ── 5. Документы ─────────────────────────────────────────────────
    group('documents', () => {
      const docsRes = http.get(`${BASE}/api/documents`, headers(token));
      checkResponse(docsRes, 'documents:list');
    });

    // ── 6. Уведомления ───────────────────────────────────────────────
    group('notifications', () => {
      const notifRes = http.get(`${BASE}/api/notifications`, headers(token));
      checkResponse(notifRes, 'notifications:list');

      const unreadRes = http.get(`${BASE}/api/notifications/unread-count`, headers(token));
      checkResponse(unreadRes, 'notifications:unread-count');
    });
  });

  // Think time between iterations (realistic user behavior)
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5s
}

export function teardown() {
  console.log('Load test completed. Check thresholds above.');
}

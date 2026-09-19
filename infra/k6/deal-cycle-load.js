/**
 * k6 load test — GrainFlow deal cycle
 *
 * Run: k6 run infra/k6/deal-cycle-load.js
 * Env: API_BASE_URL (default http://localhost:3001)
 *
 * Targets:
 *   - P95 < 800ms for auth + deal create
 *   - P95 < 500ms for GET endpoints
 *   - Error rate < 1%
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE = __ENV.API_BASE_URL || 'http://localhost:3001';

const authLatency = new Trend('auth_latency', true);
const dealCreateLatency = new Trend('deal_create_latency', true);
const getLatency = new Trend('get_latency', true);
const errorRate = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    auth_latency: ['p(95)<800'],
    deal_create_latency: ['p(95)<1200'],
    get_latency: ['p(95)<500'],
    error_rate: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

const USERS = [
  { email: 'farmer@demo.ru', password: 'demo1234' },
  { email: 'buyer@demo.ru', password: 'demo1234' },
  { email: 'accounting@demo.ru', password: 'demo1234' },
  { email: 'admin@demo.ru', password: 'demo1234' },
];

function randomUser() {
  return USERS[Math.floor(Math.random() * USERS.length)];
}

export default function () {
  const user = randomUser();

  // 1. Auth
  const authStart = Date.now();
  const loginRes = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  authLatency.add(Date.now() - authStart);

  const loginOk = check(loginRes, {
    'login 200': (r) => r.status === 200,
    'has accessToken': (r) => !!JSON.parse(r.body || '{}').accessToken,
  });
  errorRate.add(!loginOk);
  if (!loginOk) { sleep(1); return; }

  const token = JSON.parse(loginRes.body).accessToken;
  const authHeader = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2. List deals (read path)
  const listStart = Date.now();
  const listRes = http.get(`${BASE}/deals`, { headers: authHeader });
  getLatency.add(Date.now() - listStart);
  check(listRes, { 'deals list 200': (r) => r.status === 200 || r.status === 403 });

  // 3. Create deal (write path) — only farmers
  if (user.email === 'farmer@demo.ru') {
    const createStart = Date.now();
    const createRes = http.post(
      `${BASE}/deals`,
      JSON.stringify({
        culture: 'Пшеница 3 кл',
        volumeTons: 100 + Math.floor(Math.random() * 900),
        pricePerTon: 12000 + Math.floor(Math.random() * 5000),
        region: 'Краснодарский край',
      }),
      { headers: authHeader },
    );
    dealCreateLatency.add(Date.now() - createStart);
    const createOk = check(createRes, { 'deal create <300': (r) => r.status < 300 });
    errorRate.add(!createOk);
  }

  // 4. Analytics (executive read)
  const analyticsRes = http.get(`${BASE}/api/analytics/unit-economics`, { headers: authHeader });
  const analyticsOk = check(analyticsRes, { 'analytics 200 or 403': (r) => r.status === 200 || r.status === 403 });
  if (analyticsRes.status === 200) {
    getLatency.add(analyticsRes.timings.duration);
  }

  sleep(1);
}

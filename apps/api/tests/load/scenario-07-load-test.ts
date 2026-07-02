/**
 * Сценарий ТЗ №7 — Нагрузочный тест: 1000 параллельных пользователей.
 *
 * Запуск: k6 run scenario-07-load-test.js (после компиляции)
 * Или: npx ts-node scenario-07-load-test.ts (для ревью)
 *
 * Целевые метрики (ТЗ 15.2 §N-7):
 * - P95 latency < 2s
 * - P99 latency < 5s
 * - Error rate < 0.1%
 * - Throughput > 200 RPS
 */

// k6 импорты (для браузера/CI используется k6 binary)
// @ts-ignore
import http from 'k6/http';
// @ts-ignore
import { check, sleep } from 'k6';
// @ts-ignore
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

const errorRate = new Rate('errors');
const dealCreateTime = new Trend('deal_create_time');
const pricePredictTime = new Trend('price_predict_time');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // разогрев до 100 VU
    { duration: '5m', target: 500 },   // нарастание до 500
    { duration: '5m', target: 1000 },  // пик 1000 VU
    { duration: '3m', target: 1000 },  // держим пик
    { duration: '2m', target: 0 },     // остывание
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.001'],
    errors: ['rate<0.001'],
  },
};

const HEALTH_URL = `${BASE_URL}/health`;
const ML_PRICE_URL = 'http://ml-service:8001/api/ml/price/predict';
const ML_FRAUD_URL = 'http://ml-service:8001/api/ml/fraud/check';

export default function () {
  // Сценарий 1: Healthcheck (20% трафика)
  if (Math.random() < 0.2) {
    const resp = http.get(HEALTH_URL);
    errorRate.add(resp.status !== 200);
    check(resp, {
      'health OK': (r) => r.status === 200,
    });
    sleep(0.1);
    return;
  }

  // Сценарий 2: Предсказание цены ML (30% трафика)
  if (Math.random() < 0.3) {
    const start = Date.now();
    const resp = http.post(
      ML_PRICE_URL,
      JSON.stringify({
        region: 'Краснодарский край',
        crop_type: 'WHEAT',
        crop_class: '3',
        volume_tons: Math.floor(Math.random() * 5000) + 100,
        delivery_date: '2024-10-01',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    pricePredictTime.add(Date.now() - start);
    errorRate.add(resp.status !== 200);
    check(resp, {
      'price predict OK': (r) => r.status === 200,
      'has price': (r) => {
        const body = JSON.parse(r.body as string);
        return body.price_per_ton_kopecks > 0;
      },
    });
    sleep(0.5);
    return;
  }

  // Сценарий 3: Fraud check (20% трафика)
  if (Math.random() < 0.2) {
    const resp = http.post(
      ML_FRAUD_URL,
      JSON.stringify({
        user_id: `user_${Math.floor(Math.random() * 1000)}`,
        organization_id: `org_${Math.floor(Math.random() * 100)}`,
        action: 'deal:create',
        amount_kopecks: Math.floor(Math.random() * 100_000_000),
        actions_last_hour: Math.floor(Math.random() * 30),
        new_counterparty: Math.random() < 0.3,
        off_hours: Math.random() < 0.1,
        vpn_detected: Math.random() < 0.05,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    errorRate.add(resp.status !== 200);
    check(resp, {
      'fraud check OK': (r) => r.status === 200,
      'has action': (r) => {
        const body = JSON.parse(r.body as string);
        return ['ALLOW', 'REVIEW', 'BLOCK'].includes(body.action);
      },
    });
    sleep(0.3);
    return;
  }

  // Сценарий 4: API deals list (30% трафика)
  const dealsResp = http.get(`${BASE_URL}/api/deals?limit=20&offset=0`, {
    headers: { Authorization: 'Bearer test-token' },
  });
  const start = Date.now();
  dealCreateTime.add(Date.now() - start);
  errorRate.add(dealsResp.status !== 200 && dealsResp.status !== 401);
  check(dealsResp, {
    'deals endpoint accessible': (r) => r.status < 500,
  });
  sleep(1);
}

export function handleSummary(data: unknown) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
=== GrainFlow Load Test Results ===
Target: 1000 concurrent users
${JSON.stringify(data, null, 2)}
`,
  };
}

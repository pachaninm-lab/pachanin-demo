import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';

vi.mock('@/lib/server-request-security', () => ({
  assertCsrf: vi.fn(() => ({ ok: true })),
}));

const applicationId = 'reg_p0_human_ceremony';
const idempotencyKey = 'p0-human-review:reg_p0_human_ceremony';
const context = {
  params: Promise.resolve({
    path: ['registration', 'applications', applicationId, 'decision'],
  }),
};

function decisionRequest(correlationId: string) {
  return new NextRequest(
    `https://app.example.test/api/staff/registration/applications/${applicationId}/decision`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'x-correlation-id': correlationId,
        Cookie: `${ACCESS_COOKIE}=reviewer-access-token`,
      },
      body: JSON.stringify({
        decision: 'APPROVE',
        reason: 'Production P0 human reviewer ceremony',
        locale: 'ru',
      }),
    },
  );
}

function upstreamResponse(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('P0 human reviewer ceremony staff route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('API_URL', 'https://api.example.test');
    vi.stubEnv('REGISTRATION_DELIVERY_KEY', 'r'.repeat(32));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('delivers the initial decision and records a bounded reviewer marker', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstreamResponse({
      status: 'ACTIVATED',
      replayed: false,
      notificationDelivery: { status: 'SENT' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { POST } = await import('@/app/api/staff/[...path]/route');

    const response = await POST(decisionRequest('p0-human-approve:reg_p0_human_ceremony'), context);
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: 'ACTIVATED',
      replayed: false,
      notificationDelivered: true,
      correlationId: 'p0-human-approve:reg_p0_human_ceremony',
    });
    expect(payload).not.toHaveProperty('notificationDelivery');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(target).toBe(`https://api.example.test/staff/registration/applications/${applicationId}/decision`);
    expect(headers.Authorization).toBe('Bearer reviewer-access-token');
    expect(headers['idempotency-key']).toBe(idempotencyKey);
    expect(headers['x-registration-delivery-key']).toHaveLength(32);

    const markerCall = info.mock.calls.find(([event]) => event === 'p0_human_reviewer_ceremony');
    expect(markerCall).toBeDefined();
    expect(JSON.parse(String(markerCall?.[1]))).toEqual({
      marker: 'P0_HUMAN_REVIEWER_CEREMONY',
      applicationId,
      correlationId: 'p0-human-approve:reg_p0_human_ceremony',
      replayed: false,
      notificationDelivered: true,
      notificationSuppressed: false,
    });
  });

  it('suppresses notification delivery on an idempotent replay', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstreamResponse({
      status: 'ACTIVATED',
      replayed: true,
      notificationDelivery: { status: 'SENT' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { POST } = await import('@/app/api/staff/[...path]/route');

    const response = await POST(decisionRequest('p0-human-replay:reg_p0_human_ceremony'), context);
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: 'ACTIVATED',
      replayed: true,
      correlationId: 'p0-human-replay:reg_p0_human_ceremony',
    });
    expect(payload).not.toHaveProperty('notificationDelivery');
    expect(payload).not.toHaveProperty('notificationDelivered');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe(idempotencyKey);

    const markerCall = info.mock.calls.find(([event]) => event === 'p0_human_reviewer_ceremony');
    expect(markerCall).toBeDefined();
    expect(JSON.parse(String(markerCall?.[1]))).toEqual({
      marker: 'P0_HUMAN_REVIEWER_CEREMONY',
      applicationId,
      correlationId: 'p0-human-replay:reg_p0_human_ceremony',
      replayed: true,
      notificationDelivered: false,
      notificationSuppressed: true,
    });
  });

  it('fails closed when a successful upstream replay lacks durable SENT evidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstreamResponse({
      status: 'ACTIVATED',
      replayed: true,
    })));
    const { POST } = await import('@/app/api/staff/[...path]/route');

    const response = await POST(decisionRequest('p0-human-replay-missing-proof'), context);
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      status: 'ACTIVATED',
      replayed: true,
      code: 'REGISTRATION_DECISION_NOTIFICATION_PENDING',
      correlationId: 'p0-human-replay-missing-proof',
    });
    expect(payload).not.toHaveProperty('notificationDelivery');
    expect(payload).not.toHaveProperty('notificationDelivered');
  });

  it('fails closed when a successful upstream replay lacks durable SENT evidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstreamResponse({
      status: 'ACTIVATED',
      replayed: true,
    })));
    const { POST } = await import('@/app/api/staff/[...path]/route');

    const response = await POST(decisionRequest('p0-human-replay-missing-proof'), context);
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      status: 'ACTIVATED',
      replayed: true,
      code: 'REGISTRATION_DECISION_NOTIFICATION_PENDING',
      correlationId: 'p0-human-replay-missing-proof',
    });
    expect(payload).not.toHaveProperty('notificationDelivery');
    expect(payload).not.toHaveProperty('notificationDelivered');
  });
});

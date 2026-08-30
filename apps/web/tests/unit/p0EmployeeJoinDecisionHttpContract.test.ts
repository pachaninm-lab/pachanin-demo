import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { sendTransactionalMail } from '@/lib/server/transactional-mail';

vi.mock('@/lib/server-request-security', () => ({
  assertCsrf: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/lib/server/transactional-mail', () => ({
  sendTransactionalMail: vi.fn(),
}));

function request() {
  const value = new NextRequest(
    'https://app.example.test/api/auth/organization-join-requests/reg_employee/decision',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'p0-employee-join-http-contract',
        'x-correlation-id': 'p0-employee-join-http-contract',
        cookie: `${ACCESS_COOKIE}=seller-access-token`,
      },
      body: JSON.stringify({
        decision: 'APPROVE',
        reason: 'Production employee organization join approval',
        locale: 'ru',
      }),
    },
  );
  value.cookies.set(ACCESS_COOKIE, 'seller-access-token');
  return value;
}

describe('P0 employee organization-join HTTP contract', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('normalizes a successful upstream POST 201 to the public 200 contract after notification delivery', async () => {
    vi.stubEnv('API_URL', 'https://api.example.test');
    vi.stubEnv('REGISTRATION_DELIVERY_KEY', 'r'.repeat(32));
    vi.mocked(sendTransactionalMail).mockResolvedValue({
      delivered: true,
      provider: 'smtp',
      reason: 'sent',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'ACTIVATED',
      nextAction: 'LOGIN',
      replayed: false,
      notificationDelivery: {
        email: 'synthetic-employee@example.test',
        status: 'ACTIVATED',
        reason: 'approved',
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })));

    const { POST } = await import('@/app/api/auth/organization-join-requests/[applicationId]/decision/route');
    const response = await POST(request(), {
      params: Promise.resolve({ applicationId: 'reg_employee' }),
    });
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: 'ACTIVATED',
      nextAction: 'LOGIN',
      replayed: false,
      notificationDelivered: true,
      correlationId: 'p0-employee-join-http-contract',
    });
    expect(payload).not.toHaveProperty('notificationDelivery');
    expect(sendTransactionalMail).toHaveBeenCalledTimes(1);
  });

  it('preserves an unsuccessful upstream status instead of normalizing it', async () => {
    vi.stubEnv('API_URL', 'https://api.example.test');
    vi.stubEnv('REGISTRATION_DELIVERY_KEY', 'r'.repeat(32));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'REGISTRATION_STATE_CONFLICT',
      status: 'ACTIVATED',
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })));

    const { POST } = await import('@/app/api/auth/organization-join-requests/[applicationId]/decision/route');
    const response = await POST(request(), {
      params: Promise.resolve({ applicationId: 'reg_employee' }),
    });
    const payload = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      code: 'REGISTRATION_STATE_CONFLICT',
      correlationId: 'p0-employee-join-http-contract',
    });
    expect(sendTransactionalMail).not.toHaveBeenCalled();
  });
});

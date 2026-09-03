import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';

vi.mock('@/lib/server-request-security', () => ({
  assertCsrf: vi.fn(() => ({ ok: true })),
}));

const applicationId = 'application-owner-cancel-route';
const context = { params: Promise.resolve({ applicationId }) };

function cancellationRequest(headers: Record<string, string> = {}) {
  return new NextRequest(
    `https://control.example.test/api/staff/registration/applications/${applicationId}/cancel`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-token',
        'Idempotency-Key': 'registration-cancel-route-0001',
        'X-Correlation-Id': 'registration-cancel-route-correlation-0001',
        Cookie: `${ACCESS_COOKIE}=owner-access-token; pc_staff_access_token=owner-staff-access-token`,
        ...headers,
      },
      body: JSON.stringify({ reason: 'Удалено владельцем из очереди' }),
    },
  );
}

describe('owner registration cancellation BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('API_URL', 'https://api.example.test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('forwards the bounded POST with bearer, staff session, idempotency and correlation headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      applicationId,
      status: 'CANCELLED',
      replayed: false,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('@/app/api/staff/registration/applications/[applicationId]/cancel/route');

    const response = await POST(cancellationRequest(), context);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ applicationId, status: 'CANCELLED', replayed: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe(`https://api.example.test/staff/registration/applications/${applicationId}/cancel`);
    expect(init.method).toBe('POST');
    const forwarded = init.headers as Record<string, string>;
    expect(forwarded.Authorization).toBe('Bearer owner-access-token');
    expect(forwarded['X-Staff-Access-Session']).toBe('owner-staff-access-token');
    expect(forwarded['Idempotency-Key']).toBe('registration-cancel-route-0001');
    expect(forwarded['X-Correlation-Id']).toBe('registration-cancel-route-correlation-0001');
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'Удалено владельцем из очереди' });
  });

  it('fails closed when Idempotency-Key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('@/app/api/staff/registration/applications/[applicationId]/cancel/route');
    const request = cancellationRequest({ 'Idempotency-Key': '' });

    const response = await POST(request, context);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the control-plane staff session is absent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('@/app/api/staff/registration/applications/[applicationId]/cancel/route');
    const request = new NextRequest(
      `https://control.example.test/api/staff/registration/applications/${applicationId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'csrf-token',
          'Idempotency-Key': 'registration-cancel-route-0001',
          'X-Correlation-Id': 'registration-cancel-route-correlation-0001',
          Cookie: `${ACCESS_COOKIE}=owner-access-token`,
        },
        body: JSON.stringify({ reason: 'Удалено владельцем из очереди' }),
      },
    );

    const response = await POST(request, context);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'STAFF_CONTROL_SESSION_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

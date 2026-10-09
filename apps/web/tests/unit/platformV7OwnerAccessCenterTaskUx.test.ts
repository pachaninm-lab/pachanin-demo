import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { NextRequest } from 'next/server';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_COOKIE, CSRF_COOKIE } from '../../lib/auth-cookies';
import { CONTROL_PLATFORM_HOST, PRIMARY_PLATFORM_HOST } from '../../lib/platform-v7/control-host';
import { ownerAccessCenterMessages } from '../../i18n/owner-access-center-messages';
import { OwnerAccessCenter as RoleModeCenter } from '../../components/platform-v7/staff/OwnerAccessCenterV3';
import { OwnerAccessCenter as BootstrapCenter } from '../../components/platform-v7/staff/OwnerAccessCenterV4';

const repoRoot = resolve(__dirname, '../../../..');
const read = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8');
const page = read('apps/web/app/platform-v7/staff/page.tsx');
const entry = read('apps/web/components/platform-v7/staff/OwnerAccessCenter.tsx');
const bootstrap = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV4.tsx');
const bootstrapCss = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV4.module.css');
const directCenter = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV3.tsx');
const roleModeRoute = read('apps/web/app/platform-v7/staff/role-mode/route.ts');
const canonicalStaffBff = read('apps/web/app/api/staff/[...path]/route.ts');
const prepareRoute = read('apps/web/app/platform-v7/staff/prepare/route.ts');
const directCss = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV3.module.css');
const center = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV2.tsx');
const catalog = read('apps/web/lib/platform-v7/staff-access-task-catalog.ts');
const deferred = read('apps/web/components/platform-v7/staff/StaffOperationalWorkspacesDeferred.tsx');

describe('Founder role-mode request boundary', () => {
  const origin = `https://${CONTROL_PLATFORM_HOST}`;
  const csrf = 'test-csrf-value';
  const requestBody = {
    cabinetKey: 'buyer', organizationId: 'organization-1',
    reason: 'Review the real organization cabinet', ticketId: 'ticket-1', durationSeconds: 900,
  };

  function request(method = 'GET', body?: unknown, headers: Record<string, string> = {}, query = '') {
    const receivedHeaders = {
      host: CONTROL_PLATFORM_HOST, origin,
      cookie: `${ACCESS_COOKIE}=test-access-cookie; ${CSRF_COOKIE}=${csrf}`,
      'x-csrf-token': csrf, 'content-type': 'application/json', ...headers,
    };
    const received = new NextRequest(`${origin}/platform-v7/staff/role-mode${query}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    // Happy DOM models browser request construction and strips Host/Cookie/
    // Origin. Populate the received server request after construction instead.
    for (const [name, value] of Object.entries(receivedHeaders)) received.headers.set(name, value);
    if (receivedHeaders.cookie) {
      received.cookies.set(ACCESS_COOKIE, 'test-access-cookie');
      received.cookies.set(CSRF_COOKIE, csrf);
    }
    return received;
  }

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('API_URL', 'https://backend.example.test/api');
    vi.stubEnv('PC_CONTROL_HOST_ENABLED', 'true');
    vi.stubEnv('PC_PUBLIC_ORIGIN', `https://${PRIMARY_PLATFORM_HOST}`);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    [{ host: PRIMARY_PLATFORM_HOST, 'x-forwarded-host': CONTROL_PLATFORM_HOST }, 421, 'CONTROL_HOST_REQUIRED'],
    [{ cookie: '' }, 401, 'UNAUTHENTICATED'],
  ])('rejects invalid request authority before any upstream call', async (headers, status, code) => {
    const { GET } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await GET(request('GET', undefined, headers));
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { 'x-csrf-token': '' },
    { 'x-csrf-token': 'different-test-value' },
    { origin: 'https://other.example.test' },
  ])('rejects missing, mismatched or cross-origin CSRF without creating a request', async (headers) => {
    const { POST } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await POST(request('POST', requestBody, headers));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_REJECTED' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { ...requestBody, durationSeconds: 59 },
    { ...requestBody, durationSeconds: 3601 },
    { ...requestBody, organizationId: 'x' },
    { ...requestBody, reason: 'short' },
  ])('rejects invalid role-mode input without contacting the API', async (body) => {
    const { POST } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await POST(request('POST', body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'ROLE_MODE_REQUEST_INVALID' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bounds request bytes before forwarding', async () => {
    const { POST } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await POST(request('POST', { ...requestBody, padding: 'x'.repeat(16 * 1024) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST_BODY' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards only bounded request fields and strips an upstream credential', async () => {
    vi.mocked(fetch).mockResolvedValue(json({ grantId: 'grant-1', accessToken: 'test-upstream-token' }, 201));
    const { POST } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await POST(request('POST', {
      ...requestBody, targetTenantId: 'client-tenant', targetRole: 'PLATFORM_OWNER',
      permissions: ['all'], canonicalPath: 'https://other.example.test',
    }, { 'x-correlation-id': 'test-role-mode' }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ grantId: 'grant-1', correlationId: 'test-role-mode' });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://backend.example.test/api/staff/founder/role-mode/requests');
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual', cache: 'no-store' });
    expect(JSON.parse(init!.body as string)).toEqual(requestBody);
    expect(new Headers(init!.headers).get('authorization')).toBe('Bearer test-access-cookie');
  });

  it('keeps session verification on the canonical staff BFF', async () => {
    const { GET } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await GET(request('GET', undefined, {}, '?view=session'));
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ code: 'ROLE_MODE_SESSION_USE_STAFF_BFF' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['GET', 'POST'])('rejects an upstream redirect for %s', async (method) => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://other.example.test' } }));
    const route = await import('../../app/platform-v7/staff/role-mode/route');
    const response = method === 'POST'
      ? await route.POST(request(method, requestBody))
      : await route.GET(request(method));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'UPSTREAM_REDIRECT_REJECTED' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('fails closed when the upstream registry is unavailable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('test network failure'));
    const { GET } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'ROLE_MODE_REGISTRY_UNAVAILABLE' });
  });
});

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

function roleModeFixtures() {
  const cabinets = [
    'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator',
    'lab', 'bank', 'organization', 'arbitrator', 'compliance', 'executive',
  ].map((key) => ({ key, canonicalPath: `/platform-v7/${key}`, effectiveRole: 'BUYER' }));
  const session = {
    accessSessionId: 'session-1', accessMode: 'VIEW_AS', permissions: ['cabinet:view-as'],
    effectiveOrganizationId: 'organization-1', effectiveRole: 'BUYER', expiresAt: '2099-09-24T00:00:00Z',
  };
  const registry = {
    schemaVersion: 'pc-crop.founder-role-mode.v1', mode: 'VIEW_AS', readOnly: true,
    returnPath: '/platform-v7/staff', restrictions: [], cabinets,
  };
  const canonical = {
    ...registry, active: true, accessSessionId: 'session-1', actor: { displayName: 'Owner' },
    cabinetKey: 'buyer', canonicalPath: '/platform-v7/buyer', effectiveRole: 'BUYER',
    effectiveOrganizationId: 'organization-1', effectiveTenantId: 'tenant-1',
    expiresAt: session.expiresAt, ticketId: 'ticket-1', mfaRequired: true,
  };
  const props = {
    locale: 'ru' as const, copy: ownerAccessCenterMessages.ru,
    identity: { email: 'owner@example.test' }, apiAvailable: true, accessCatalog: [], csrfToken: '',
  };
  return { cabinets, session, registry, canonical, props };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe('platform-v7 owner access center task UX', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('clears protected data before reconciling an end that committed with a lost response', async () => {
    const { session, registry, canonical, props } = roleModeFixtures();
    let ended = false;
    let endRequests = 0;
    let releaseReconciliation!: (response: Response) => void;
    const reconciliation = new Promise<Response>((resolve) => { releaseReconciliation = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode') return json(registry);
      if (path === '/api/staff/session-context') return ended ? reconciliation : json({ active: true, session });
      if (path === '/api/staff/access/sessions') return json(ended ? [] : [{ id: session.accessSessionId, status: 'ACTIVE' }]);
      if (path === '/api/staff/founder/role-mode/session') return ended ? json({ code: 'ROLE_MODE_SESSION_INACTIVE' }, 401) : json(canonical);
      if (path === '/api/staff/organizations/organization-1/cabinet/BUYER') return json({ deals: [{ id: 'private-ended-deal' }] });
      if (path === '/platform-v7/staff/prepare?format=json') return json({ ok: true, csrfToken: 'a'.repeat(32) });
      if (path === '/api/staff/access/sessions/session-1/end') {
        endRequests += 1;
        ended = true;
        throw new TypeError('test response lost after commit');
      }
      throw new Error(`Unexpected staff request: ${path}`);
    }));

    const view = render(createElement(RoleModeCenter, props));
    await waitFor(() => expect(view.getByText('private-ended-deal')).toBeInTheDocument());
    fireEvent.click(view.getByRole('button', { name: 'Завершить режим и вернуться в Control Center' }));
    await waitFor(() => expect(view.queryByText('private-ended-deal')).toBeNull());
    expect(view.container.querySelector('[data-founder-role-mode-active]')).toBeNull();
    expect(endRequests).toBe(1);

    await act(async () => { releaseReconciliation(json({ active: false, session: null })); });
    await waitFor(() => expect(view.getByText('ID реальной организации')).toBeInTheDocument());
    expect(view.queryByText('private-ended-deal')).toBeNull();
    expect(view.container.querySelector('[data-founder-role-mode-active]')).toBeNull();
    expect(endRequests).toBe(1);
  });

  it('removes an active VIEW_AS projection when canonical revalidation fails', async () => {
    const { session, registry, canonical, props } = roleModeFixtures();
    let registryUnavailable = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode') return json(registryUnavailable ? { code: 'UNAVAILABLE' } : registry, registryUnavailable ? 503 : 200);
      if (path === '/api/staff/session-context') return json({ active: true, session });
      if (path === '/api/staff/access/sessions') return json([{ id: session.accessSessionId, status: 'ACTIVE' }]);
      if (path === '/api/staff/founder/role-mode/session') return json(canonical);
      if (path === '/api/staff/organizations/organization-1/cabinet/BUYER') return json({ deals: [] });
      throw new Error(`Unexpected staff request: ${path}`);
    }));

    const view = render(createElement(RoleModeCenter, props));
    await waitFor(() => expect(view.container.querySelector('[data-founder-role-mode-active]')).not.toBeNull());

    registryUnavailable = true;
    view.rerender(createElement(RoleModeCenter, { ...props, locale: 'en', copy: ownerAccessCenterMessages.en }));
    await waitFor(() => expect(view.container.querySelector('[role="alert"]')).not.toBeNull());
    expect(view.container.querySelector('[data-founder-role-mode-active]')).toBeNull();
    expect(view.container.querySelectorAll('article')).toHaveLength(0);
  });

  it('ignores an older successful read after a newer session revalidation fails', async () => {
    const { session, registry, canonical, props } = roleModeFixtures();
    let releaseFirstRegistry!: (response: Response) => void;
    const firstRegistry = new Promise<Response>((resolve) => { releaseFirstRegistry = resolve; });
    let registryReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode') return ++registryReads === 1 ? firstRegistry : json({ code: 'UNAVAILABLE' }, 503);
      if (path === '/api/staff/session-context') return json({ active: true, session });
      if (path === '/api/staff/access/sessions') return json([{ id: session.accessSessionId, status: 'ACTIVE' }]);
      if (path === '/api/staff/founder/role-mode/session') return json(canonical);
      throw new Error(`Unexpected staff request: ${path}`);
    }));

    const view = render(createElement(RoleModeCenter, props));
    await waitFor(() => expect(registryReads).toBe(1));
    view.rerender(createElement(RoleModeCenter, { ...props, locale: 'en', copy: ownerAccessCenterMessages.en }));
    await waitFor(() => expect(view.container.querySelector('[role="alert"]')).not.toBeNull());
    await act(async () => { releaseFirstRegistry(json(registry)); });

    expect(view.container.querySelector('[data-founder-role-mode-active]')).toBeNull();
    expect(view.container.querySelectorAll('article')).toHaveLength(0);
  });

  it('blocks every cabinet when the initial protected-session read is unavailable', async () => {
    const { registry, props } = roleModeFixtures();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode') return json(registry);
      if (path === '/api/staff/session-context') return json({ code: 'UNAVAILABLE' }, 503);
      if (path === '/api/staff/access/sessions') return json([]);
      if (path === '/api/staff/founder/role-mode/session') return json({ code: 'ROLE_MODE_SESSION_INACTIVE' }, 401);
      throw new Error(`Unexpected staff request: ${path}`);
    }));

    const view = render(createElement(RoleModeCenter, props));
    await waitFor(() => expect(view.container.querySelector('[role="alert"]')).not.toBeNull());
    expect(view.container.textContent).toContain('Состояние защищённой сессии не подтверждено');
    expect(view.queryAllByRole('button', { name: 'Открыть read-only' })).toHaveLength(0);
    expect(view.getByRole('button', { name: 'Повторить проверку сессии' })).toBeEnabled();
  });

  it('requires reconciliation before another open when activation succeeds but canonical verification fails', async () => {
    const { registry, canonical, props } = roleModeFixtures();
    let activationAttempted = false;
    let requestCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode' && init?.method === 'POST') {
        requestCount += 1;
        return json({ grantId: 'grant-1', roleMode: {
          cabinetKey: 'buyer', canonicalPath: '/platform-v7/buyer', effectiveRole: 'BUYER',
          effectiveOrganizationId: 'organization-1', mode: 'VIEW_AS', readOnly: true,
        } });
      }
      if (path === '/platform-v7/staff/role-mode') return json(registry);
      if (path === '/platform-v7/staff/prepare?format=json') return json({ ok: true, csrfToken: 'a'.repeat(32) });
      if (path === '/api/staff/access/grants/grant-1/activate') {
        activationAttempted = true;
        return json({ ok: true });
      }
      if (path === '/api/staff/session-context') return json({ active: false, session: null });
      if (path === '/api/staff/access/sessions') return json(activationAttempted ? [{ id: canonical.accessSessionId, status: 'ACTIVE' }] : []);
      if (path === '/api/staff/founder/role-mode/session') return json({ code: 'ROLE_MODE_SESSION_INACTIVE' }, 401);
      if (path === '/api/staff/organizations/organization-1/cabinet/BUYER') return json({ deals: [] });
      throw new Error(`Unexpected staff request: ${path}`);
    }));

    const view = render(createElement(RoleModeCenter, props));
    await waitFor(() => expect(view.getByText('ID реальной организации')).toBeInTheDocument());
    fireEvent.change(view.getByLabelText(/ID реальной организации/), { target: { value: 'organization-1' } });
    fireEvent.change(view.getByLabelText(/Тикет/), { target: { value: 'ticket-1' } });
    fireEvent.change(view.getByLabelText(/Причина просмотра/), { target: { value: 'Проверка работы кабинета' } });
    const buyer = view.getAllByRole('button', { name: 'Открыть read-only' })[1];
    expect(buyer).toBeEnabled();
    fireEvent.click(buyer);

    await waitFor(() => expect(view.getByRole('button', { name: 'Повторить проверку сессии' })).toBeEnabled());
    expect(activationAttempted).toBe(true);
    expect(view.container.querySelector('[data-founder-role-mode-active]')).toBeNull();
    expect(view.container.textContent).toContain('Состояние защищённой сессии не подтверждено');
    expect(view.getAllByRole('button', { name: 'Открыть read-only' }).every((button) => button.hasAttribute('disabled'))).toBe(true);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    expect(requestCount).toBe(1);

    // The next read may discover the durable session; it must not create another grant.
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode') return json(registry);
      if (path === '/api/staff/session-context') return json({ active: true, session: {
        accessSessionId: canonical.accessSessionId, accessMode: 'VIEW_AS', permissions: ['cabinet:view-as'],
        effectiveOrganizationId: canonical.effectiveOrganizationId, effectiveRole: canonical.effectiveRole,
        expiresAt: canonical.expiresAt,
      } });
      if (path === '/api/staff/access/sessions') return json([{ id: canonical.accessSessionId, status: 'ACTIVE' }]);
      if (path === '/api/staff/founder/role-mode/session') return json(canonical);
      if (path === '/api/staff/organizations/organization-1/cabinet/BUYER') return json({ deals: [] });
      throw new Error(`Unexpected staff request: ${path}`);
    }));
    fireEvent.click(view.getByRole('button', { name: 'Повторить проверку сессии' }));
    await waitFor(() => expect(view.container.querySelector('[data-founder-role-mode-active]')).not.toBeNull());
    expect(requestCount).toBe(1);
  });

  it('revalidates the V3 projection after advanced access management ends its session', async () => {
    const { session, registry, canonical, props } = roleModeFixtures();
    let active = true;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode') return json(registry);
      if (path === '/api/staff/session-context') return json(active ? { active: true, session } : { active: false, session: null });
      if (path === '/api/staff/access/sessions') return json(active ? [{ id: session.accessSessionId, status: 'ACTIVE' }] : []);
      if (path === '/api/staff/founder/role-mode/session') return active ? json(canonical) : json({ code: 'ROLE_MODE_SESSION_INACTIVE' }, 401);
      if (path === '/api/staff/organizations/organization-1/cabinet/BUYER') return json({ deals: [] });
      if (path.startsWith('/api/staff/')) return json([]);
      throw new Error(`Unexpected staff request: ${path}`);
    }));

    const view = render(createElement(RoleModeCenter, props));
    await waitFor(() => expect(view.container.querySelector('[data-founder-role-mode-active]')).not.toBeNull());
    fireEvent.click(view.getByRole('button', { name: 'Управление сотрудниками и доступами' }));
    active = false;
    await act(async () => { window.dispatchEvent(new Event('pc:staff-session-changed')); });
    fireEvent.click(view.getByRole('button', { name: /Вернуться ко всем кабинетам/ }));
    await waitFor(() => expect(view.container.querySelector('[data-founder-role-mode-active]')).toBeNull());
  });

  it('blocks CONTROL_PLANE bootstrap when a VIEW_AS session becomes active', async () => {
    const { session, registry, canonical, props } = roleModeFixtures();
    let active = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode') return json(registry);
      if (path === '/api/staff/session-context') return json(active ? { active: true, session } : { active: false, session: null });
      if (path === '/api/staff/access/sessions') return json(active ? [{ id: session.accessSessionId, status: 'ACTIVE' }] : []);
      if (path === '/api/staff/founder/role-mode/session') return active ? json(canonical) : json({ code: 'ROLE_MODE_SESSION_INACTIVE' }, 401);
      if (path === '/api/staff/organizations/organization-1/cabinet/BUYER') return json({ deals: [] });
      throw new Error(`Unexpected staff request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = render(createElement(BootstrapCenter, props));
    await waitFor(() => expect(view.getByRole('button', { name: 'Открыть доступ на 30 минут' })).toBeEnabled());
    active = true;
    await act(async () => { window.dispatchEvent(new Event('pc:staff-session-changed')); });
    await waitFor(() => expect(view.queryByRole('button', { name: 'Открыть доступ на 30 минут' })).toBeNull());
    expect(view.container.querySelector('[data-p0-registration-access-bootstrap]')?.textContent).toContain('Другая защищённая сессия уже открыта');
    expect(fetchMock.mock.calls.some(([path]) => String(path).includes('/activate'))).toBe(false);
  });

  it('reserves both mounted activators while a role-mode request is still in flight', async () => {
    const { registry, props } = roleModeFixtures();
    let completeRequest!: (response: Response) => void;
    const pendingRequest = new Promise<Response>((resolve) => { completeRequest = resolve; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode' && init?.method === 'POST') return pendingRequest;
      if (path === '/platform-v7/staff/role-mode') return json(registry);
      if (path === '/platform-v7/staff/prepare?format=json') return json({ ok: true, csrfToken: 'a'.repeat(32) });
      if (path === '/api/staff/session-context') return json({ active: false, session: null });
      if (path === '/api/staff/access/sessions') return json([]);
      if (path === '/api/staff/founder/role-mode/session') return json({ code: 'ROLE_MODE_SESSION_INACTIVE' }, 401);
      throw new Error(`Unexpected staff request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const view = render(createElement(BootstrapCenter, props));
    await waitFor(() => expect(view.getByRole('button', { name: 'Открыть доступ на 30 минут' })).toBeEnabled());
    fireEvent.change(view.getByLabelText(/ID реальной организации/), { target: { value: 'organization-1' } });
    fireEvent.change(view.getByLabelText(/Тикет/), { target: { value: 'ticket-1' } });
    fireEvent.change(view.getByLabelText(/Причина просмотра/), { target: { value: 'Проверка работы кабинета' } });
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(fetchMock.mock.calls.some(([path, init]) => String(path) === '/platform-v7/staff/role-mode' && init?.method === 'POST')).toBe(true));
    expect(view.queryByRole('button', { name: 'Открыть доступ на 30 минут' })).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Проверить ещё раз' }));
    expect(fetchMock.mock.calls.some(([path]) => String(path) === '/api/staff/access/requests')).toBe(false);
    await act(async () => { completeRequest(json({ status: 'PENDING', grantId: null, roleMode: {
      cabinetKey: 'buyer', canonicalPath: '/platform-v7/buyer', effectiveRole: 'BUYER',
      effectiveOrganizationId: 'organization-1', mode: 'VIEW_AS', readOnly: true,
    } })); });
  });

  it('removes a protected projection at expiry and reconciles durable authority', async () => {
    const { session, registry, canonical, props } = roleModeFixtures();
    const expiresAt = new Date(Date.now() + 600).toISOString();
    session.expiresAt = expiresAt;
    canonical.expiresAt = expiresAt;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      const active = Date.now() < Date.parse(expiresAt);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode') return json(registry);
      if (path === '/api/staff/session-context') return json(active ? { active: true, session } : { active: false, session: null });
      if (path === '/api/staff/access/sessions') return json(active ? [{ id: session.accessSessionId, status: 'ACTIVE' }] : []);
      if (path === '/api/staff/founder/role-mode/session') return active ? json(canonical) : json({ code: 'ROLE_MODE_SESSION_INACTIVE' }, 401);
      if (path === '/api/staff/organizations/organization-1/cabinet/BUYER') return json({ deals: [{ id: 'private-deal' }] });
      throw new Error(`Unexpected staff request: ${path}`);
    }));
    const view = render(createElement(RoleModeCenter, props));
    await waitFor(() => expect(view.container.querySelector('[data-founder-role-mode-active]')).not.toBeNull());
    await waitFor(() => expect(view.container.textContent).toContain('private-deal'));
    await waitFor(() => expect(view.container.querySelector('[data-founder-role-mode-active]')).toBeNull(), { timeout: 2500 });
    expect(view.container.textContent).not.toContain('private-deal');
  });

  it('treats an inactive cookie with a durable own session as unresolved', async () => {
    const { registry, props } = roleModeFixtures();
    let ownSessions = [{ id: 'committed-without-cookie', status: 'ACTIVE' }];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === '/api/staff/assignments/me') return json([{ id: 'owner-1', role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
      if (path === '/platform-v7/staff/role-mode') return json(registry);
      if (path === '/api/staff/session-context') return json({ active: false, session: null });
      if (path === '/api/staff/access/sessions') return json(ownSessions);
      if (path === '/api/staff/founder/role-mode/session') return json({ code: 'ROLE_MODE_SESSION_INACTIVE' }, 401);
      throw new Error(`Unexpected staff request: ${path}`);
    }));

    const view = render(createElement(BootstrapCenter, props));
    await waitFor(() => expect(view.container.querySelector('[data-p0-registration-access-bootstrap]')?.textContent)
      .toContain('Другая защищённая сессия уже открыта'));
    expect(view.queryByRole('button', { name: 'Открыть доступ на 30 минут' })).toBeNull();
    expect(view.queryAllByRole('button', { name: 'Открыть read-only' }).every((button) => button.hasAttribute('disabled'))).toBe(true);

    ownSessions = [];
    await act(async () => { window.dispatchEvent(new Event('pc:staff-session-changed')); });
    await waitFor(() => expect(view.getByRole('button', { name: 'Открыть доступ на 30 минут' })).toBeEnabled());
    fireEvent.change(view.getByLabelText(/ID реальной организации/), { target: { value: 'organization-1' } });
    fireEvent.change(view.getByLabelText(/Тикет/), { target: { value: 'ticket-1' } });
    fireEvent.change(view.getByLabelText(/Причина просмотра/), { target: { value: 'Проверка работы кабинета' } });
    await waitFor(() => expect(view.getAllByRole('button', { name: 'Открыть read-only' }).every((button) => !button.hasAttribute('disabled'))).toBe(true));
  });

  it('consumes the server-owned exact 13-cabinet role-mode registry', () => {
    expect(page).toContain('<OwnerAccessCenter');
    expect(entry).toContain("export { OwnerAccessCenter } from './OwnerAccessCenterV4'");
    expect(bootstrap).toContain('<OwnerAccessCenterV3 {...props} openingCoordinator={openingCoordinator.current} />');
    expect(directCenter).toContain("row.schemaVersion !== 'pc-crop.founder-role-mode.v1'");
    expect(directCenter).toContain("row.mode !== 'VIEW_AS'");
    expect(directCenter).toContain('row.readOnly !== true');
    expect(directCenter).toContain('row.cabinets.length !== 13');
    expect(directCenter).toContain('registry?.cabinets.map');
    expect(directCenter).not.toContain('CONTROLLED_CABINET_CONTEXTS');
    expect(directCenter).not.toContain('controlled-test-organizations');
    expect(directCenter).not.toContain('action="/platform-v7/staff/open-cabinet/submit"');
    expect(directCenter).not.toContain('window.sessionStorage');
    expect(directCenter).not.toContain('PLATFORM_V7_ACTIVE_ROLE_KEY');
  });

  it('uses a bounded staff bridge that cannot accept client tenant or effective-role authority', () => {
    expect(roleModeRoute).toContain('/staff/founder/role-mode/registry');
    expect(roleModeRoute).toContain('/staff/founder/role-mode/requests');
    expect(roleModeRoute).toContain("request.nextUrl.searchParams.get('view') === 'session'");
    expect(roleModeRoute).toContain("code: 'ROLE_MODE_SESSION_USE_STAFF_BFF'");
    expect(roleModeRoute).not.toContain('pc_staff_access_token');
    expect(roleModeRoute).not.toContain("'x-staff-access-session'");
    expect(canonicalStaffBff).toContain("'founder/role-mode/session'");
    expect(canonicalStaffBff).toContain("'x-staff-access-session': staffAccessToken");
    expect(roleModeRoute).toContain('assertCsrf(request)');
    expect(roleModeRoute).toContain('readBoundedBody(request.body, MAX_BODY_BYTES)');
    expect(roleModeRoute).toContain('cabinetKey');
    expect(roleModeRoute).toContain('organizationId');
    expect(roleModeRoute).toContain('reason');
    expect(roleModeRoute).toContain('ticketId');
    expect(roleModeRoute).toContain('durationSeconds');
    expect(roleModeRoute).not.toContain('targetTenantId');
    expect(roleModeRoute).not.toContain('targetRole');
    expect(roleModeRoute).not.toContain('effectiveTenantId:');
    expect(roleModeRoute).toContain('requiresCanonicalControlHost(request)');
    expect(roleModeRoute).toContain('delete safePayload.accessToken');
  });

  it('repairs missing or stale CSRF before every founder role-mode request', () => {
    expect(page).toContain("(verification.status === 'verified' || verification.status === 'password') && !csrfToken");
    expect(page).toContain("redirect('/platform-v7/staff/prepare')");
    expect(prepareRoute).toContain("request.nextUrl.searchParams.get('format') === 'json'");
    expect(prepareRoute).toContain("NextResponse.json({ ok: true, csrfToken: token })");
    expect(prepareRoute).toContain('response.cookies.set(CSRF_COOKIE');
    expect(directCenter).toContain("fetch('/platform-v7/staff/prepare?format=json'");
    expect(directCenter).toContain('let token = await refreshCsrf(controller.signal)');
    expect(directCenter).toContain("requested.payload?.code === 'CSRF_REJECTED'");
    expect(directCenter).toContain("'X-CSRF-Token': token");
  });

  it('activates the durable grant and re-verifies the canonical Founder session before display', () => {
    expect(directCenter).toContain("fetch(`/api/staff/access/grants/${encodeURIComponent(requested.payload.grantId)}/activate`");
    expect(directCenter).toContain("fetch('/api/staff/session-context'");
    expect(directCenter.match(/fetch\('\/api\/staff\/founder\/role-mode\/session'/g)).toHaveLength(2);
    expect(directCenter).not.toContain('/platform-v7/staff/role-mode?view=session');
    expect(directCenter).toContain("canonical.schemaVersion !== 'pc-crop.founder-role-mode.v1'");
    expect(directCenter).toContain("canonical.mode !== 'VIEW_AS'");
    expect(directCenter).toContain('canonical.readOnly !== true');
    expect(directCenter).toContain('canonical.mfaRequired !== true');
    expect(directCenter).toContain('canonical.accessSessionId !== session.accessSessionId');
    expect(directCenter).toContain('canonical.effectiveOrganizationId !== roleMode.effectiveOrganizationId');
    expect(directCenter).toContain('canonical.effectiveRole !== roleMode.effectiveRole');
    expect(directCenter).toContain("session.permissions.includes('cabinet:view-as')");
    expect(directCenter).toContain('session.effectiveOrganizationId !== canonical.effectiveOrganizationId');
    expect(directCenter).toContain('session.effectiveRole !== canonical.effectiveRole');
    expect(directCenter).toContain('actorDisplayName: canonical.actor.displayName');
    expect(directCenter).toContain('<dd>{activeMode.actorDisplayName}</dd>');
    expect(directCenter).toContain('data-founder-role-mode-active');
    expect(directCenter).toContain('activeMode.restrictions.map');
  });

  it('renders only the delegated cabinet projection and keeps canonicalPath as non-authoritative metadata', () => {
    expect(directCenter).toContain("fetch(`/api/staff/organizations/${organization}/cabinet/${role}`");
    expect(directCenter).toContain('activeMode.canonicalPath');
    expect(directCenter).toContain('text.transportPending');
    expect(directCenter).not.toContain('window.location.replace(activeMode.canonicalPath)');
    expect(directCenter).not.toContain('window.location.assign(activeMode.canonicalPath)');
    expect(directCenter).not.toContain('window.location.href = activeMode.canonicalPath');
    expect(directCenter).toContain('projection?.deals?.length');
    expect(directCenter).toContain('sessionContext.active');
    expect(directCenter).toContain('text.protectedSessionActive');
  });

  it('ends the exact delegated session before using the server return path', () => {
    expect(directCenter).toContain("fetch(`/api/staff/access/sessions/${encodeURIComponent(sessionId)}/end`");
    expect(directCenter).toContain("body: JSON.stringify({ reason: 'Founder ended read-only role mode from Control Center' })");
    expect(directCenter).toContain('const returnPath = activeMode?.returnPath || registry?.returnPath');
    expect(directCenter).toContain("returnPath?.startsWith('/platform-v7/staff')");
    expect(directCenter).toContain('window.location.assign(returnPath)');
  });

  it('keeps owner authority server verified and refuses a fake or partial registry', () => {
    expect(directCenter).toContain("item.role === 'PLATFORM_OWNER' && item.status === 'ACTIVE'");
    expect(directCenter).toContain('!cabinet.canonicalPath.startsWith');
    expect(directCenter).toContain('seen.has(cabinet.key)');
    expect(directCenter).toContain("roleMode.mode !== 'VIEW_AS'");
    expect(directCenter).toContain('roleMode.readOnly !== true');
    expect(roleModeRoute).toContain("Authorization: `Bearer ${accessToken}`");
    expect(roleModeRoute).toContain("redirect: 'manual'");
  });

  it('retains the protected advanced staff surface without merging its authority into role mode', () => {
    expect(directCenter).toContain('<OwnerAccessCenterV2 {...baseProps} />');
    expect(page).toContain('accessCatalog={staffAccessTaskCatalog()}');
    expect(catalog).toContain("id: 'view_cabinet'");
    expect(center).toContain('permissions: selectedPermissions');
    expect(deferred).toContain("fetch('/api/staff/session-context'");
    expect(deferred).toContain('if (!ready || !active) return null');
  });

  it('keeps the separate bounded manage-staff CONTROL_PLANE bootstrap unchanged', () => {
    expect(bootstrap).toContain("item.role === 'PLATFORM_OWNER' && item.status === 'ACTIVE'");
    expect(bootstrap).toContain("accessMode: 'CONTROL_PLANE'");
    expect(bootstrap).toContain("'staff-request:read'");
    expect(bootstrap).toContain("'staff-request:approve'");
    expect(bootstrap).toContain("ticketId: 'PC-CROP-3785'");
    expect(bootstrap).toContain('durationSeconds: 30 * 60');
    expect(bootstrap).toContain("fetch('/api/staff/access/requests'");
    expect(bootstrap).toContain("fetch(`/api/staff/access/grants/${encodeURIComponent(grantId)}/activate`");
    expect(bootstrap).not.toContain('break-glass');
    expect(bootstrap).not.toContain('localStorage');
    expect(bootstrap).not.toContain('sessionStorage');
  });

  it('remains RU/EN/ZH, mobile-first, keyboard-visible and safe-area aware', () => {
    expect(directCenter).toContain('ru: {');
    expect(directCenter).toContain('en: {');
    expect(directCenter).toContain('zh: {');
    expect(directCss).toContain('@media (max-width: 520px)');
    expect(directCss).toContain('grid-template-columns: 1fr');
    expect(directCss).toContain('min-height: 54px');
    expect(directCss).toContain(':focus-visible');
    expect(directCss).toContain('env(safe-area-inset-bottom)');
    expect(bootstrapCss).toContain('@media (max-width: 640px)');
    expect(keys(ownerAccessCenterMessages.en)).toEqual(keys(ownerAccessCenterMessages.ru));
    expect(keys(ownerAccessCenterMessages.zh)).toEqual(keys(ownerAccessCenterMessages.ru));
  });
});

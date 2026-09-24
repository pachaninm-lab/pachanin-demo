import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ownerAccessCenterMessages } from '../../i18n/owner-access-center-messages';
import { OwnerAccessCenter as RoleModeCenter } from '../../components/platform-v7/staff/OwnerAccessCenterV3';
import { OwnerAccessCenter as BootstrapCenter } from '../../components/platform-v7/staff/OwnerAccessCenterV4';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
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
    effectiveOrganizationId: 'organization-1', effectiveRole: 'BUYER', expiresAt: '2026-09-24T00:00:00Z',
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
    expect(bootstrap).toContain('<OwnerAccessCenterV3 {...props} />');
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
    expect(page).toContain("verification.status === 'verified' && !csrfToken");
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

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerAccessCenter as RoleModeCenter, OWNER_REGISTRATION_PERMISSIONS, prepareOwnerCreate, completeOwnerCreate, readOwnerPendingCreate } from '../../components/platform-v7/staff/OwnerAccessCenterV3';
import { OwnerAccessCenter as BootstrapCenter } from '../../components/platform-v7/staff/OwnerAccessCenterV4';
import { ownerAccessCenterMessages } from '../../i18n/owner-access-center-messages';
import { ACCESS_COOKIE, CSRF_COOKIE } from '../../lib/auth-cookies';
import { CONTROL_PLATFORM_HOST } from '../../lib/platform-v7/control-host';
import { clearClientSessionState } from '../../lib/client-session-cleanup';
import {
  CONTROLLED_CABINET_CONTEXTS,
  CONTROLLED_TEST_ORGANIZATIONS,
  controlledCabinetContext,
  controlledOrganizationById,
} from '../../lib/platform-v7/controlled-test-organizations';

/**
 * Repo-root resolution, not cwd resolution.
 *
 * These paths are repo-root relative, but vitest runs with cwd at apps/web, so
 * resolve(process.cwd(), ...) pointed inside the web package. Every apps/web
 * path still opened, because apps/web/apps/web holds committed symlinks back to
 * apps/web - so the bug was invisible until a path reached apps/api, where no
 * such symlink exists, and then the whole file failed to load. Walking up to
 * the .git directory resolves from where the paths are actually written from,
 * and does not depend on those symlinks existing.
 */
function repoRoot(): string {
  let dir = __dirname;
  while (!existsSync(join(dir, '.git')) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
}

const read = (path: string) => readFileSync(resolve(repoRoot(), path), 'utf8');

/** Comments become whitespace, so prose about retired code is not read as code. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/gu, '$1 ');
}
const ownerCenter = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV3.tsx');
const openCabinet = read('apps/web/app/platform-v7/staff/open-cabinet/route.ts');
const staffFixture = read('apps/web/app/staff/[...path]/route.ts');
const verifiedSession = read('apps/web/lib/platform-v7/verified-session.ts');
const handoffPage = read('apps/web/app/platform-v7/staff/cabinet-handoff/page.tsx');
const canonicalSeed = read('apps/api/src/modules/deals/canonical-test-deal.seed.ts');
const persistentActors = read('apps/api/test/one-deal/persistent-auth-actors.ts');

const roles = [
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
  'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
] as const;

describe('Platform V7 controlled test organization network', () => {
  it('creates a coherent test-company network for every cabinet', () => {
    expect(CONTROLLED_TEST_ORGANIZATIONS).toHaveLength(9);
    expect(new Set(CONTROLLED_TEST_ORGANIZATIONS.map((item) => item.id)).size).toBe(9);
    expect(CONTROLLED_TEST_ORGANIZATIONS.every((item) => item.testData === true)).toBe(true);
    expect(CONTROLLED_TEST_ORGANIZATIONS.every((item) => item.status === 'ACTIVE')).toBe(true);
    expect(CONTROLLED_TEST_ORGANIZATIONS.every((item) => item.kycStatus === 'VERIFIED')).toBe(true);
    expect(CONTROLLED_TEST_ORGANIZATIONS.every((item) => item.amlStatus === 'CLEAR')).toBe(true);

    for (const role of roles) {
      const context = CONTROLLED_CABINET_CONTEXTS[role];
      expect(context.role).toBe(role);
      expect(controlledOrganizationById(context.organizationId)?.name).toBe(context.organizationName);
      expect(context.memberEmail).toBe(`${role}.test@procent-agro.test`);
      expect(controlledCabinetContext(context.apiRole)?.role).toBe(role);
    }
  });

  it('keeps controlled fixtures separate from the canonical Founder role-mode selector', () => {
    expect(ownerCenter).not.toContain('CONTROLLED_CABINET_CONTEXTS');
    expect(ownerCenter).toContain("row.schemaVersion !== 'pc-crop.founder-role-mode.v1'");
    expect(ownerCenter).toContain('row.cabinets.length !== 13');
    expect(ownerCenter).toContain('registry?.cabinets.map');
    expect(ownerCenter).toContain('organizationId.trim().length < 3');
    expect(ownerCenter).toContain("organizationHint: 'Введите ID организации, доступной владельцу. Контролируемые тестовые организации сервер отклоняет.'");
    expect(ownerCenter).toContain("fetch('/api/staff/founder/role-mode/session'");
    expect(ownerCenter).toContain("canonical.mode === 'VIEW_AS'");
    expect(ownerCenter).toContain('canonical.readOnly === true');
    expect(ownerCenter).not.toContain('owner-controlled-test');
  });

  it('binds the signed owner cabinet session to a server-approved organization', () => {
    expect(openCabinet).toContain('resolveControlledOrganization');
    // Same rule, written the other way round since this test was pinned: the
    // controlled fixture must submit the organization the server expects. The
    // positive form is what the route carries now.
    expect(openCabinet).toContain("authority.source === 'controlled'");
    expect(openCabinet).toContain('submittedOrganizationId !== context.organizationId');
    // Tightened since this was pinned: the organization is resolved before the
    // session is signed and can no longer be null, so the optional form these
    // asserted would now be a loosening rather than a match.
    expect(openCabinet).toContain('organizationId: organization.organizationId');
    expect(openCabinet).toContain('tenantId: organization.tenantId');
    expect(openCabinet).not.toContain('organizationId: organization?.organizationId || null');
    expect(openCabinet).toContain('ownerAccess: true');
    expect(verifiedSession).toContain('readVerifiedCabinetSessionContext');
    expect(verifiedSession).toContain('organizationId: typeof claims.org');
    expect(handoffPage).toContain('controlledOrganizationById(context.organizationId)');
  });

  it('exposes all test companies and role memberships through the controlled staff fixture', () => {
    expect(staffFixture).toContain("path === 'organizations'");
    expect(staffFixture).toContain('CONTROLLED_TEST_ORGANIZATIONS');
    expect(staffFixture).toContain('organizationMembers(organization.id)');
    expect(staffFixture).toContain('organization_name: item.organizationName');
    expect(staffFixture).toContain("id: 'deal-canonical-test'");
    expect(staffFixture).toContain('testData: true');
  });

  it('demotes stale default memberships before moving a seeded user to another organization', () => {
    expect(canonicalSeed).toContain('await tx.userOrg.updateMany({');
    expect(canonicalSeed).toContain('NOT: { organizationId: identity.orgId }');
    expect(canonicalSeed).toContain('data: { isDefault: false }');
    expect(canonicalSeed.indexOf('await tx.userOrg.updateMany({')).toBeLessThan(
      canonicalSeed.indexOf('const membership = await tx.userOrg.upsert({'),
    );
  });

  /**
   * This asserted the harness rediscovered its actors by querying organizations
   * and tenants directly. That mechanism was retired, and what replaced it is
   * stronger rather than weaker: the harness enters through AuthService.login
   * exactly as a real client does - credential lookup, password proof, then the
   * bounded membership lookup - and reads role, tenant and organization only
   * from the resulting server-side session projection.
   *
   * Demanding the old query back would be demanding a regression, so the
   * contract is asserted instead: real login in, server projection out, and the
   * retired resolver functions stay retired.
   */
  it('resolves every canonical actor through the real login path, not by querying identities', () => {
    expect(persistentActors).toContain('primaryAuth.login({');
    expect(persistentActors).toContain('PERSISTENT_ACTOR_USER_IDS');
    // Comments are stripped first. The file explains in prose which resolvers
    // were retired, and a scanner that counted that explanation as a live call
    // would report the opposite of the truth - the better the comment, the
    // louder the false positive.
    const actorCode = stripComments(persistentActors);
    expect(actorCode).not.toContain('resolve_login_identity');
    expect(actorCode).not.toContain('resolve_login_memberships');
    // The connection principal is still pinned, so the harness cannot silently
    // gain a wider database identity than the one it is meant to prove against.
    expect(persistentActors).toContain("currentUser !== 'one_deal_auth'");
  });
});

// These behavioral cases stay in the existing native-selected file. The staged
// TaskUx exclusion and CI selector are deliberately unchanged.
const INTENT_FIXTURE = '11111111-1111-4111-8111-111111111111';
function ownerJson(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }); }
function ownerModel(options: { lostCreate?: 'committed' | 'absent'; lostActivation?: boolean; context404?: boolean; csrfReject?: boolean; projection?: 'revoked' | 'expired' } = {}) {
  const cabinets = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'organization', 'arbitrator', 'compliance', 'executive']
    .map((key) => ({ key, canonicalPath: `/platform-v7/${key}`, effectiveRole: 'BUYER' }));
  const registry = { schemaVersion: 'pc-crop.founder-role-mode.v1', mode: 'VIEW_AS', readOnly: true,
    returnPath: '/platform-v7/staff', restrictions: [], cabinets };
  const props = { locale: 'ru' as const, copy: ownerAccessCenterMessages.ru,
    identity: { id: 'owner-user-1', email: 'owner@example.test' }, apiAvailable: true, accessCatalog: [], csrfToken: 'a'.repeat(32) };
  const postBodies: Array<Record<string, unknown>> = [];
  const calls: Array<{ path: string; method: string }> = [];
  let receipt: Record<string, unknown> | null = null;
  let kind: 'founder' | 'registration' = 'founder';
  let durable = false;
  let cookie = false;
  let activationPosts = 0;
  let committedCreates = 0;
  let rejectedCsrf = false;
  let assignmentId = 'owner-1';
  const canonical = { ...registry, active: true, accessSessionId: 'session-1', actor: { displayName: 'Owner' },
    cabinetKey: 'buyer', canonicalPath: '/platform-v7/buyer', effectiveRole: 'BUYER', effectiveOrganizationId: 'organization-1',
    effectiveTenantId: 'tenant-1', expiresAt: options.projection === 'expired' ? '2000-09-24T00:00:00Z' : '2099-09-24T00:00:00Z', ticketId: 'ticket-1', mfaRequired: true };
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input); const method = init?.method || 'GET'; calls.push({ path, method });
    if (path === '/api/staff/assignments/me') return ownerJson([{ id: assignmentId, role: 'PLATFORM_OWNER', status: 'ACTIVE' }]);
    if (path.startsWith('/platform-v7/staff/role-mode?view=create-intent')) {
      if (!receipt || options.context404) return ownerJson({ message: 'Create intent not found' }, 404);
      return ownerJson({ createIntentId: receipt.createIntentId, originalReceipt: receipt,
        currentProjection: { requestId: 'request-1', requestStatus: 'GRANTED', grantId: 'grant-1', grantStatus: options.projection === 'revoked' ? 'REVOKED' : 'ACTIVE',
          expiresAt: canonical.expiresAt, activationEligible: !options.projection, requiresLiveActivationChecks: true } });
    }
    if (method === 'POST' && (path === '/platform-v7/staff/role-mode' || path === '/api/staff/access/requests')) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>; postBodies.push(body);
      if (options.csrfReject && !rejectedCsrf) { rejectedCsrf = true; return ownerJson({ code: 'CSRF_REJECTED' }, 403); }
      if (receipt && options.context404) return ownerJson({ message: 'Create intent not found' }, 404);
      kind = path === '/platform-v7/staff/role-mode' ? 'founder' : 'registration';
      if (postBodies.length === 1 && options.lostCreate === 'absent') throw new TypeError('Lost request before commit');
      if (!receipt) {
        committedCreates += 1;
        receipt = { createIntentId: body.createIntentId, requestId: 'request-1', status: 'GRANTED', grantId: 'grant-1', expiresAt: canonical.expiresAt,
          ...(kind === 'founder' ? { schemaVersion: registry.schemaVersion, roleMode: canonical } : {}) };
      }
      if (postBodies.length === 1 && options.lostCreate === 'committed') throw new TypeError('Committed create reply lost');
      return ownerJson(receipt);
    }
    if (path === '/platform-v7/staff/role-mode') return ownerJson(registry);
    if (path === '/platform-v7/staff/prepare?format=json') return ownerJson({ ok: true, csrfToken: 'b'.repeat(32) });
    if (path === '/api/staff/access/grants/grant-1/activate') {
      activationPosts += 1; durable = true;
      if (options.lostActivation) throw new TypeError('Activation committed without a delivered bearer');
      cookie = true;
      return ownerJson({ accessSessionId: 'session-1' });
    }
    if (path === '/api/staff/session-context') return ownerJson({ active: cookie, session: cookie ? {
      accessSessionId: 'session-1', accessMode: kind === 'founder' ? 'VIEW_AS' : 'CONTROL_PLANE',
      permissions: kind === 'founder' ? ['cabinet:view-as'] : [...OWNER_REGISTRATION_PERMISSIONS],
      effectiveOrganizationId: 'organization-1', effectiveRole: 'BUYER', expiresAt: canonical.expiresAt,
    } : null });
    if (path === '/api/staff/access/sessions') return ownerJson(durable ? [{ id: 'session-1', status: 'ACTIVE', grant_id: 'grant-1' }] : []);
    if (path === '/api/staff/founder/role-mode/session') return cookie && kind === 'founder' ? ownerJson(canonical) : ownerJson({ code: 'ROLE_MODE_SESSION_INACTIVE' }, 401);
    if (path === '/api/staff/organizations/organization-1/cabinet/BUYER') return ownerJson({ deals: [{ id: 'deal-protected', dealNumber: 'PRIVATE-DEAL' }] });
    throw new Error(`Unexpected owner fixture request: ${path}`);
  });
  return { props, fetcher, calls, postBodies, activationPosts: () => activationPosts, committedCreates: () => committedCreates, originalReceipt: () => receipt,
    setAssignmentId: (next: string) => { assignmentId = next; } };
}
async function fillOwner(view: ReturnType<typeof render>) {
  await waitFor(() => expect(view.getByLabelText(/ID реальной организации/)).toBeInTheDocument());
  fireEvent.change(view.getByLabelText(/ID реальной организации/), { target: { value: 'organization-1' } });
  fireEvent.change(view.getByLabelText(/Тикет/), { target: { value: 'ticket-1' } });
  fireEvent.change(view.getByLabelText(/Причина просмотра/), { target: { value: 'Осмотр реальной организации' } });
}
function storedOwnerCommand() {
  const raw = window.sessionStorage.getItem('pc-owner-create:owner-user-1');
  return raw ? JSON.parse(raw) as { createIntentId: string; body: Record<string, unknown>; phase: string } : null;
}

describe('native-selected immutable owner create recovery', () => {
  beforeEach(() => { window.sessionStorage.clear(); window.localStorage.clear(); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('recovers a committed create after remount and form edits without creating another grant', async () => {
    const model = ownerModel({ lostCreate: 'committed' }); vi.stubGlobal('fetch', model.fetcher);
    let view = render(createElement(RoleModeCenter, model.props)); await fillOwner(view);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(model.postBodies).toHaveLength(1));
    await waitFor(() => expect(view.getByRole('button', { name: 'Восстановить запрос' })).toBeEnabled());
    const saved = storedOwnerCommand(); expect(saved?.createIntentId).toBe(model.postBodies[0].createIntentId);
    expect(JSON.stringify(saved)).not.toMatch(/accessToken|csrfToken|cookie|PRIVATE-DEAL/);
    fireEvent.change(view.getByLabelText(/ID реальной организации/), { target: { value: 'different-organization' } });
    view.unmount(); view = render(createElement(RoleModeCenter, model.props));
    await waitFor(() => expect(view.getByRole('button', { name: 'Восстановить запрос' })).toBeEnabled());
    expect(model.postBodies).toHaveLength(1);
    fireEvent.click(view.getByRole('button', { name: 'Восстановить запрос' }));
    await waitFor(() => expect(view.container.querySelector('[data-founder-role-mode-active]')).not.toBeNull());
    expect(model.postBodies).toHaveLength(1); expect(model.committedCreates()).toBe(1); expect(model.activationPosts()).toBe(1);
    expect(storedOwnerCommand()).toBeNull();
    const firstPost = model.calls.findIndex((row) => row.method === 'POST');
    expect(model.calls.slice(0, firstPost).some((row) => row.path.includes('view=create-intent'))).toBe(true);
  });

  it('uses exactly the saved body and UUID when private404 permits a same-key retry', async () => {
    const model = ownerModel({ lostCreate: 'absent' }); vi.stubGlobal('fetch', model.fetcher);
    const view = render(createElement(RoleModeCenter, model.props)); await fillOwner(view);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(view.getByRole('button', { name: 'Восстановить запрос' })).toBeEnabled());
    fireEvent.change(view.getByLabelText(/Причина просмотра/), { target: { value: 'Изменённая причина не должна уйти' } });
    fireEvent.click(view.getByRole('button', { name: 'Восстановить запрос' }));
    await waitFor(() => expect(model.activationPosts()).toBe(1));
    expect(model.postBodies).toHaveLength(2); expect(model.postBodies[1]).toEqual(model.postBodies[0]);
    expect(model.committedCreates()).toBe(1);
  });

  it('keeps an actor-context404 unresolved instead of replacing its identity', async () => {
    const model = ownerModel({ lostCreate: 'committed', context404: true }); vi.stubGlobal('fetch', model.fetcher);
    const view = render(createElement(RoleModeCenter, model.props)); await fillOwner(view);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(view.getByRole('button', { name: 'Восстановить запрос' })).toBeEnabled());
    const original = storedOwnerCommand(); fireEvent.click(view.getByRole('button', { name: 'Восстановить запрос' }));
    await waitFor(() => expect(model.postBodies).toHaveLength(2));
    expect(storedOwnerCommand()?.createIntentId).toBe(original?.createIntentId);
    expect(model.postBodies[1]).toEqual(model.postBodies[0]); expect(model.committedCreates()).toBe(1);
    expect(model.activationPosts()).toBe(0); expect(view.getAllByRole('button', { name: 'Открыть read-only' }).every((button) => button.hasAttribute('disabled'))).toBe(true);
  });

  it('never repeats activation or create when the committed activation bearer reply is lost', async () => {
    const model = ownerModel({ lostActivation: true }); vi.stubGlobal('fetch', model.fetcher);
    let view = render(createElement(RoleModeCenter, model.props)); await fillOwner(view);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(storedOwnerCommand()?.phase).toBe('activation-unknown'));
    await waitFor(() => expect(view.getByRole('button', { name: 'Повторить проверку сессии' })).toBeEnabled());
    fireEvent.click(view.getByRole('button', { name: 'Повторить проверку сессии' }));
    view.unmount(); view = render(createElement(RoleModeCenter, model.props));
    await waitFor(() => expect(view.getByRole('button', { name: 'Повторить проверку сессии' })).toBeEnabled());
    expect(model.postBodies).toHaveLength(1); expect(model.activationPosts()).toBe(1);
    expect(view.container.querySelector('[data-founder-role-mode-active]')).toBeNull(); expect(view.container.textContent).not.toContain('PRIVATE-DEAL');
  });

  it('recovers the fixed CONTROL_PLANE bootstrap after remount without a second create', async () => {
    const model = ownerModel({ lostCreate: 'committed' }); vi.stubGlobal('fetch', model.fetcher);
    vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
    let view = render(createElement(BootstrapCenter, model.props));
    await waitFor(() => expect(view.getByRole('button', { name: 'Открыть доступ на 30 минут' })).toBeEnabled());
    fireEvent.click(view.getByRole('button', { name: 'Открыть доступ на 30 минут' }));
    await waitFor(() => expect(view.getByRole('button', { name: 'Восстановить запрос доступа' })).toBeEnabled());
    const original = storedOwnerCommand(); view.unmount(); view = render(createElement(BootstrapCenter, model.props));
    await waitFor(() => expect(view.getByRole('button', { name: 'Восстановить запрос доступа' })).toBeEnabled());
    fireEvent.click(view.getByRole('button', { name: 'Восстановить запрос доступа' }));
    await waitFor(() => expect(model.activationPosts()).toBe(1));
    await waitFor(() => expect(storedOwnerCommand()).toBeNull());
    expect(model.postBodies).toHaveLength(1); expect(model.postBodies[0]).toMatchObject({
      createIntentId: original?.createIntentId, accessMode: 'CONTROL_PLANE', durationSeconds: 1800,
      permissions: [...OWNER_REGISTRATION_PERMISSIONS], ticketId: 'PC-CROP-3785',
    });
  });

  it('captures the freshly verified owner assignment when opening registration access', async () => {
    const model = ownerModel(); vi.stubGlobal('fetch', model.fetcher);
    vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
    const view = render(createElement(BootstrapCenter, model.props));
    await waitFor(() => expect(view.getByRole('button', { name: 'Открыть доступ на 30 минут' })).toBeEnabled());
    model.setAssignmentId('owner-2');
    fireEvent.click(view.getByRole('button', { name: 'Открыть доступ на 30 минут' }));
    await waitFor(() => expect(model.activationPosts()).toBe(1));
    expect(model.postBodies).toHaveLength(1);
    expect(model.postBodies[0].assignmentId).toBe('owner-2');
    expect(model.postBodies[0].permissions).toEqual([...OWNER_REGISTRATION_PERMISSIONS]);
  });

  it('re-prepares CSRF without changing the persisted intent or body', async () => {
    const model = ownerModel({ csrfReject: true }); vi.stubGlobal('fetch', model.fetcher);
    const view = render(createElement(RoleModeCenter, model.props)); await fillOwner(view);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(model.activationPosts()).toBe(1));
    expect(model.postBodies).toHaveLength(2); expect(model.postBodies[1]).toEqual(model.postBodies[0]);
    expect(model.committedCreates()).toBe(1);
  });

  it('blocks before a mutation when durable tab storage cannot save the command', async () => {
    const model = ownerModel(); vi.stubGlobal('fetch', model.fetcher);
    const view = render(createElement(RoleModeCenter, model.props)); await fillOwner(view);
    const backing = window.sessionStorage;
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue({ getItem: backing.getItem.bind(backing),
      setItem: () => { throw new DOMException('Denied', 'SecurityError'); },
      removeItem: backing.removeItem.bind(backing), clear: backing.clear.bind(backing),
      key: backing.key.bind(backing), get length() { return backing.length; } } as Storage);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(view.getByText(/Не удалось сохранить запрос в этой вкладке/)).toBeInTheDocument());
    expect(model.postBodies).toHaveLength(0); expect(model.activationPosts()).toBe(0);
  });

  it('isolates stale create replies from a changed actor and retains only the original actor record', async () => {
    const model = ownerModel(); let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await model.fetcher(input, init);
      if (String(input) === '/platform-v7/staff/role-mode' && init?.method === 'POST') await held;
      return response;
    }));
    const view = render(createElement(RoleModeCenter, model.props)); await fillOwner(view);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(model.postBodies).toHaveLength(1));
    const id = storedOwnerCommand()?.createIntentId;
    view.rerender(createElement(RoleModeCenter, { ...model.props, identity: { id: 'different-actor', email: 'other@example.test' } }));
    await act(async () => { release(); await held; });
    await waitFor(() => expect(view.getByLabelText(/ID реальной организации/)).toHaveValue(''));
    expect(view.getByLabelText(/Причина просмотра/)).toHaveValue('');
    expect(view.container.querySelector('[data-founder-role-mode-active]')).toBeNull();
    expect(window.sessionStorage.getItem('pc-owner-create:different-actor')).toBeNull();
    expect(storedOwnerCommand()?.createIntentId).toBe(id); expect(model.activationPosts()).toBe(0);
    clearClientSessionState(); expect(storedOwnerCommand()).toBeNull();
  });

  it('retains the same committed intent when activation-phase persistence fails before activation', async () => {
    const model = ownerModel(); vi.stubGlobal('fetch', model.fetcher);
    const backing = window.sessionStorage;
    vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue({ getItem: backing.getItem.bind(backing),
      setItem: (key: string, raw: string) => {
        if (JSON.parse(raw).phase === 'activation-unknown') throw new DOMException('Denied transition', 'SecurityError');
        backing.setItem(key, raw);
      }, removeItem: backing.removeItem.bind(backing), clear: backing.clear.bind(backing),
      key: backing.key.bind(backing), get length() { return backing.length; } } as Storage);
    const view = render(createElement(RoleModeCenter, model.props)); await fillOwner(view);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(view.getByRole('button', { name: 'Восстановить запрос' })).toBeEnabled());
    const saved = storedOwnerCommand(); expect(saved?.phase).toBe('created');
    fireEvent.click(view.getByRole('button', { name: 'Восстановить запрос' }));
    await waitFor(() => expect(view.getByText(/Не удалось сохранить запрос в этой вкладке/)).toBeInTheDocument());
    expect(storedOwnerCommand()?.createIntentId).toBe(saved?.createIntentId);
    expect(model.postBodies).toHaveLength(1); expect(model.activationPosts()).toBe(0);
  });

  it('does not repopulate cleared logout storage from a late committed reply after unmount', async () => {
    const model = ownerModel(); let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await model.fetcher(input, init);
      if (String(input) === '/platform-v7/staff/role-mode' && init?.method === 'POST') await held;
      return response;
    }));
    const view = render(createElement(RoleModeCenter, model.props)); await fillOwner(view);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(model.postBodies).toHaveLength(1));
    view.unmount(); clearClientSessionState();
    await act(async () => { release(); await held; });
    expect(storedOwnerCommand()).toBeNull(); expect(model.activationPosts()).toBe(0);
  });

  it.each(['revoked', 'expired'] as const)('does not activate an original GRANTED receipt with current%s projection', async (projection) => {
    const model = ownerModel({ projection }); vi.stubGlobal('fetch', model.fetcher);
    const view = render(createElement(RoleModeCenter, model.props)); await fillOwner(view);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(view.getByText(/Предыдущий запрос завершён/)).toBeInTheDocument());
    expect(model.originalReceipt()?.status).toBe('GRANTED');
    expect(model.postBodies).toHaveLength(1); expect(model.activationPosts()).toBe(0);
    expect(view.container.querySelector('[data-founder-role-mode-active]')).toBeNull();
  });

  it('does not turn a stale recovery action into a fresh identity after another mounted surface resolves the record', async () => {
    const model = ownerModel({ lostCreate: 'committed' }); vi.stubGlobal('fetch', model.fetcher);
    const coordinator = { opening: false };
    const view = render(createElement(RoleModeCenter, { ...model.props, openingCoordinator: coordinator })); await fillOwner(view);
    fireEvent.click(view.getAllByRole('button', { name: 'Открыть read-only' })[1]);
    await waitFor(() => expect(view.getByRole('button', { name: 'Восстановить запрос' })).toBeEnabled());
    const original = readOwnerPendingCreate('owner-user-1'); expect(original).not.toBeNull();
    completeOwnerCreate(original!, coordinator);
    fireEvent.click(view.getByRole('button', { name: 'Восстановить запрос' }));
    await waitFor(() => expect(view.queryByRole('button', { name: 'Восстановить запрос' })).toBeNull());
    expect(storedOwnerCommand()).toBeNull(); expect(model.postBodies).toHaveLength(1); expect(model.activationPosts()).toBe(0);
  });

  it('requires a stable verified actor id before persisting or sending any command', () => {
    expect(() => prepareOwnerCreate(undefined, 'founder', { cabinetKey: 'buyer', organizationId: 'organization-1',
      reason: 'Owner request with missing identity', ticketId: 'ticket-1', durationSeconds: 900 }, { opening: false })).toThrow('OWNER_CREATE_IDENTITY_UNAVAILABLE');
    expect(window.sessionStorage.length).toBe(0);
  });
});

function recoveryRequest(query: string, method = 'GET', body?: unknown) {
  const origin = `https://${CONTROL_PLATFORM_HOST}`;
  const request = new NextRequest(`${origin}/platform-v7/staff/role-mode${query}`, {
    method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  request.headers.set('host', CONTROL_PLATFORM_HOST); request.headers.set('origin', origin);
  request.headers.set('cookie', `${ACCESS_COOKIE}=fixture-access; ${CSRF_COOKIE}=fixture-csrf`);
  request.headers.set('x-csrf-token', 'fixture-csrf');
  request.cookies.set(ACCESS_COOKIE, 'fixture-access'); request.cookies.set(CSRF_COOKIE, 'fixture-csrf');
  return request;
}

describe('native-selected exact create-intent BFF', () => {
  beforeEach(() => {
    vi.resetModules(); vi.stubEnv('API_URL', 'https://backend.example.test/api');
    vi.stubEnv('PC_CONTROL_HOST_ENABLED', 'true'); vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it.each(['', 'not-a-uuid', '11111111-1111-1111-8111-111111111111'])('rejects invalid or omitted POST identity before upstream', async (id) => {
    const { POST } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await POST(recoveryRequest('', 'POST', { cabinetKey: 'buyer', organizationId: 'organization-1',
      reason: 'Owner read-only inspection', ticketId: 'ticket-1', durationSeconds: 900, ...(id ? { createIntentId: id } : {}) }));
    expect(response.status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    '?view=create-intent', '?view=create-intent&createIntentId=bad',
    `?view=create-intent&createIntentId=${INTENT_FIXTURE}&createIntentId=${INTENT_FIXTURE}`,
    `?view=create-intent&createIntentId=${INTENT_FIXTURE}&actorUserId=another-actor`,
    `?view=create-intent&createIntentId=${INTENT_FIXTURE}%2F..`,
  ])('rejects malformed or ambiguous recovery selector without upstream', async (query) => {
    const { GET } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await GET(recoveryRequest(query)); expect(response.status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards only the exact actor-private identity and removes nested credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(ownerJson({ createIntentId: INTENT_FIXTURE,
      originalReceipt: { requestId: 'request-1', accessToken: 'must-not-leak' },
      currentProjection: { activationEligible: false, refreshToken: 'must-not-leak-either' } }));
    const { GET } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await GET(recoveryRequest(`?view=create-intent&createIntentId=${INTENT_FIXTURE}`));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(JSON.stringify(await response.json())).not.toMatch(/must-not-leak|accessToken|refreshToken/);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`https://backend.example.test/api/staff/access/request-intents/${INTENT_FIXTURE}`);
    expect(init).toMatchObject({ redirect: 'manual', cache: 'no-store', headers: { Authorization: 'Bearer fixture-access' } });
  });

  it('forwards the validated UUID with bounded founder fields and drops client authority', async () => {
    vi.mocked(fetch).mockResolvedValue(ownerJson({ createIntentId: INTENT_FIXTURE, requestId: 'request-1' }, 201));
    const { POST } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await POST(recoveryRequest('', 'POST', { createIntentId: INTENT_FIXTURE,
      cabinetKey: 'buyer', organizationId: 'organization-1', reason: 'Owner read-only inspection', ticketId: 'ticket-1', durationSeconds: 900,
      actorUserId: 'untrusted', targetTenantId: 'untrusted', targetRole: 'PLATFORM_OWNER', permissions: ['all'] }));
    expect(response.status).toBe(201);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://backend.example.test/api/staff/founder/role-mode/requests');
    expect(JSON.parse(String(init?.body))).toEqual({ createIntentId: INTENT_FIXTURE,
      cabinetKey: 'buyer', organizationId: 'organization-1', reason: 'Owner read-only inspection', ticketId: 'ticket-1', durationSeconds: 900 });
  });

  it.each(['redirect', 'oversized'] as const)('rejects a%s recovery response rather than following or relaying it', async (variant) => {
    vi.mocked(fetch).mockResolvedValue(variant === 'redirect'
      ? new Response(null, { status: 302, headers: { Location: 'https://other.example.test' } })
      : ownerJson({ padding: 'x'.repeat(65 * 1024) }));
    const { GET } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await GET(recoveryRequest(`?view=create-intent&createIntentId=${INTENT_FIXTURE}`));
    expect(response.status).toBe(502); expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([404, 409, 503])('preserves the upstream recovery status%s instead of inventing a receipt', async (status) => {
    vi.mocked(fetch).mockResolvedValue(ownerJson({ code: 'ACTUAL_UPSTREAM_FAILURE' }, status));
    const { GET } = await import('../../app/platform-v7/staff/role-mode/route');
    const response = await GET(recoveryRequest(`?view=create-intent&createIntentId=${INTENT_FIXTURE}`));
    expect(response.status).toBe(status); expect(await response.json()).toMatchObject({ code: 'ACTUAL_UPSTREAM_FAILURE' });
  });
});

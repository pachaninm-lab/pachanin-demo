import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ownerAccessCenterMessages } from '../../i18n/owner-access-center-messages';

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

describe('platform-v7 owner access center task UX', () => {
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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ownerAccessCenterMessages } from '../../i18n/owner-access-center-messages';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

const page = read('apps/web/app/platform-v7/staff/page.tsx');
const entry = read('apps/web/components/platform-v7/staff/OwnerAccessCenter.tsx');
const directCenter = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV3.tsx');
const directRoute = read('apps/web/app/platform-v7/staff/open-cabinet/route.ts');
const submitRoute = read('apps/web/app/platform-v7/staff/open-cabinet/submit/route.ts');
const handoffPage = read('apps/web/app/platform-v7/staff/cabinet-handoff/page.tsx');
const handoffClient = read('apps/web/components/platform-v7/staff/OwnerCabinetHandoff.tsx');
const directCss = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV3.module.css');
const center = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV2.tsx');
const catalog = read('apps/web/lib/platform-v7/staff-access-task-catalog.ts');
const css = read('apps/web/components/platform-v7/staff/OwnerAccessCenter.module.css');
const deferred = read('apps/web/components/platform-v7/staff/StaffOperationalWorkspacesDeferred.tsx');

describe('platform-v7 owner access center task UX', () => {
  it('gives the verified platform owner one-tap access to all twelve cabinet interfaces', () => {
    expect(page).toContain('<OwnerAccessCenter');
    expect(entry).toContain("export { OwnerAccessCenter } from './OwnerAccessCenterV3'");
    for (const role of [
      'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
      'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
    ]) {
      expect(directCenter).toContain(`role: '${role}'`);
    }
    expect(directCenter).toContain('method="post"');
    expect(directCenter).toContain('action="/platform-v7/staff/open-cabinet/submit"');
    expect(directCenter).toContain('name="_csrf"');
    expect(directCenter).toContain('name="role"');
    expect(directCenter).toContain('name="organizationId"');
    expect(page).toContain('csrfToken={csrfToken}');
    expect(directCenter).not.toContain('sessionStorage');
    expect(directCenter).not.toContain("fetch('/platform-v7/staff/open-cabinet'");
    expect(directCenter).not.toContain('Рабочий тикет');
    expect(directCenter).not.toContain('Причина доступа');
  });

  it('uses native POST and performs the client role handoff only after server success', () => {
    expect(directRoute).toContain("contentType.includes('application/x-www-form-urlencoded')");
    expect(directRoute).toContain('request.formData()');
    expect(directRoute).toContain('formCsrfValid(request');
    expect(submitRoute).toContain("import { POST as issueCabinetSession } from '../route'");
    expect(submitRoute).toContain("target.pathname === '/platform-v7/staff'");
    expect(submitRoute).toContain("new URL('/platform-v7/staff/cabinet-handoff', request.url)");
    expect(handoffPage).toContain('readVerifiedCabinetSessionContext');
    expect(handoffPage).toContain('CABINET_SESSION_COOKIE');
    expect(handoffPage).toContain('controlledOrganizationById(context.organizationId)');
    expect(handoffPage).toContain('<OwnerCabinetHandoff');
    expect(handoffClient).toContain('useLayoutEffect(() =>');
    expect(handoffClient).toContain('window.sessionStorage.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, role)');
    expect(handoffClient).toContain('window.location.replace(target)');
    expect(directCenter).not.toContain('onSubmit=');
    expect(directCenter).not.toContain('busyRole');
    expect(directCenter).not.toContain('setBusyRole');
  });

  it('does not create a client role marker when the server rejects cabinet opening', () => {
    expect(directRoute).toContain('redirectBack(request, code)');
    expect(submitRoute).toContain('if (!failedBackToOwnerCenter)');
    expect(directCenter).not.toContain('PLATFORM_V7_ACTIVE_ROLE_KEY');
    expect(handoffPage).toContain("redirect('/platform-v7/staff?cabinetError=CABINET_SESSION_UNAVAILABLE')");
  });

  it('requires controlled-owner claims or an active API-backed PLATFORM_OWNER assignment', () => {
    expect(directRoute).toContain('assertCsrf(request)');
    expect(directRoute).toContain('assertSameOriginIfPresent(request)');
    expect(directRoute).toContain('claims.owner !== true');
    expect(directRoute).toContain('claims.testAccess !== true');
    expect(directRoute).toContain("claims.tokenType !== 'access'");
    expect(directRoute).toContain("fetch(`${origin}/auth/me`");
    expect(directRoute).toContain("fetch(`${origin}/staff/assignments/me`");
    expect(directRoute).toContain("item.role === 'PLATFORM_OWNER' && item.status === 'ACTIVE'");
    expect(directRoute).toContain('signCabinetSession(parsed.role, secret');
    expect(directRoute).toContain('response.cookies.set(CABINET_SESSION_COOKIE');
    expect(directRoute).toContain('response.cookies.set(SESSION_COOKIE');
    expect(directRoute).toContain("response.cookies.set('pc-role'");
    expect(directRoute).not.toContain('response.cookies.set(ACCESS_COOKIE');
  });

  it('retains the task-first PAM surface for staff management and privileged operations', () => {
    expect(directCenter).toContain('<OwnerAccessCenterV2 {...baseProps} />');
    expect(directCenter).toContain('setAdvanced(true)');
    expect(directCenter).toContain('setAdvanced(false)');
    expect(page).toContain('accessCatalog={staffAccessTaskCatalog()}');
    expect(center).toContain('copy.home.tasksTitle');
    expect(center).toContain('copy.tasks[task.id].title');
    expect(center).not.toContain('ACCESS_PRESETS');
    expect(catalog).toContain("id: 'view_cabinet'");
    expect(catalog).toContain("id: 'investigate_deal'");
    expect(catalog).toContain("id: 'review_money'");
  });

  it('keeps privileged permission policy server-owned and API-authoritative', () => {
    expect(catalog).toContain("import 'server-only'");
    expect(catalog).toContain('The API remains the authority');
    expect(center).toContain('permissions: selectedPermissions');
    expect(center).toContain('<details className={styles.technicalDetails}>');
    expect(center).not.toContain('const ACCESS_PRESETS');
  });

  it('uses field-level validation and an isolated emergency form in the advanced surface', () => {
    expect(center).toContain('setFieldErrors(next)');
    expect(center).toContain('owner-access-organization');
    expect(center).toContain('owner-access-ticket');
    expect(center).toContain('owner-access-reason');
    expect(center).toContain('emergencyTicket');
    expect(center).toContain('emergencyReason');
    expect(center).toContain('emergencyConfirmed');
    expect(center).not.toContain("reason.trim().length < 20 || ticketId.trim().length < 3");
  });

  it('always leaves a manual organization-id path and closes directory sessions before switching tasks', () => {
    expect(center).toContain('placeholder={copy.request.organizationIdPlaceholder}');
    expect(center).toContain('organizations.length === 0 && canBrowseOrganizations');
    expect(center).toContain("'Organization selected; directory session closed'");
    expect(center).toContain('openTask(resumeTask, { allowWhileActive: true })');
  });

  it('does not render privileged operational workspaces without an active protected session', () => {
    expect(deferred).toContain("fetch('/api/staff/session-context'");
    expect(deferred).toContain('payload.active === true');
    expect(deferred).toContain('if (!ready || !active) return null');
  });

  it('keeps both owner surfaces mobile-first with safe-area and large touch targets', () => {
    expect(directCss).toContain('env(safe-area-inset-bottom)');
    expect(directCss).toContain('@media (max-width: 520px)');
    expect(directCss).toContain('grid-template-columns: 1fr');
    expect(directCss).toContain('min-height: 54px');
    expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('@media (max-width: 380px)');
    expect(css).toContain('min-height: 58px');
    expect(css).toContain('overflow-x: clip');
    expect(css).not.toContain('min-width: 1000px');
  });

  it('keeps RU, EN and ZH owner-control dictionaries structurally identical', () => {
    expect(keys(ownerAccessCenterMessages.en)).toEqual(keys(ownerAccessCenterMessages.ru));
    expect(keys(ownerAccessCenterMessages.zh)).toEqual(keys(ownerAccessCenterMessages.ru));
  });
});

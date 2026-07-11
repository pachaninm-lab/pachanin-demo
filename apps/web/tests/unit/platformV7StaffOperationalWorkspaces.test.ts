import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const currentDir = process.cwd();
const webRoot = currentDir.endsWith(path.join('apps', 'web'))
  ? currentDir
  : path.join(currentDir, 'apps', 'web');
const repoRoot = webRoot.endsWith(path.join('apps', 'web'))
  ? path.resolve(webRoot, '..', '..')
  : currentDir;
const readWeb = (relativePath: string) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');
const readRepo = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const component = readWeb('components/platform-v7/staff/StaffOperationalWorkspaces.tsx');
const controlCenter = readWeb('components/platform-v7/staff/StaffControlCenter.tsx');
const route = readWeb('app/api/staff/workspaces/[...path]/route.ts');
const messages = readWeb('i18n/staff-operational-workspace-messages.ts');
const css = readWeb('components/platform-v7/staff/StaffOperationalWorkspaces.module.css');
const controller = readRepo('apps/api/src/modules/staff-access/staff-workspace.controller.ts');
const service = readRepo('apps/api/src/modules/staff-access/staff-workspace.service.ts');

function expectBefore(source: string, first: string, second: string) {
  expect(source.indexOf(first)).toBeGreaterThanOrEqual(0);
  expect(source.indexOf(second)).toBeGreaterThanOrEqual(0);
  expect(source.indexOf(first)).toBeLessThan(source.indexOf(second));
}

describe('industrial staff operational workspaces', () => {
  it('requires an active protected staff session before any workspace data is requested', () => {
    expect(component).toContain("api<SessionContext>('/api/staff/session-context')");
    expect(component).toContain('if (!context.active || !availableTabs.includes(tab)) return');
    expect(component).toContain('const permissions = context.session?.permissions || []');
    expect(component).not.toContain('localStorage');
    expect(component).not.toContain('sessionStorage');
    expect(component).not.toContain('?role=');
  });

  it('synchronizes all staff workspaces immediately after protected-session activation or end', () => {
    expect(controlCenter).toContain("window.dispatchEvent(new Event('pc:staff-session-changed'))");
    expect(component).toContain("window.addEventListener('pc:staff-session-changed', refresh)");
    expect(component).toContain("window.removeEventListener('pc:staff-session-changed', refresh)");
  });

  it('clears all privileged projections when the protected session is absent, expired or unverifiable', () => {
    expect(component).toContain('const clearPrivilegedState = useCallback');
    expect(component).toContain('if (!next.active || !next.session) clearPrivilegedState()');
    expect(component).toContain("setContext({ active: false, session: null })");
    expect(component).toContain('setOrganizationUsers({})');
  });

  it('derives every workspace from server-issued permissions instead of a client-selected role', () => {
    for (const permission of [
      'support-case:read', 'deal:list', 'payment:metadata:read', 'diagnostic:read',
      'staff-assignment:read', 'critical-action:approve', 'staff-session:read',
    ]) expect(component).toContain(`can('${permission}')`);
    expect(component).not.toContain('setRoleFromUrl');
    expect(component).not.toContain('searchParams.get(\'role\')');
  });

  it('does not expose unusable people or emergency workspaces outside exact active-session permissions', () => {
    expect(component).toContain("if (can('staff-session:read')) rows.push('emergency')");
    expect(component).not.toContain("can('staff-session:read') || can('break-glass:activate')");
    expect(component).toContain("can('staff-assignment:read')");
    expect(component).toContain("? await api<ApiObject[]>('/api/staff/workspaces/assignments')");
    expect(controller).toContain("@Post('break-glass/:id/end')");
    expect(controller).toContain('@StaffPermissions(StaffPermission.STAFF_SESSION_READ)');
  });

  it('keeps UI permission presets aligned with the backend StaffPermission vocabulary', () => {
    for (const permission of [
      'staff-assignment:read', 'staff-assignment:write', 'support-case:read',
      'deal:list', 'payment:metadata:read', 'diagnostic:read',
      'critical-action:approve', 'break-glass:activate',
    ]) expect(controlCenter).toContain(`'${permission}'`);
    for (const obsolete of [
      "'payment:read'", "'bank-event:read'", "'reconciliation:read'",
      "'document:request'", "'manual-review:route'", "'incident:update'",
    ]) expect(controlCenter).not.toContain(obsolete);
  });

  it('keeps the BFF fail-closed and never exposes the opaque staff token', () => {
    expect(route).toContain("const STAFF_ACCESS_COOKIE = 'pc_staff_access_token'");
    expect(route).toContain("const accessToken = request.cookies.get(ACCESS_COOKIE)?.value");
    expect(route).toContain("const staffToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value");
    expect(route).toContain("'X-Staff-Access-Session': staffToken");
    expect(route).toContain('delete payload.accessToken');
    expect(route).toContain("redirect: 'manual'");
    expect(route).toContain('MAX_BODY_BYTES');
    expect(route).toContain('assertCsrf(request)');
    expectBefore(route, 'if (!accessToken || !staffToken)', 'fetch(`${apiOrigin}/staff/workspaces/');
  });

  it('enforces mode and permission guards on the server for each workspace', () => {
    for (const routeName of ['support', 'operations', 'finance', 'diagnostics', 'critical-actions', 'assignments']) {
      expect(controller).toContain(`('${routeName}')`);
    }
    for (const permission of [
      'StaffPermission.SUPPORT_CASE_READ', 'StaffPermission.DEAL_LIST',
      'StaffPermission.PAYMENT_METADATA_READ', 'StaffPermission.DIAGNOSTIC_READ',
      'StaffPermission.CRITICAL_ACTION_APPROVE', 'StaffPermission.STAFF_ASSIGNMENT_READ',
    ]) expect(controller).toContain(permission);
    expect(controller).toContain('@UseGuards(StaffAccessGuard)');
    expect(controller).toContain('this.requireAccessContext(request)');
  });

  it('uses real operational sources but excludes sensitive payload bodies and authoritative commands', () => {
    for (const source of ['integrationEvent.findMany', 'outboxEntry.findMany', 'dealWorkspaceRuntimeTransactionAttempt.findMany', 'bankOperation.findMany', 'payment.findMany', 'kycTask.findMany']) {
      expect(service).toContain(source);
    }
    expect(service).not.toContain('requestPayload: true');
    expect(service).not.toContain('responsePayload: true');
    expect(component).not.toContain('payment:release');
    expect(component).not.toContain('bank-callback:confirm');
    expect(component).not.toContain('document:sign');
    expect(component).not.toContain('lab:finalize');
    expect(component).not.toContain('arbitration:decide');
  });

  it('ships complete RU EN ZH copy and mobile accessibility guards', () => {
    expect(messages).toContain('const ru:');
    expect(messages).toContain('const en:');
    expect(messages).toContain('const zh:');
    expect(messages).toContain('Рабочие контуры платформы');
    expect(messages).toContain('Platform staff workspaces');
    expect(messages).toContain('平台员工工作台');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).toContain('@media(forced-colors:active)');
    expect(css).toContain('@media(max-width:620px)');
  });
});

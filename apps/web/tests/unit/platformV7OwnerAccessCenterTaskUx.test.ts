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
const center = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV2.tsx');
const catalog = read('apps/web/lib/platform-v7/staff-access-task-catalog.ts');
const css = read('apps/web/components/platform-v7/staff/OwnerAccessCenter.module.css');
const deferred = read('apps/web/components/platform-v7/staff/StaffOperationalWorkspacesDeferred.tsx');

describe('platform-v7 owner access center task UX', () => {
  it('replaces mode-first navigation with human task selection', () => {
    expect(page).toContain('<OwnerAccessCenter');
    expect(page).toContain('accessCatalog={staffAccessTaskCatalog()}');
    expect(entry).toContain("export { OwnerAccessCenter } from './OwnerAccessCenterV2'");
    expect(center).toContain('copy.home.tasksTitle');
    expect(center).toContain('copy.tasks[task.id].title');
    expect(center).not.toContain('ACCESS_PRESETS');
    expect(catalog).toContain("id: 'view_cabinet'");
    expect(catalog).toContain("id: 'investigate_deal'");
    expect(catalog).toContain("id: 'review_money'");
  });

  it('keeps permission policy server-owned and API-authoritative', () => {
    expect(catalog).toContain("import 'server-only'");
    expect(catalog).toContain('The API remains the authority');
    expect(center).toContain('permissions: selectedPermissions');
    expect(center).toContain('<details className={styles.technicalDetails}>');
    expect(center).not.toContain("const ACCESS_PRESETS");
  });

  it('uses field-level validation and an isolated emergency form', () => {
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

  it('has a genuine mobile-first navigation and safe-area boundary', () => {
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

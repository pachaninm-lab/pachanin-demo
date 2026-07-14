import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const page = read('apps/web/app/platform-v7/audit-log/page.tsx');
const reader = read('apps/web/lib/audit-server.ts');
const controller = read('apps/api/src/modules/audit/audit.controller.ts');
const service = read('apps/api/src/modules/audit/audit.service.ts');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[]; governedRoots: string[] };
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 audit log authority', () => {
  it('renders a governed v8 read-only workspace from the server reader', () => {
    expect(page).toContain('OperationalDecisionCockpit');
    expect(page).toContain('OperationalQueueLink');
    expect(page).toContain('getAuditServerState');
    expect(page).toContain("testId='platform-v7-audit-log-v8'");
    expect(page).not.toContain("'use client'");
    expect(page).not.toMatch(forbiddenPresentation);
  });

  it('fails closed on unavailable or malformed audit API responses', () => {
    expect(reader).toContain("serverApiUrl('/audit')");
    expect(reader).toContain("cache: 'no-store'");
    expect(reader).toContain('serverAuthHeaders()');
    expect(reader).toContain('if (!response.ok) return { available: false, entries: [] }');
    expect(reader).toContain('if (!Array.isArray(payload)) return { available: false, entries: [] }');
    expect(reader).toContain('catch');
    expect(reader).not.toContain('STATIC_FALLBACK');
  });

  it('preserves the server-side staff-role and PostgreSQL authority', () => {
    expect(controller).toContain('@Roles(Role.ADMIN, Role.SUPPORT_MANAGER)');
    expect(controller).toContain('return this.svc.list()');
    expect(service).toContain('this.prisma.auditEvent.findMany');
    expect(service).toContain("orderBy: { createdAt: 'desc' }");
    expect(service).toContain('take: 200');
  });

  it('removes fictional deals, money impact and local permission presentation', () => {
    for (const forbidden of [
      'DL-9106',
      'DL-9102',
      'DL-9109',
      '9,65 млн',
      '624 тыс',
      'TimelineWithImpact',
      'AuditLogPanel',
      'RbacMatrix',
      'LiveApiStatusBar',
      'PremiumCtaButton',
      'тестовый контур',
    ]) {
      expect(page).not.toContain(forbidden);
    }
  });

  it('states authority and hash-chain limits in RU EN and ZH', () => {
    expect(page).toContain('автоматическая проверка hash-chain этим экраном не выполняется');
    expect(page).toContain('this screen does not automatically verify the hash chain');
    expect(page).toContain('该页面不会自动验证 hash 链');
    expect(page).toContain('API допускает только роли ADMIN и SUPPORT_MANAGER');
    expect(page).toContain('The API allows ADMIN and SUPPORT_MANAGER only');
    expect(page).toContain('API 仅允许 ADMIN 和 SUPPORT_MANAGER');
  });

  it('registers the route and server reader in v8 governance', () => {
    expect(routePolicy).toContain("'/platform-v7/audit-log'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/audit-log/page.tsx');
    expect(governance.governedRoots).toContain('apps/web/lib/audit-server.ts');
  });
});

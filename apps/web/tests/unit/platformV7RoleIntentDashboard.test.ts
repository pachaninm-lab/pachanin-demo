import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTROLLED_CABINET_CONTEXTS } from '../../lib/platform-v7/controlled-test-organizations';

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const ownerCabinetMatrix = [
  { role: 'operator', route: '/platform-v7/control-tower', page: 'apps/web/app/platform-v7/control-tower/page.tsx' },
  { role: 'buyer', route: '/platform-v7/buyer', page: 'apps/web/app/platform-v7/buyer/page.tsx' },
  { role: 'seller', route: '/platform-v7/seller', page: 'apps/web/app/platform-v7/seller/page.tsx' },
  { role: 'logistics', route: '/platform-v7/logistics', page: 'apps/web/app/platform-v7/logistics/page.tsx' },
  { role: 'driver', route: '/platform-v7/driver/field', page: 'apps/web/app/platform-v7/driver/field/page.tsx' },
  { role: 'surveyor', route: '/platform-v7/surveyor', page: 'apps/web/app/platform-v7/surveyor/page.tsx' },
  { role: 'elevator', route: '/platform-v7/elevator', page: 'apps/web/app/platform-v7/elevator/page.tsx' },
  { role: 'lab', route: '/platform-v7/lab', page: 'apps/web/app/platform-v7/lab/page.tsx' },
  { role: 'bank', route: '/platform-v7/bank', page: 'apps/web/app/platform-v7/bank/page.tsx' },
  { role: 'arbitrator', route: '/platform-v7/arbitrator', page: 'apps/web/app/platform-v7/arbitrator/page.tsx' },
  { role: 'compliance', route: '/platform-v7/compliance', page: 'apps/web/app/platform-v7/compliance/page.tsx' },
  { role: 'executive', route: '/platform-v7/executive', page: 'apps/web/app/platform-v7/executive/page.tsx' },
] as const;

describe('platform-v7 role intent dashboard', () => {
  it('opens only participant-scoped real deals and exposes honest Today states', () => {
    const model = read('apps/web/lib/platform-v7/roleIntentActions.ts');
    const dashboard = read('apps/web/components/platform-v7/RoleIntentDashboard.tsx');
    const dashboardStyles = read('apps/web/components/platform-v7/RoleIntentDashboard.module.css');
    const shell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');

    expect(model).toContain('ROLE_INTENT_ACTIONS');
    expect(dashboard).toContain('const PAGE_SIZE = 20');
    expect(dashboard).toContain("params.set('cursor', cursor)");
    expect(dashboard).toContain('function prioritizeDeals');
    expect(dashboard).toContain('(deal.nextAction ? actionable : waiting).push(deal)');
    expect(dashboard).toContain('Сначала показана сделка, где от вас уже требуется действие');
    expect(dashboard).toContain('<CanonicalDealWorkspace role={role} dealId={current.id} />');
    expect(dashboard).not.toContain('<CanonicalDealWorkspace role={role} />');
    expect(dashboard).not.toContain('DEAL-INDUSTRIAL-001');
    expect(dashboard).toContain('Сегодня нет активных сделок');
    expect(dashboard).toContain('Не удалось загрузить задачи');
    expect(dashboard).toContain('Сервер вернул некорректный список сделок');
    expect(dashboard).toContain('Повторить');
    expect(dashboard).not.toContain('getRoleIntentConfig');
    expect(dashboard).toContain("from '@pc/design-system-v8'");
    expect(dashboard).toContain("data-transaction-role-cockpit='v8'");
    expect(dashboardStyles).toContain('var(--ds-color');
    expect(dashboardStyles).not.toContain('var(--pc-');
    expect(dashboardStyles).toContain('@media (max-width: 430px)');
    expect(dashboardStyles).toContain('@media (forced-colors: active)');
    expect(shell).toContain('ROLE_INTENT_ROOT_PATHS');
    expect(shell).toContain(': <RoleIntentDashboard role={initialRole} />');

    for (const route of [
      '/platform-v7/control-tower', '/platform-v7/buyer', '/platform-v7/seller',
      '/platform-v7/logistics', '/platform-v7/driver', '/platform-v7/surveyor',
      '/platform-v7/elevator', '/platform-v7/lab', '/platform-v7/bank',
      '/platform-v7/compliance', '/platform-v7/arbitrator', '/platform-v7/executive',
    ]) {
      expect(shell).toContain(route);
    }
  });

  it('scales the Today queue without hiding or replacing the primary deal', () => {
    const dashboard = read('apps/web/components/platform-v7/RoleIntentDashboard.tsx');
    const dashboardStyles = read('apps/web/components/platform-v7/RoleIntentDashboard.module.css');

    expect(dashboard).toContain('nextCursor: string | null');
    expect(dashboard).toContain('mergeDeals(current.deals, page.deals)');
    expect(dashboard).toContain('const byId = new Map<string, AccessibleDealRef>()');
    expect(dashboard).toContain('Показать ещё сделки');
    expect(dashboard).toContain('loadMoreError: message');
    expect(dashboard).toContain('<CanonicalDealWorkspace role={role} dealId={current.id} />');
    expect(dashboardStyles).toContain('.loadMoreButton');
    expect(dashboardStyles).toContain('overscroll-behavior: contain');
  });

  it('keeps all twelve owner cabinet routes, organizations and page implementations connected', () => {
    const openCabinet = read('apps/web/app/platform-v7/staff/open-cabinet/route.ts');

    expect(ownerCabinetMatrix).toHaveLength(12);
    expect(new Set(ownerCabinetMatrix.map((item) => item.role)).size).toBe(12);
    expect(new Set(ownerCabinetMatrix.map((item) => item.route)).size).toBe(12);

    for (const item of ownerCabinetMatrix) {
      expect(openCabinet).toContain(`${item.role}: '${item.route}'`);
      expect(CONTROLLED_CABINET_CONTEXTS[item.role].role).toBe(item.role);
      expect(CONTROLLED_CABINET_CONTEXTS[item.role].organizationId).toBeTruthy();
      expect(fs.existsSync(path.join(root, item.page))).toBe(true);
      const page = read(item.page);
      expect(page).toMatch(/export default/);
      expect(page.length).toBeGreaterThan(200);
    }
  });

  it('shows the complete existing cabinet only for the controlled owner review marker', () => {
    const shell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');

    expect(shell).toContain('readControlledOwnerPreview(expectedRole');
    expect(shell).toContain('parsed.ownerAccess !== true');
    expect(shell).toContain('parsed.role !== expectedRole');
    expect(shell).toContain('parsed.tenantId !== CONTROLLED_TEST_TENANT_ID');
    expect(shell).toContain('controlledOrganizationById(parsed.organizationId)');
    expect(shell).toContain("data-controlled-owner-cabinet-preview='true'");
    expect(shell).toContain('Полный интерфейс кабинета');
    expect(shell).toContain('Данные и сценарии тестовые');
    expect(shell).toContain('Внешние интеграции, электронная подпись и движение денег не активированы');
    expect(shell).toContain('{children}');
    expect(shell).toContain('const showPlatformFooter = !isRoleRoot || (previewResolved && !ownerPreview)');
  });

  it('accepts current and legacy URI-encoded owner session markers before choosing the surface', () => {
    const shell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');

    expect(shell).toContain('function parseSessionMarker(raw: string)');
    expect(shell).toContain('for (let depth = 0; depth < 3; depth += 1)');
    expect(shell).toContain('JSON.parse(candidate)');
    expect(shell).toContain('decodeURIComponent(candidate)');
    expect(shell).toContain('const parsed = parseSessionMarker(raw)');
    expect(shell).not.toContain('JSON.parse(decodeURIComponent(raw))');
  });

  it('keeps the owner marker presentation-only and server authority explicit', () => {
    const shell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');

    expect(shell).toContain('It never grants a role, tenant or action permission');
    expect(shell).toContain('signed HttpOnly cabinet session');
    expect(shell).toContain('<RbacCabinetGuard />');
    expect(shell).toContain('<PlatformV7SingleEntryGuard />');
    expect(shell).toContain('Действия исполняются только после серверной проверки полномочий');
  });

  it('keeps required fields and action verbs in the model source', () => {
    const model = read('apps/web/lib/platform-v7/roleIntentActions.ts');

    for (const token of ['primaryActions', 'attentionItems', 'continueItems', 'targetRoute', 'requiredPermission', 'iconKey', 'resultLabel', 'owner']) {
      expect(model).toContain(token);
    }

    for (const verb of ['Купить', 'Продать', 'Продолжить', 'Проверить', 'Принять', 'Подписать', 'Сообщить', 'Подтвердить', 'Назначить', 'Открыть']) {
      expect(model).toContain(verb);
    }
  });

  it('does not use abstract section labels as primary action labels', () => {
    const model = read('apps/web/lib/platform-v7/roleIntentActions.ts');

    for (const bad of ["label: 'Документы'", "label: 'Банк'", "label: 'Логистика'", "label: 'Споры'", "label: 'Сделки'"]) {
      expect(model).not.toContain(bad);
    }
  });
});

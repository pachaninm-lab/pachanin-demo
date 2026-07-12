import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 role intent dashboard', () => {
  it('keeps the canonical role intent workspace for ordinary cabinet sessions', () => {
    const model = read('apps/web/lib/platform-v7/roleIntentActions.ts');
    const dashboard = read('apps/web/components/platform-v7/RoleIntentDashboard.tsx');
    const shell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');

    expect(model).toContain('ROLE_INTENT_ACTIONS');
    expect(dashboard).toContain('<CanonicalDealWorkspace role={role} />');
    expect(dashboard).not.toContain('getRoleIntentConfig');
    expect(shell).toContain('ROLE_INTENT_ROOT_PATHS');
    expect(shell).toContain(': <RoleIntentDashboard role={initialRole} />');

    for (const route of ['/platform-v7/control-tower', '/platform-v7/buyer', '/platform-v7/seller', '/platform-v7/logistics', '/platform-v7/driver', '/platform-v7/elevator', '/platform-v7/lab', '/platform-v7/bank', '/platform-v7/compliance', '/platform-v7/arbitrator', '/platform-v7/executive']) {
      expect(shell).toContain(route);
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

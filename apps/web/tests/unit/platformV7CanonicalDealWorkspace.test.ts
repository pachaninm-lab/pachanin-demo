import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { platformV7RoleCanOpenHref } from '@/lib/platform-v7/shellRoutes';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('platform-v7 canonical one-deal workspace', () => {
  const workspace = source('components/platform-v7/CanonicalDealWorkspace.tsx');
  const commandForm = source('components/platform-v7/DealCommandForm.tsx');
  const dashboard = source('components/platform-v7/RoleIntentDashboard.tsx');
  const shell = source('components/platform-v7/PlatformV7ProtectedShell.tsx');
  const proxy = source('app/api/proxy/[...path]/route.ts');
  const loginPage = source('app/platform-v7/login/page.tsx');
  const loginClient = source('app/platform-v7/login/LoginFormClient.tsx');
  const loginRoute = source('app/api/auth/login/route.ts');

  it('requires a real accessible deal id and never mounts a canonical default', () => {
    expect(workspace).toContain('dealId: string');
    expect(workspace).not.toContain("const DEAL_ID = 'DEAL-INDUSTRIAL-001'");
    expect(workspace).not.toContain('dealId = DEAL_ID');
    expect(dashboard).toContain('<CanonicalDealWorkspace role={role} dealId={current.id} />');
    expect(dashboard).not.toContain('<CanonicalDealWorkspace role={role} />');
    expect(dashboard).toContain('У вас пока нет активных сделок');
    expect(dashboard).toContain('Не удалось загрузить сделки');
    expect(dashboard).toContain('Повторить');
  });

  it('submits only user-entered payload through real task-first forms', () => {
    expect(workspace).toContain('/commands/${encodeURIComponent(action.id)}');
    expect(workspace).toContain('expectedUpdatedAt: workspace.deal.updatedAt');
    expect(workspace).toContain('expectedVersion: workspace.deal.version');
    expect(workspace).toContain('<DealCommandForm');
    expect(workspace).not.toContain('commandPayload(');
    expect(workspace).not.toContain('user-driver-001');
    expect(workspace).not.toContain('Тестовый водитель');
    expect(workspace).not.toContain('А001АА77');
    expect(commandForm).toContain("assign_logistics");
    expect(commandForm).toContain("confirm_loading");
    expect(commandForm).toContain("confirm_weight");
    expect(commandForm).toContain("finalize_lab");
    expect(commandForm).toContain('Итог PASSED/FAILED рассчитывает сервер');
    expect(commandForm).not.toContain('12.4');
    expect(commandForm).not.toContain('13.2');
    expect(commandForm).not.toContain('ГОСТ 9353-2016');
  });

  it('turns a 409 concurrency conflict into a refresh with a human explanation', () => {
    expect(workspace).toContain('reason.status === 409');
    expect(workspace).toContain('Данные изменились другим участником');
    expect(workspace).toContain('await load()');
  });

  it('does not pretend an offline command was stored before the identity-bound IndexedDB queue exists', () => {
    expect(workspace).toContain('Действие не отправлено и не сохранено на устройстве');
    expect(workspace).not.toContain('enqueueCommand');
    expect(workspace).not.toContain('pendingForDeal');
    expect(workspace).not.toContain('localStorage');
  });

  it('lets every business role reach the deal execution route so the server can decide membership', () => {
    const roles: PlatformRole[] = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'];
    for (const role of roles) {
      expect(platformV7RoleCanOpenHref(role, '/platform-v7/deals/DEAL-ANY-001/execution')).toBe(true);
    }
    expect(platformV7RoleCanOpenHref('driver', '/platform-v7/deals')).toBe(false);
  });

  it('keeps the complete cabinet only for controlled owner review', () => {
    expect(dashboard).not.toContain('getRoleIntentConfig');
    expect(dashboard).toContain('/api/proxy/deals/accessible');
    expect(shell).toContain("'/platform-v7/surveyor'");
    expect(shell).toContain(': <RoleIntentDashboard role={initialRole} />');
    expect(shell).toContain("data-controlled-owner-cabinet-preview='true'");
    expect(shell).toContain('{children}');
    expect(shell).toContain(': children;');
  });

  it('never fabricates a successful execution response when the real API is unavailable', () => {
    expect(proxy).toContain('requiresRealBackend');
    expect(proxy).toContain('^deals\\/[^/]+\\/(execution-workspace|correlation-timeline)$');
    expect(proxy).toContain('^deals\\/[^/]+\\/commands\\/');
    expect(proxy).toContain("code: 'REAL_BACKEND_REQUIRED'");
    expect(proxy).toContain("if (strictRealPath) return realBackendUnavailable('real_backend_not_used')");
  });

  it('never exposes a user button or synthetic reference for bank confirmations', () => {
    expect(workspace).toContain("action?.source === 'BANK_CALLBACK'");
    expect(workspace).toContain('Ручное подтверждение невозможно');
    expect(workspace).not.toContain('TEST-RESERVE-');
    expect(workspace).not.toContain('TEST-RELEASE-');
    expect(workspace).not.toContain("if (actionId === 'confirm_reserve')");
    expect(workspace).not.toContain("if (actionId === 'confirm_release')");
  });

  it('uses verified single entry and does not let the browser choose a role', () => {
    expect(loginPage).not.toContain("'use client'");
    expect(loginPage).toContain('getPublicLoginCopy(locale)');
    expect(loginPage).toContain('<LoginFormClient copy={form} />');
    expect(loginClient).toContain("requestJson('/api/auth/login'");
    expect(loginClient).not.toContain('/api/platform-v7/cabinet-session');
    expect(loginClient).not.toContain('usePlatformV7RStore');
    expect(loginClient).not.toContain('sessionStorage');
    expect(loginRoute).toContain('normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole)');
    expect(loginRoute).not.toContain('detectDemoRole');
    expect(loginClient).not.toContain('const workspaces');
    expect(loginClient).not.toContain('setDirectRole');
  });
});

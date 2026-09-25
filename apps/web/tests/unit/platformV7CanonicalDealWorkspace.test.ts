import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { platformV7RoleCanOpenHref } from '@/lib/platform-v7/shellRoutes';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

vi.mock('@/components/platform-v7/PublicCanonicalPrimitives', () => ({
  CanonicalDealSpine: () => null,
  CanonicalStateLens: () => null,
  CanonicalTrustLedger: () => null,
}));
vi.mock('@/components/platform-v7/DealCommandForm', () => ({
  DealCommandForm: ({ label, disabled, onSubmit }: { label: string; disabled?: boolean; onSubmit: (payload: {}) => Promise<void> }) =>
    React.createElement('button', { type: 'button', disabled, onClick: () => void onSubmit({}) }, label),
}));

import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('platform-v7 canonical one-deal workspace', () => {
  const workspace = source('components/platform-v7/CanonicalDealWorkspace.tsx');
  const workspaceStyles = source('components/platform-v7/CanonicalDealWorkspace.module.css');
  const commandForm = source('components/platform-v7/DealCommandForm.tsx');
  const commandFormStyles = source('components/platform-v7/DealCommandForm.module.css');
  const dashboard = source('components/platform-v7/RoleIntentDashboard.tsx');
  const dashboardStyles = source('components/platform-v7/RoleIntentDashboard.module.css');
  const designSystemStyles = source('../../packages/design-system-v8/src/components.module.css');
  const shell = source('components/platform-v7/PlatformV7ProtectedShell.tsx');
  const utilityMenu = source('components/platform-v7/HeaderUtilityMenu.tsx');
  const utilityStyles = source('components/platform-v7/HeaderUtilityMenu.module.css');
  const assistant = source('components/platform-v7/RoleAssistantWidget.tsx');
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

  it('puts one next action first and hides secondary complexity progressively', () => {
    expect(workspace).toContain('Твоё следующее действие');
    expect(workspace).toContain('Сейчас ничего делать не нужно');
    expect(workspace).toContain('Показать весь путь сделки');
    expect(workspace).toContain('Факты и доказательства');
    expect(workspace).toContain("import styles from './CanonicalDealWorkspace.module.css'");
    expect(dashboard).toContain("import styles from './RoleIntentDashboard.module.css'");
    expect(workspace).not.toContain('<style jsx>');
    expect(dashboard).not.toContain('<style jsx>');
    expect(shell).not.toContain('style={{');
    expect(workspaceStyles).toContain('min-height: 48px');
    expect(workspaceStyles).toContain('@media (max-width: 430px)');
    expect(dashboard).toContain("from '@pc/design-system-v8'");
    expect(designSystemStyles).toContain('min-height: var(--ds-control-height)');
    expect(dashboardStyles).toContain('var(--ds-color');
  });

  it('guides a low-literacy user through forms without exposing deal-context ids', () => {
    expect(commandForm).toContain("import styles from './DealCommandForm.module.css'");
    expect(commandForm).not.toContain('<style jsx>');
    expect(commandForm).not.toContain('style={{');
    expect(commandForm).toContain('Проверь перед подтверждением');
    expect(commandForm).toContain('Не всё заполнено');
    expect(commandForm).toContain('Определить координаты');
    expect(commandForm).toContain("replace(',', '.')");
    expect(commandForm).toContain('contextual: true');
    expect(commandForm).toContain("current?.fields.filter((field) => !field.contextual)");
    expect(commandForm).toContain('Выбрано автоматически из сделки');
    expect(workspace).toContain('initialValues={commandInitialValues(action.id, workspace)}');
    expect(workspace).toContain('values.shipmentId = shipmentId');
    expect(workspace).toContain('values.acceptanceId = acceptanceId');
    expect(commandFormStyles).toContain('min-height: 48px');
    expect(commandFormStyles).toContain('@media (max-width: 560px)');
  });

  it('keeps header complexity behind one clearly labelled utility menu', () => {
    expect(shell).toContain('<HeaderUtilityMenu />');
    expect(shell).toContain('<CalculatorHeaderWidget />');
    expect(shell).not.toContain('<MobileHeaderActionRail />');
    expect(shell).not.toContain('<NotepadHeaderWidget />');
    expect(shell).not.toContain('<SupportHeaderIcon />');
    expect(utilityMenu).toContain('Помощь и инструменты');
    expect(utilityMenu).toContain('Все дополнительные функции собраны в одном месте');
    expect(utilityMenu).toContain("runNativeAction('.pc-v4-search')");
    expect(utilityMenu).toContain("const NOTIFICATIONS_ROUTE = '/platform-v7/notifications'");
    expect(utilityMenu).not.toContain("button[aria-label='Открыть уведомления']");
    expect(utilityMenu).toContain("button[aria-label='Открыть калькулятор']");
    expect(utilityMenu).toContain('PLATFORM_V7_AI_ROUTE');
    expect(utilityMenu).toContain('Статус, инструкция и поддержка');
    expect(utilityMenu).toContain('Выйти из платформы');
    expect(utilityMenu).not.toContain('ROLE_NOTICE');
    expect(utilityMenu).not.toContain('Есть действие');
    expect(utilityStyles).toContain("button[aria-label='Открыть калькулятор']");
    expect(utilityStyles).toContain('min-height: 48px');
    expect(utilityStyles).toContain('@media (max-width: 767px)');
    expect(assistant).not.toContain('pc-v7-assistant-widget');
    expect(assistant).toContain('<WorkStepGuide />');
  });

  it('submits only user-entered payload through real task-first forms', () => {
    expect(workspace).toContain('/commands/${encodeURIComponent(action.id)}');
    expect(workspace).toContain('expectedUpdatedAt: workspace.deal.updatedAt');
    expect(workspace).toContain('expectedVersion: workspace.deal.version');
    expect(workspace).toContain('<DealCommandForm');
    expect(workspace).toContain("applyCsrfHeader({ 'Content-Type': 'application/json'");
    expect(workspace).not.toContain('commandPayload(');
    expect(workspace).not.toContain('user-driver-001');
    expect(workspace).not.toContain('Тестовый водитель');
    expect(workspace).not.toContain('А001АА77');
    expect(commandForm).toContain('assign_logistics');
    expect(commandForm).toContain('confirm_loading');
    expect(commandForm).toContain('confirm_weight');
    expect(commandForm).toContain('finalize_lab');
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

  it('does not assert a transport failure means the command was never received', () => {
    expect(workspace).toContain('Исход команды неизвестен');
    expect(workspace).not.toContain('Действие не отправлено');
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
    expect(shell).toContain(': <RoleIntentDashboard role={verifiedRole} />');
    expect(shell).toContain("data-controlled-owner-cabinet-preview='true'");
    expect(shell).toContain('{children}');
    expect(shell).toContain(': children;');
  });

  it('never fabricates a successful execution response when the real API is unavailable', () => {
    expect(proxy).toContain('requiresRealBackend');
    expect(proxy).toContain(String.raw`^deals\/[^/]+\/(execution-workspace|correlation-timeline)$`);
    expect(proxy).toContain(String.raw`^deals\/[^/]+\/commands\/`);
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

const dealSnapshot = {
  deal: {
    id: 'deal-unknown-1', number: 'PC-1', status: 'OPEN', version: '1', updatedAt: '2026-09-25T00:00:00Z',
    culture: null, cropClass: null, volumeTons: null, pricePerTon: null, totalKopecks: null, currency: 'RUB',
  },
  roleProjection: {
    role: 'FARMER', focus: 'Проверка', canAct: true,
    primaryAction: { id: 'confirm_action', label: 'Подтвердить действие', enabled: true, source: 'USER', waitingForRoles: [] },
  },
  attention: '', blockers: [], money: null, spine: [], shipments: [], documents: [], laboratory: [],
  acceptance: [], disputes: [], timeline: [],
};

describe('canonical Deal command outcome after an uncertain response', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    { name: 'connection loss after POST', reply: async () => { throw new TypeError('connection reset'); } },
    { name: 'aborted response', reply: async () => { throw new DOMException('aborted', 'AbortError'); } },
    { name: 'HTTP 503 after possible mutation', reply: async () => ({ ok: false, status: 503, json: async () => ({ message: 'backend unavailable' }) }) },
    { name: 'rate limit after possible mutation', reply: async () => ({ ok: false, status: 429, json: async () => ({ message: 'retry later' }) }) },
    { name: 'unverifiable HTTP 200 body', reply: async () => ({ ok: true, json: async () => ({ ok: true, commandId: 'another-command' }) }) },
  ])('keeps $name UNKNOWN and blocks a new command identity even after refresh', async ({ reply }) => {
    const fetchMock = vi.fn(async (_url: string, options?: { method?: string }) =>
      options?.method === 'POST' ? reply() : { ok: true, json: async () => dealSnapshot });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(CanonicalDealWorkspace, { role: 'seller', dealId: dealSnapshot.deal.id }));
    const submit = await screen.findByRole('button', { name: 'Подтвердить действие' });
    fireEvent.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent('Исход команды неизвестен');
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Обновить сделку' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, options]) => options?.method !== 'POST')).toHaveLength(2));
    expect(submit).toBeDisabled();
  });

  it('accepts only a success receipt bound to the submitted command id', async () => {
    const fetchMock = vi.fn(async (_url: string, options?: { method?: string; body?: string }) =>
      options?.method === 'POST'
        ? { ok: true, json: async () => ({ ok: true, commandId: JSON.parse(options.body || '{}').commandId }) }
        : { ok: true, json: async () => dealSnapshot });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(CanonicalDealWorkspace, { role: 'seller', dealId: dealSnapshot.deal.id }));
    fireEvent.click(await screen.findByRole('button', { name: 'Подтвердить действие' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Результат записан в сделку');
    expect(screen.queryByText(/Исход команды неизвестен/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it('keeps a definite validation rejection separate from UNKNOWN', async () => {
    const fetchMock = vi.fn(async (_url: string, options?: { method?: string }) =>
      options?.method === 'POST'
        ? { ok: false, status: 422, json: async () => ({ message: 'Проверка не пройдена' }) }
        : { ok: true, json: async () => dealSnapshot });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(CanonicalDealWorkspace, { role: 'seller', dealId: dealSnapshot.deal.id }));
    const submit = await screen.findByRole('button', { name: 'Подтвердить действие' });
    fireEvent.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent('Проверка не пройдена');
    expect(submit).not.toBeDisabled();
    expect(screen.queryByText(/Исход команды неизвестен/)).not.toBeInTheDocument();
  });
});

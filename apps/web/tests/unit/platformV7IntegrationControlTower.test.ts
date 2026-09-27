import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IntegrationControlTowerClient } from '@/components/crop-platform/IntegrationControlTowerClient';
import { canRoleAccessCabinet } from '@/lib/platform-v7/cabinet-access-policy';
import { isDesignSystemV8Route } from '@/lib/platform-v7/design-system-v8-route-policy';
import { PLATFORM_V7_INTEGRATIONS_ROUTE } from '@/lib/platform-v7/routes';

vi.mock('../../../../packages/design-system-v8/src', async () => {
  const React = await import('react');
  return {
    Button: ({ children, variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => React.createElement('button', props, children),
    Surface: ({ children, variant: _variant, padded: _padded, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: string; padded?: boolean }) => React.createElement('div', props, children),
    InlineNotice: ({ children, title, tone, icon: _icon }: { children?: React.ReactNode; title: string; tone?: string; icon?: React.ReactNode }) =>
      React.createElement('div', { role: tone === 'critical' ? 'alert' : undefined }, title, children),
    StatusChip: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
  };
});

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative: string) => fs.existsSync(path.join(root, relative));

describe('Platform V7 Integration Control Tower vertical', () => {
  it('provides protected list/detail pages and private BFF routes', () => {
    expect(exists('app/platform-v7/integrations/page.tsx')).toBe(true);
    expect(exists('app/platform-v7/integrations/[adapterCode]/page.tsx')).toBe(true);
    expect(exists('app/api/platform-v7/integrations/[[...path]]/route.ts')).toBe(true);
    expect(exists('app/api/staff/integration-control-tower/[[...path]]/route.ts')).toBe(true);
    expect(exists('app/api/staff/integrations/inbox/[entryId]/commands/redrive/route.ts')).toBe(true);
    expect(exists('app/api/staff/integrations/[adapterCode]/commands/reconcile/route.ts')).toBe(true);
    const page = read('app/platform-v7/integrations/page.tsx');
    expect(page).toContain('ACCESS_COOKIE');
    expect(page).toContain("redirect('/platform-v7/login");
    expect(page).toContain("data-authority='postgresql-private-bff'");
    expect(page).toContain("data-static-authority-fallback='false'");
  });

  it('keeps all browser reads behind authenticated no-store proxies', () => {
    const readBff = read('app/api/platform-v7/integrations/[[...path]]/route.ts');
    const staffBff = read('app/api/staff/integration-control-tower/[[...path]]/route.ts');
    for (const source of [readBff, staffBff]) {
      expect(source).toContain('ACCESS_COOKIE');
      expect(source).toContain("cache: 'no-store'");
      expect(source).toContain("redirect: 'manual'");
      expect(source).toContain('AbortSignal.timeout(8_000)');
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('sessionStorage');
    }
    expect(staffBff).toContain('pc_staff_access_token');
    expect(staffBff).toContain('X-Staff-Access-Session');
  });

  it('requires CSRF, staff JIT and If-Match for write proxies', () => {
    const proxy = read('app/api/staff/integrations/_command-proxy.ts');
    expect(proxy).toContain('assertCsrf(request)');
    expect(proxy).toContain('pc_staff_access_token');
    expect(proxy).toContain("request.headers.get('if-match')");
    expect(proxy).toContain("'If-Match': ifMatch");
    expect(proxy).toContain('MAX_BODY_BYTES');
    expect(proxy).toContain("redirect: 'manual'");
    expect(proxy).not.toContain('role:');
    expect(proxy).not.toContain('tenantId:');
  });

  it('does not provide fixtures, local authority or fake live status', () => {
    const client = read('components/crop-platform/IntegrationControlTowerClient.tsx');
    const adapter = read('components/crop-platform/integration-control-tower-live-adapter.ts');
    expect(client).toContain("data-static-authority-fallback='false'");
    expect(client).not.toContain('localStorage');
    expect(client).toContain("const COMMAND_INTERLOCK_KEY = 'pc.integration-control-tower.pending-command.v1'");
    expect(client).toContain('window.sessionStorage.setItem(COMMAND_INTERLOCK_KEY, serialized)');
    expect(client).not.toContain('sessionStorage.setItem(COMMAND_INTERLOCK_KEY, csrfToken');
    expect(client).not.toContain('fixture');
    expect(adapter).not.toContain('MOCK_OK');
    expect(adapter).not.toContain('LIVE_SIMULATED');
    expect(adapter).toContain('CONFIRMED_LIVE');
    expect(adapter).toContain('ADAPTER_READY');
    expect(adapter).toContain('requiresConfirmation: true');
  });

  it('renders explicit loading, empty, forbidden, error, conflict, stale, reconnecting and degraded states', () => {
    const client = read('components/crop-platform/IntegrationControlTowerClient.tsx');
    for (const state of ['loading', 'empty', 'forbidden', 'error', 'conflict', 'stale', 'reconnecting', 'degraded']) {
      expect(client).toContain(`'${state}'`);
    }
    expect(client).toContain("role='dialog'");
    expect(client).toContain("aria-modal='true'");
  });

  it('keeps FGIS freshness, capabilities, applicability and finality truth boundaries explicit in RU EN ZH', () => {
    const client = read('components/crop-platform/IntegrationControlTowerClient.tsx');

    expect(client).toContain("freshness: 'Последний серверный факт'");
    expect(client).toContain("freshness: 'Latest server-held fact'");
    expect(client).toContain("freshness: '服务器持有的最新事实'");
    expect(client).toContain('does not prove that the authoritative external government source is current now');
    expect(client).toContain('не подтверждает, что данные во внешней государственной системе актуальны сейчас');

    expect(client).toContain("data-capabilities-authority='server-provided-non-live-proof'");
    expect(client).toContain('They do not prove credentials, an active binding or live provider connectivity.');
    expect(client).toContain('не доказывает наличие credentials, активного binding или live-соединения с провайдером');
    expect(client).toContain("noCapabilities: 'Сервер не сообщил ни одной возможности.'");
    expect(client).toContain("noCapabilities: 'The server reported no capabilities.'");
    expect(client).toContain("noCapabilities: '服务器未报告任何能力。'");
    expect(client).toContain("selected.capabilities.length > 0 ? selected.capabilities.join(' · ') : copy.noCapabilities");
    expect(client).not.toContain("selected.capabilities.length > 0 ? selected.capabilities.join(' · ') : copy.notExposed");

    expect(client).toContain("data-regulatory-applicability='UNKNOWN_NOT_EXPOSED'");
    expect(client).toContain('UNKNOWN / NOT EXPOSED');
    expect(client).toContain('per-Deal applicability, rule/version/source/evidence or blocking stage');
    expect(client).toContain('客户端不会根据系统存在、capabilities、ACK 或适配器状态自行推断');

    expect(client).toContain("lastSuccess: 'Последнее обработанное событие'");
    expect(client).toContain("lastSuccess: 'Last processed event'");
    expect(client).toContain("lastSuccess: '最近处理的事件'");
    expect(client).not.toContain("lastSuccess: 'Последний успех'");
    expect(client).not.toContain("lastSuccess: 'Last success'");
    expect(client).not.toContain("lastSuccess: '最近成功'");

    expect(client).toContain('Provider ACK or HTTP 2xx is only transport/provider acknowledgement.');
    expect(client).toContain('ACK провайдера или HTTP 2xx — только транспортное/провайдерское подтверждение.');
    expect(client).toContain('业务接受单独记录');
    expect(client).toContain("notRecorded: 'UNKNOWN / NOT RECORDED'");
    expect(client).toContain('formatDate(event.providerAcknowledgedAt, locale, copy.notRecorded)');
    expect(client).toContain('formatDate(event.businessAcceptedAt, locale, copy.notRecorded)');
  });

  it('does not infer legal applicability or business finality from capabilities or acknowledgement', () => {
    const client = read('components/crop-platform/IntegrationControlTowerClient.tsx');
    expect(client).toContain('selected.capabilities.join');
    expect(client).not.toContain('selected.capabilities.includes');
    expect(client).not.toMatch(/providerAcknowledgedAt\s*\?\s*[^:\n]*(success|final|accepted)/iu);
    expect(client).not.toMatch(/capabilities\.(includes|some).*NOT_APPLICABLE/iu);
    expect(client).not.toContain("data-regulatory-applicability='NOT_APPLICABLE'");
  });

  it('requires a matching server audit/outbox receipt, never a bare 2xx body', () => {
    const client = read('components/crop-platform/IntegrationControlTowerClient.tsx');
    expect(client).toContain("receipt.kind !== 'APPLIED' && receipt.kind !== 'REPLAY'");
    expect(client).toContain('receipt.correlationId !== command.correlationId');
    expect(client).toContain("typeof receipt.auditEventId !== 'string' || !receipt.auditEventId.trim()");
    expect(client).toContain("typeof receipt.outboxEntryId !== 'string' || !receipt.outboxEntryId.trim()");
    expect(client).toContain('receipt.entryId === command.entryId && !!command.entryId');
    expect(client).toContain('receipt.adapterCode === command.adapterCode');
    expect(client).toContain("typeof receipt.aggregateVersion === 'string' && !!receipt.aggregateVersion.trim()");
    expect(client).toContain('if (!matchesControlTowerCommandReceipt(payload, command))');
    expect(client).toContain('const receiptNotice = receipt?.sessionScope === verifiedScope ? (');
    expect(client.match(/\{receiptNotice\}/g)).toHaveLength(2);
    expect(client).toMatch(/if \(visibleState\.phase !== 'ready'\)[\s\S]*?\{receiptNotice\}[\s\S]*?<Surface/);
  });

  it('keeps an ambiguous command outcome visible and blocks another command in the mounted screen', () => {
    const client = read('components/crop-platform/IntegrationControlTowerClient.tsx');
    expect(client).toContain("data-command-outcome='UNKNOWN'");
    expect(client).toContain("<InlineNotice tone='critical' title={effectiveUnknownCommand.kind === 'command' ? copy.unknownCommand : copy.storageInterlock}");
    expect(client).not.toContain("className={styles.unknownCommand} role='alert'");
    expect(client).toContain('const unknownNotice = effectiveUnknownCommand ? (');
    expect(client.match(/\{unknownNotice\}/g)).toHaveLength(2);
    expect(client).toMatch(/if \(visibleState\.phase !== 'ready'\)[\s\S]*?\{unknownNotice\}[\s\S]*?<Surface/);
    expect(client).toContain('disabled={!selected.primaryAction.allowed || !!effectiveUnknownCommand || !storageReady || !verifiedScope}');
    expect(client).toContain('if (!selected || effectiveUnknownCommand || !storageReady || !verifiedScope) return;');
    expect(client).toContain('if (!matchesControlTowerCommandReceipt(payload, command))');
    expect(client).toContain('signal: controller.signal');
    expect(client).toContain('markUnknown();');
    expect(client).toContain('setPending(null);');
    expect(client).toContain("receipt: 'Сервер подтвердил запись команды в audit/outbox.");
    expect(client).toContain("receipt: 'The server confirmed the command record in audit/outbox.");
    expect(client).toContain("receipt: '服务器已确认 audit/outbox 中的命令记录");
    expect(client).toContain('Refreshing the list alone does not establish its outcome.');
    expect(client).toContain('Обновление списка само по себе не подтверждает её исход.');
    expect(client).toContain('刷新列表本身不能证明结果。');
    expect(client).not.toContain("setReceipt('The server committed the command");
    const css = read('components/crop-platform/IntegrationControlTowerClient.module.css');
    expect(css).toContain('.unknownCommand code');
    expect(css).toContain('overflow-wrap: anywhere');
  });

  it('limits cabinet access to operator, compliance and executive', () => {
    expect(PLATFORM_V7_INTEGRATIONS_ROUTE).toBe('/platform-v7/integrations');
    expect(canRoleAccessCabinet('operator', PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(true);
    expect(canRoleAccessCabinet('compliance', PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(true);
    expect(canRoleAccessCabinet('executive', PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(true);
    expect(canRoleAccessCabinet('buyer', PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(false);
    expect(canRoleAccessCabinet('seller', PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(false);
    expect(isDesignSystemV8Route(PLATFORM_V7_INTEGRATIONS_ROUTE)).toBe(true);
    expect(isDesignSystemV8Route('/platform-v7/integrations/FGIS_ZERNO')).toBe(true);
  });

  it('has responsive, focus-visible and reduced-motion boundaries', () => {
    const css = read('components/crop-platform/IntegrationControlTowerClient.module.css');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('safe-area-inset-bottom');
  });
});

function controlTowerRecord() {
  return {
    adapterCode: 'FGIS_GRAIN', adapterVersion: '1.0.0', provider: 'government-adapter',
    capabilities: [], environment: 'SANDBOX', honestStatus: 'ADAPTER_READY',
    schemaVersion: 'v1', mappingVersion: 'm1', freshnessAt: '2026-09-26T07:00:00.000Z',
    lastSuccessAt: null, lastErrorAt: null, lastErrorCode: null, inboxDepth: 0,
    oldestEventAt: null, retryCount: 0, quarantineCount: 0, deadCount: 0,
    processingCount: 0, conflictCount: 0, providerAcknowledgedCount: 0, businessAcceptedCount: 0,
    reconciliationState: 'NOT_REQUESTED', reconciliationUpdatedAt: null,
    credentialReferenceExpiresAt: null, credentialMetadataAvailable: false, aggregateVersion: '1',
    primaryAction: {
      id: 'RECONCILE', allowed: true, reasonCode: 'ALLOWED',
      requiresConfirmation: true, owner: 'OPERATOR', impact: 'HIGH', entryId: null,
    },
    recentEvents: [],
  };
}

async function submitReconcile() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Запустить сверку' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Сверить серверную запись и статус' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Подтвердить на сервере' }));
}

describe('Integration Control Tower command outcome in the mounted screen', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    expect(window.sessionStorage.getItem('pc.integration-control-tower.pending-command.v1')).toBeNull();
    expect(vi.isMockFunction(window.sessionStorage.getItem)).toBe(false);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.sessionStorage.clear(); });

  it.each([
    { name: 'unverifiable 2xx', reply: async () => ({ ok: true, json: async () => ({ ok: true }) }) },
    { name: 'thrown POST', reply: async () => { throw new TypeError('connection lost'); } },
    { name: 'untyped 409', reply: async () => ({ ok: false, status: 409, json: async () => ({}) }) },
    { name: 'mismatched typed 409', reply: async () => ({ ok: false, status: 409, json: async () => ({ code: 'CSRF_REJECTED' }) }) },
  ])('keeps $name UNKNOWN after refresh and prevents a second command', async ({ reply }) => {
    const record = controlTowerRecord();
    let markerAtPost: string | null = null;
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        markerAtPost = window.sessionStorage.getItem('pc.integration-control-tower.pending-command.v1');
        return reply();
      }
      return { ok: true, status: 200, json: async () => _url.includes('?limit=')
        ? { items: [record], nextCursor: null }
        : record };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'test-csrf' }));
    await submitReconcile();

    expect(await screen.findByText(/Исход команды не подтверждён/)).toBeInTheDocument();
    const warning = document.querySelector('[data-command-outcome="UNKNOWN"]');
    expect(warning).toHaveTextContent('Command ID');
    expect(warning).toHaveTextContent('Correlation ID');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(markerAtPost).not.toBeNull();
    expect(markerAtPost).not.toContain('test-csrf');
    expect(markerAtPost).not.toContain('Сверить серверную запись');
    expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, options]) => options?.method !== 'POST')).toHaveLength(4));
    expect(screen.getByText(/Исход команды не подтверждён/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it.each([
    { name: 'stale version', status: 409, code: 'INTEGRATION_STALE_VERSION', retry: true },
    { name: 'forbidden JIT authority', status: 403, code: 'INTEGRATION_JIT_AUTHORITY_REQUIRED', retry: false },
  ])('accepts typed precommit $name as a rejection, not an unknown command', async ({ status, code, retry }) => {
    const record = controlTowerRecord();
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST'
      ? { ok: false, status, json: async () => ({ code, retryable: retry }) }
      : { ok: true, status: 200, json: async () => _url.includes('?limit=')
        ? { items: [record], nextCursor: null }
        : record });
    vi.stubGlobal('fetch', fetchMock);
    render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'test-csrf' }));
    await submitReconcile();

    expect(await screen.findByText(code)).toBeInTheDocument();
    expect(document.querySelector('[data-command-outcome="UNKNOWN"]')).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('pc.integration-control-tower.pending-command.v1')).toBeNull();
    if (retry) {
      fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeEnabled());
    } else {
      expect(screen.queryByRole('button', { name: 'Обновить' })).not.toBeInTheDocument();
    }
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it('restores the same-tab UNKNOWN interlock after remount and hides identifiers after session rotation', async () => {
    const record = controlTowerRecord();
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST'
      ? { ok: false, status: 409, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => _url.includes('?limit=')
        ? { items: [record], nextCursor: null }
        : record });
    vi.stubGlobal('fetch', fetchMock);
    const first = render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'test-csrf' }));
    await submitReconcile();
    expect(await screen.findByText(/Исход команды не подтверждён/)).toBeInTheDocument();
    const priorCommandId = document.querySelector('[data-command-outcome="UNKNOWN"] code')?.textContent;
    expect(priorCommandId).toBeTruthy();
    first.unmount();

    const sameSession = render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'test-csrf' }));
    expect(await screen.findByText(/Исход команды не подтверждён/)).toBeInTheDocument();
    expect(document.querySelector('[data-command-outcome="UNKNOWN"]')).toHaveTextContent(priorCommandId!);
    expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, options]) => options?.method !== 'POST')).toHaveLength(6));
    expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeDisabled();
    sameSession.unmount();

    render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'rotated-csrf' }));
    await waitFor(() => expect(screen.getByText(/Новые команды в этой вкладке заблокированы/)).toBeInTheDocument());
    expect(document.querySelector('[data-command-outcome="UNKNOWN"]')).not.toHaveTextContent(priorCommandId!);
    expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it.each(['read', 'write'])('fails closed when tab storage %s fails', async (failure) => {
    const record = controlTowerRecord();
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => ({
      ok: true, status: 200, json: async () => _url.includes('?limit=')
        ? { items: [record], nextCursor: null }
        : record,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const storage = window.sessionStorage;
    if (failure === 'read') vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('storage denied'); },
      setItem: storage.setItem.bind(storage),
      removeItem: storage.removeItem.bind(storage),
    });
    render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'test-csrf' }));
    if (failure === 'write') {
      await waitFor(() => expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeEnabled());
      vi.stubGlobal('sessionStorage', {
        getItem: storage.getItem.bind(storage),
        setItem: () => { throw new Error('storage denied'); },
        removeItem: storage.removeItem.bind(storage),
      });
      await submitReconcile();
    }
    expect(await screen.findByText(/Новые команды в этой вкладке заблокированы/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  });

  it('keeps a typed precommit rejection blocked if the stored marker cannot be removed', async () => {
    const record = controlTowerRecord();
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST'
      ? { ok: false, status: 409, json: async () => ({ code: 'INTEGRATION_STALE_VERSION' }) }
      : { ok: true, status: 200, json: async () => _url.includes('?limit=')
        ? { items: [record], nextCursor: null }
        : record });
    vi.stubGlobal('fetch', fetchMock);
    render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'test-csrf' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeEnabled());
    const storage = window.sessionStorage;
    vi.stubGlobal('sessionStorage', {
      getItem: storage.getItem.bind(storage),
      setItem: storage.setItem.bind(storage),
      removeItem: () => { throw new Error('storage denied'); },
    });
    await submitReconcile();

    expect(await screen.findByText(/Новые команды в этой вкладке заблокированы/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeDisabled();
    expect(storage.getItem('pc.integration-control-tower.pending-command.v1')).not.toBeNull();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it('disables actions immediately when the CSRF session scope changes', async () => {
    const record = controlTowerRecord();
    vi.stubGlobal('fetch', vi.fn(async (_url: string) => ({
      ok: true, status: 200, json: async () => _url.includes('?limit=')
        ? { items: [record], nextCursor: null }
        : record,
    })));
    const mounted = render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'test-csrf' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Запустить сверку' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    mounted.rerender(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'rotated-csrf' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Запустить сверку' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeEnabled());
  });

  it('hides A records immediately, reloads B, and discards a delayed A read', async () => {
    const a = { ...controlTowerRecord(), adapterCode: 'FGIS_A_PRIVATE', provider: 'A-secret-provider' };
    const b = { ...controlTowerRecord(), adapterCode: 'FGIS_B_CURRENT', provider: 'B-provider' };
    let browserSession = 'A';
    let delayAReconnect = false;
    let releaseA!: (reply: ReturnType<typeof listReply>) => void;
    let releaseB!: (reply: ReturnType<typeof listReply>) => void;
    const listReply = (record: typeof a) => ({ ok: true, status: 200, json: async () => ({ items: [record], nextCursor: null }) });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('?limit=')) {
        if (browserSession === 'A' && delayAReconnect) return new Promise<ReturnType<typeof listReply>>((resolve) => { releaseA = resolve; });
        if (browserSession === 'B') return new Promise<ReturnType<typeof listReply>>((resolve) => { releaseB = resolve; });
        return listReply(a);
      }
      const record = url.includes(b.adapterCode) ? b : a;
      return { ok: true, status: 200, json: async () => record };
    });
    vi.stubGlobal('fetch', fetchMock);
    const mounted = render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'csrf-A' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeEnabled());
    expect(screen.getAllByText('FGIS_A_PRIVATE').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText('Код адаптера или провайдер'), { target: { value: 'A-secret' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'DEGRADED' } });
    delayAReconnect = true;
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(typeof releaseA).toBe('function'));
    browserSession = 'B';
    mounted.rerender(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'csrf-B' }));
    expect(screen.queryAllByText('FGIS_A_PRIVATE')).toHaveLength(0);
    expect(screen.queryByText('A-secret-provider')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Запустить сверку' })).not.toBeInTheDocument();
    await waitFor(() => expect(typeof releaseB).toBe('function'));
    await act(async () => releaseB(listReply(b)));
    await waitFor(() => expect(screen.getAllByText('FGIS_B_CURRENT').length).toBeGreaterThan(0));
    expect(screen.getByPlaceholderText('Код адаптера или провайдер')).toHaveValue('');
    expect(screen.getByRole('combobox')).toHaveValue('ALL');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeEnabled());
    await act(async () => releaseA(listReply(a)));
    expect(screen.queryAllByText('FGIS_A_PRIVATE')).toHaveLength(0);
    expect(screen.getAllByText('FGIS_B_CURRENT').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeEnabled();
  });

  it.each([
    { name: 'UNKNOWN', failRemoval: false, reply: { ok: false, status: 409, json: async () => ({}) } },
    { name: 'typed rejection', failRemoval: false, reply: { ok: false, status: 409, json: async () => ({ code: 'INTEGRATION_STALE_VERSION' }) } },
    { name: 'typed rejection with denied marker removal', failRemoval: true, reply: { ok: false, status: 409, json: async () => ({ code: 'INTEGRATION_STALE_VERSION' }) } },
    { name: 'verified receipt', failRemoval: false, reply: { ok: true, status: 200, json: async () => ({
      kind: 'APPLIED', adapterCode: 'FGIS_GRAIN', correlationId: '',
      auditEventId: 'audit-1', outboxEntryId: 'outbox-1', aggregateVersion: '2',
    }) } },
  ])('does not disclose a prior session’s $name after a late POST reply', async ({ name, failRemoval, reply }) => {
    const record = controlTowerRecord();
    let resolvePost!: (response: typeof reply) => void;
    const delayedPost = new Promise<typeof reply>((resolve) => { resolvePost = resolve; });
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'POST'
      ? delayedPost
      : { ok: true, status: 200, json: async () => _url.includes('?limit=')
        ? { items: [record], nextCursor: null }
        : record });
    vi.stubGlobal('fetch', fetchMock);
    const mounted = render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'test-csrf' }));
    await submitReconcile();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1));
    const raw = window.sessionStorage.getItem('pc.integration-control-tower.pending-command.v1');
    expect(raw).not.toBeNull();
    const oldCommand = JSON.parse(raw!) as { commandId: string; correlationId: string };
    mounted.rerender(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'rotated-csrf' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Запустить сверку' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Новые команды в этой вкладке заблокированы/)).toBeInTheDocument());
    if (failRemoval) {
      const storage = window.sessionStorage;
      vi.stubGlobal('sessionStorage', {
        getItem: storage.getItem.bind(storage),
        setItem: storage.setItem.bind(storage),
        removeItem: () => { throw new Error('storage denied'); },
      });
    }
    await act(async () => resolvePost(name === 'verified receipt'
      ? { ...reply, json: async () => ({ ...await reply.json(), correlationId: oldCommand.correlationId }) }
      : reply));
    const warning = document.querySelector('[data-command-outcome="UNKNOWN"]');
    if (name === 'UNKNOWN' || failRemoval) expect(warning).toHaveTextContent('Новые команды в этой вкладке заблокированы');
    if (warning) expect(warning).toHaveTextContent('Новые команды в этой вкладке заблокированы');
    expect(document.body).not.toHaveTextContent(oldCommand.commandId);
    expect(document.body).not.toHaveTextContent(oldCommand.correlationId);
    expect(screen.queryByText('INTEGRATION_STALE_VERSION')).not.toBeInTheDocument();
    expect(screen.queryByText(/Сервер подтвердил запись команды в audit\/outbox/)).not.toBeInTheDocument();
    if (name === 'UNKNOWN' || failRemoval) {
      await waitFor(() => expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeDisabled());
    } else {
      await waitFor(() => expect(screen.getByRole('button', { name: 'Запустить сверку' })).toBeEnabled());
      expect(window.sessionStorage.getItem('pc.integration-control-tower.pending-command.v1')).toBeNull();
    }
  });

  it('keeps a verified server receipt visible when the subsequent read fails', async () => {
    const record = controlTowerRecord();
    let reads = 0;
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        const command = JSON.parse(String(options.body)) as { correlationId: string };
        return { ok: true, status: 200, json: async () => ({
          kind: 'APPLIED', adapterCode: record.adapterCode, correlationId: command.correlationId,
          auditEventId: 'audit-1', outboxEntryId: 'outbox-1', aggregateVersion: '2',
        }) };
      }
      reads += 1;
      if (reads > 2) throw new TypeError('read failed after server receipt');
      return { ok: true, status: 200, json: async () => _url.includes('?limit=')
        ? { items: [record], nextCursor: null }
        : record };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(React.createElement(IntegrationControlTowerClient, { locale: 'ru', csrfToken: 'test-csrf' }));
    await submitReconcile();

    expect(await screen.findByText('read failed after server receipt')).toBeInTheDocument();
    expect(screen.getByText(/Сервер подтвердил запись команды в audit\/outbox/)).toBeInTheDocument();
    expect(screen.getByText(/Это не подтверждает обработку внешней системой/)).toBeInTheDocument();
    expect(screen.queryByText(/Исход команды не подтверждён/)).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('pc.integration-control-tower.pending-command.v1')).toBeNull();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });
});

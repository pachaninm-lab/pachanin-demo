import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntegrationControlTowerClient } from '@/components/crop-platform/IntegrationControlTowerClient';
import { canRoleAccessCabinet } from '@/lib/platform-v7/cabinet-access-policy';
import { isDesignSystemV8Route } from '@/lib/platform-v7/design-system-v8-route-policy';
import { PLATFORM_V7_INTEGRATIONS_ROUTE } from '@/lib/platform-v7/routes';

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
    expect(page).toMatch(/redirect\(['"`]\/platform-v7\/login\?/);
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
    expect(client).not.toContain('sessionStorage');
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

describe('Control Tower confirmation keyboard focus', () => {
  // Explicit local read/command boundaries; no real provider or staff mutation.
  const record = {
    adapterCode: 'FGIS_ZERNO', adapterVersion: '1', provider: 'LOCAL_TEST_BOUNDARY',
    capabilities: [], environment: 'TEST', honestStatus: 'ADAPTER_READY',
    schemaVersion: '1', mappingVersion: '1', freshnessAt: '2026-10-09T00:00:00Z',
    lastSuccessAt: null, lastErrorAt: null, lastErrorCode: null,
    inboxDepth: 0, oldestEventAt: null, retryCount: 0, quarantineCount: 0,
    deadCount: 0, processingCount: 0, conflictCount: 0,
    providerAcknowledgedCount: 0, businessAcceptedCount: 0,
    reconciliationState: 'NOT_REQUESTED', reconciliationUpdatedAt: null,
    credentialReferenceExpiresAt: null, credentialMetadataAvailable: false,
    aggregateVersion: '7', recentEvents: [],
    primaryAction: { id: 'RECONCILE', allowed: true, reasonCode: 'ALLOWED',
      requiresConfirmation: true, owner: 'OPERATOR', impact: 'HIGH', entryId: null },
  };
  const locales = [
    { locale: 'ru', action: 'Запустить сверку' },
    { locale: 'en', action: 'Start reconciliation' },
    { locale: 'zh', action: '启动核对' },
  ];
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  async function mount(locale: string, action: string, post?: (init: RequestInit) => Promise<Response>, beforeRead?: () => Promise<void> | undefined, readRecord: unknown = record) {
    const fetchBoundary = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'POST') {
        if (!post) throw new Error('unexpected command');
        return post(init);
      }
      if (!url.startsWith('/api/staff/integration-control-tower')) throw new Error(`unexpected read ${url}`);
      await beforeRead?.();
      return new Response(JSON.stringify(url.includes('eventLimit=') ? readRecord : { items: [readRecord], nextCursor: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchBoundary);
    const user = userEvent.setup();
    const view = render(React.createElement(IntegrationControlTowerClient, { locale, csrfToken: 'local-focus-boundary' }));
    const trigger = await screen.findByRole('button', { name: action });
    await user.click(trigger);
    return { user, trigger, fetchBoundary, view, dialog: screen.getByRole('dialog'), reason: screen.getByRole('textbox') as HTMLTextAreaElement };
  }

  it.each(locales)('focuses the reason, contains Tab and restores the trigger after Escape in $locale', async ({ locale, action }) => {
    const { user, trigger, reason, dialog, fetchBoundary } = await mount(locale, action);
    expect(document.activeElement).toBe(reason);
    await user.type(reason, 'Verifiable local keyboard reason');
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab();
    expect(document.activeElement).toBe(reason);
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it.each(locales)('keeps executing focus contained and ignores Escape and backdrop dismissal in $locale', async ({ locale, action }) => {
    let finish!: (response: Response) => void;
    const response = new Promise<Response>(resolve => { finish = resolve; });
    const { user, reason, dialog, fetchBoundary } = await mount(locale, action, () => response);
    await user.type(reason, 'Verifiable local keyboard reason');
    const buttons = dialog.querySelectorAll('button');
    await user.click(buttons[1]!);
    await waitFor(() => expect(dialog).toHaveAttribute('aria-busy', 'true'));
    expect(reason).toHaveAttribute('readonly');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBe(dialog);
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.click(dialog.parentElement!);
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    await act(async () => { finish(new Response(JSON.stringify({ message: 'Local version rejection' }),
      { status: 428, headers: { 'Content-Type': 'application/json' } })); });
    const heading = await screen.findByRole('heading', { name: 'Local version rejection' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it('keeps focus after a delayed read replaces the temporary loading heading', async () => {
    let posted = false;
    let releaseRead!: () => void;
    const readReady = new Promise<void>(resolve => { releaseRead = resolve; });
    const { user, reason, dialog, fetchBoundary } = await mount('en', 'Start reconciliation', async init =>
      { posted = true; return new Response(JSON.stringify(receiptFor(init)), { status: 200 }); },
      () => posted ? readReady : undefined);
    await user.type(reason, 'Verifiable local keyboard reason');
    await user.click(dialog.querySelectorAll('button')[1]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const loadingHeading = screen.getByRole('heading', { level: 1 });
    await waitFor(() => expect(document.activeElement).toBe(loadingHeading));
    await act(async () => { releaseRead(); });
    await screen.findByRole('button', { name: 'Start reconciliation' });
    const finalHeading = screen.getByRole('heading', { level: 1 });
    expect(finalHeading).not.toBe(loadingHeading);
    await waitFor(() => expect(document.activeElement).toBe(finalHeading));
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it('does not restore focus to the origin belonging to a changed session', async () => {
    const { user, trigger, view, fetchBoundary } = await mount('en', 'Start reconciliation');
    view.rerender(React.createElement(IntegrationControlTowerClient, { locale: 'en', csrfToken: 'changed-local-session' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).not.toBe(trigger));
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it('restores the heading when a read disables the original action while the dialog is open', async () => {
    const { user, trigger, fetchBoundary } = await mount('en', 'Start reconciliation');
    const deniedRecord = { ...record, primaryAction: { ...record.primaryAction, allowed: false, reasonCode: 'STAFF_AUTHORITY_REQUIRED' } };
    fetchBoundary.mockImplementation(async (input, init) => {
      const url = String(input);
      if (init?.method === 'POST' || !url.startsWith('/api/staff/integration-control-tower')) throw new Error('unexpected command or read');
      return new Response(JSON.stringify(url.includes('eventLimit=') ? deniedRecord : { items: [deniedRecord], nextCursor: null }), { status: 200 });
    });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(trigger).toBeDisabled());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })));
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  function receiptFor(init: RequestInit, kind: 'APPLIED' | 'REPLAY' = 'APPLIED') {
    const command = JSON.parse(String(init.body)) as { correlationId: string };
    return { kind, adapterCode: record.adapterCode, aggregateVersion: '7',
      auditEventId: 'local-audit-evidence', outboxEntryId: 'local-outbox-evidence', correlationId: command.correlationId };
  }

  const redriveEntryId = 'local-dead-inbox-entry';
  const redriveRecord = { ...record, recentEvents: [{
    id: redriveEntryId, provider: record.provider, externalEventId: 'local-external-event',
    state: 'DEAD', schemaVersion: '1', mappingVersion: '1', receivedAt: record.freshnessAt, occurredAt: record.freshnessAt,
    attempts: 3, nextAttemptAt: null, providerAcknowledgedAt: null, businessAcceptedAt: null,
    lastErrorCode: 'LOCAL_FAILURE', lastErrorCategory: 'LOCAL_FAILURE', correlationId: 'local-event-correlation', version: '7',
  }], primaryAction: { ...record.primaryAction, id: 'REDRIVE', entryId: redriveEntryId } };

  it.each([
    { action: 'RECONCILE', kind: 'APPLIED' }, { action: 'RECONCILE', kind: 'REPLAY' },
    { action: 'REDRIVE', kind: 'APPLIED' }, { action: 'REDRIVE', kind: 'REPLAY' },
  ] as const)('accepts the current canonical $action/$kind receipt without provider finality', async ({ action, kind }) => {
    const isRedrive = action === 'REDRIVE';
    const { user, reason, dialog, fetchBoundary } = await mount('en', isRedrive ? 'Redrive event' : 'Start reconciliation', async init => {
      const receipt = receiptFor(init, kind);
      return new Response(JSON.stringify(isRedrive ? {
        kind, entryId: redriveEntryId, auditEventId: receipt.auditEventId,
        outboxEntryId: receipt.outboxEntryId, correlationId: receipt.correlationId,
      } : receipt), { status: 200 });
    }, undefined, isRedrive ? redriveRecord : record);
    await user.type(reason, 'Verifiable local receipt reason');
    await user.click(dialog.querySelectorAll('button')[1]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await screen.findByText('The server committed the command and authority was reloaded.');
    const posts = fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(Object.keys(JSON.parse(String(posts[0]![1]!.body))).sort()).toEqual(['commandId', 'correlationId', 'idempotencyKey', 'reason']);
    expect(screen.queryByText(/command outcome is unconfirmed/)).toBeNull();
    expect(screen.getByText(/Provider ACK or HTTP 2xx is only transport\/provider acknowledgement/)).toBeTruthy();
  });

  it.each([
    'APPLIED', 'REPLAY',
  ] as const)('keeps a RECONCILE %s receipt for another version as UNKNOWN', async kind => {
    const { user, reason, dialog, fetchBoundary } = await mount('en', 'Start reconciliation', async init =>
      new Response(JSON.stringify({ ...receiptFor(init, kind), aggregateVersion: '8' }), { status: 200 }));
    await user.type(reason, 'Verifiable local version-bound receipt reason');
    await user.click(dialog.querySelectorAll('button')[1]!);
    await screen.findByText('UNKNOWN / PENDING_RECONCILIATION: command outcome is unconfirmed.');
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.queryByText('The server committed the command and authority was reloaded.')).toBeNull();
    const posts = fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(new Headers(posts[0]![1]!.headers).get('If-Match')).toBe('"7"');
    const command = JSON.parse(String(posts[0]![1]!.body));
    expect(screen.getByText(command.commandId)).toBeTruthy();
    expect(screen.getByText(command.correlationId)).toBeTruthy();
    expect(reason).toHaveAttribute('readonly');
    const confirm = dialog.querySelectorAll('button')[1]!;
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it.each([
    ['missing evidence', () => ({ commandId: 'local-receipt' })],
    ['null body', () => null],
    ['wrong kind', (receipt: ReturnType<typeof receiptFor>) => ({ ...receipt, kind: 'CONFIRMED' })],
    ['wrong adapter', (receipt: ReturnType<typeof receiptFor>) => ({ ...receipt, adapterCode: 'UNRELATED_ADAPTER' })],
    ['wrong correlation', (receipt: ReturnType<typeof receiptFor>) => ({ ...receipt, correlationId: 'unrelated-command-correlation' })],
    ['missing audit', (receipt: ReturnType<typeof receiptFor>) => ({ ...receipt, auditEventId: null })],
    ['missing outbox', (receipt: ReturnType<typeof receiptFor>) => ({ ...receipt, outboxEntryId: '' })],
    ['invalid version', (receipt: ReturnType<typeof receiptFor>) => ({ ...receipt, aggregateVersion: '7.0' })],
  ] as const)('keeps false-200 %s as UNKNOWN and retains the original attempt', async (_name, corrupt) => {
    const { user, reason, dialog, fetchBoundary } = await mount('en', 'Start reconciliation', async init =>
      new Response(JSON.stringify(corrupt(receiptFor(init))), { status: 200 }));
    await user.type(reason, 'Verifiable local receipt reason');
    await user.click(dialog.querySelectorAll('button')[1]!);
    const unknown = await screen.findByText('UNKNOWN / PENDING_RECONCILIATION: command outcome is unconfirmed.');
    expect(unknown.closest('[data-command-outcome]')).toHaveAttribute('data-command-outcome', 'UNKNOWN_PENDING_RECONCILIATION');
    expect(screen.queryByText('The server committed the command and authority was reloaded.')).toBeNull();
    const posts = fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(1);
    const command = JSON.parse(String(posts[0]![1]!.body));
    expect(screen.getByText(command.commandId)).toBeTruthy();
    expect(screen.getByText(command.correlationId)).toBeTruthy();
    expect(reason).toHaveAttribute('readonly');
    expect(reason.value).toBe(command.reason);
    const [cancel, confirm] = Array.from(dialog.querySelectorAll('button'));
    expect(cancel).toBeEnabled();
    expect(confirm).toBeDisabled();
    await user.click(confirm!);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('UNKNOWN / PENDING_RECONCILIATION: command outcome is unconfirmed.')).toBeTruthy();
    expect(screen.getByText(command.commandId)).toBeTruthy();
    expect(screen.getByText(command.correlationId)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start reconciliation' })).toBeDisabled();
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it('does not accept a REDRIVE receipt for another inbox entry', async () => {
    const { user, reason, dialog } = await mount('en', 'Redrive event', async init => {
      const receipt = receiptFor(init);
      return new Response(JSON.stringify({ kind: receipt.kind, entryId: 'unrelated-inbox-entry',
        auditEventId: receipt.auditEventId, outboxEntryId: receipt.outboxEntryId, correlationId: receipt.correlationId }), { status: 200 });
    }, undefined, redriveRecord);
    await user.type(reason, 'Verifiable local receipt reason');
    await user.click(dialog.querySelectorAll('button')[1]!);
    await screen.findByText('UNKNOWN / PENDING_RECONCILIATION: command outcome is unconfirmed.');
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.queryByText('The server committed the command and authority was reloaded.')).toBeNull();
  });

  it.each(locales)('shows lost-network outcome and preserves the immutable reason in $locale', async ({ locale, action }) => {
    const { user, reason, dialog, fetchBoundary } = await mount(locale, action, async () => { throw new TypeError('Local lost response'); });
    await user.type(reason, 'Verifiable local immutable reason');
    await user.click(dialog.querySelectorAll('button')[1]!);
    await waitFor(() => expect(dialog.querySelector('[data-command-outcome]')).toHaveAttribute('data-command-outcome', 'UNKNOWN_PENDING_RECONCILIATION'));
    const notice = dialog.querySelector('[data-command-outcome]')!;
    // This mounts the actual design-system InlineNotice, whose copy is a paragraph.
    // The localized recovery text and attempt references must remain valid HTML.
    expect(notice.querySelector('p')).not.toBeNull();
    expect(notice.querySelector('p p')).toBeNull();
    expect(reason.value).toBe('Verifiable local immutable reason');
    expect(reason).toHaveAttribute('readonly');
    expect(dialog.querySelectorAll('button')[0]).toBeEnabled();
    expect(dialog.querySelectorAll('button')[1]).toBeDisabled();
    await user.click(dialog.querySelectorAll('button')[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.querySelector('[data-command-outcome]')).toHaveAttribute('data-command-outcome', 'UNKNOWN_PENDING_RECONCILIATION');
    expect(document.querySelector('[data-command-outcome] p p')).toBeNull();
    expect(screen.getByRole('button', { name: action })).toBeDisabled();
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it.each([408, 502, 503])('treats HTTP %s as unresolved without generating a replacement', async status => {
    const { user, reason, dialog, fetchBoundary } = await mount('en', 'Start reconciliation', async () =>
      new Response(JSON.stringify({ code: 'INTEGRATION_SERVICE_UNAVAILABLE' }), { status }));
    await user.type(reason, 'Verifiable local ambiguous response');
    await user.click(dialog.querySelectorAll('button')[1]!);
    await screen.findByText('UNKNOWN / PENDING_RECONCILIATION: command outcome is unconfirmed.');
    const command = JSON.parse(String(fetchBoundary.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body));
    await user.click(dialog.querySelectorAll('button')[0]!);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText(command.commandId)).toBeTruthy();
    expect(screen.getByText(command.correlationId)).toBeTruthy();
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Start reconciliation' })).toBeDisabled();
  });
});

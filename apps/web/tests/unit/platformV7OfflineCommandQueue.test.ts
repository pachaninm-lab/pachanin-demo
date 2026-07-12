import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueueCommand,
  flushPendingCommand,
  isNetworkFailure,
  pendingForDeal,
  readQueue,
} from '@/lib/platform-v7/offline-command-queue';

const BASE = {
  dealId: 'DEAL-OFFLINE-1',
  actionId: 'confirm_arrival',
  commandId: 'cmd-1',
  idempotencyKey: 'DEAL-OFFLINE-1:confirm_arrival:cmd-1',
  expectedUpdatedAt: '2026-07-12T10:00:00.000Z',
  expectedVersion: '7',
  payload: { lat: 52.7, lng: 41.4 },
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('platform-v7 offline command queue', () => {
  it('stores one pending command per deal — a repeated tap never creates a duplicate', () => {
    enqueueCommand(BASE);
    enqueueCommand({ ...BASE, commandId: 'cmd-2', idempotencyKey: 'k2' });
    const queue = readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].commandId).toBe('cmd-2');
    expect(pendingForDeal('DEAL-OFFLINE-1')?.commandId).toBe('cmd-2');
  });

  it('replays the exact same commandId and idempotencyKey when the network returns', async () => {
    enqueueCommand(BASE);
    const doFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 }));

    const result = await flushPendingCommand('DEAL-OFFLINE-1', doFetch as unknown as typeof fetch);

    expect(result.outcome).toBe('delivered');
    expect(readQueue()).toHaveLength(0);
    const [url, init] = doFetch.mock.calls[0];
    expect(url).toBe('/api/proxy/deals/DEAL-OFFLINE-1/commands/confirm_arrival');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      commandId: 'cmd-1',
      idempotencyKey: BASE.idempotencyKey,
      expectedUpdatedAt: BASE.expectedUpdatedAt,
      expectedVersion: '7',
    });
  });

  it('keeps the command stored while the device is still offline', async () => {
    enqueueCommand(BASE);
    const doFetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    const result = await flushPendingCommand('DEAL-OFFLINE-1', doFetch as unknown as typeof fetch);

    expect(result.outcome).toBe('still-offline');
    expect(pendingForDeal('DEAL-OFFLINE-1')).toBeDefined();
  });

  it('clears the command on a 409 conflict — another participant already moved the deal', async () => {
    enqueueCommand(BASE);
    const doFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'STALE_DEAL_VERSION' }), { status: 409 }));

    const result = await flushPendingCommand('DEAL-OFFLINE-1', doFetch as unknown as typeof fetch);

    expect(result.outcome).toBe('conflict');
    expect(readQueue()).toHaveLength(0);
  });

  it('surfaces a server rejection instead of retrying silently forever', async () => {
    enqueueCommand(BASE);
    const doFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Роль не может выполнить действие' }), { status: 403 }));

    const result = await flushPendingCommand('DEAL-OFFLINE-1', doFetch as unknown as typeof fetch);

    expect(result.outcome).toBe('rejected');
    expect(result.message).toContain('Роль не может выполнить действие');
    expect(readQueue()).toHaveLength(0);
  });

  it('treats only fetch network errors as offline', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkFailure(new Error('500'))).toBe(false);
  });
});

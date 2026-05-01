import { expect, test } from '@playwright/test';

async function csrf(page: import('@playwright/test').Page) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === 'pc_csrf_token')?.value || '';
}

async function command(page: import('@playwright/test').Page, csrfToken: string, data: Record<string, unknown>) {
  return page.request.post('/api/platform-v7/logistics/runtime/command', {
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
    data,
  });
}

test.describe('platform-v7 logistics runtime API', () => {
  test('runtime view sets csrf cookie and exposes request only', async ({ page }) => {
    const scopeId = `log-view-${Date.now()}`;
    const response = await page.goto(`/api/platform-v7/logistics/runtime?scopeId=${scopeId}&actorRole=logistics`, { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    const payload = await response?.json();
    expect(payload.ok).toBe(true);
    expect(payload.request.requestId).toBe('LR-2041');
    expect(payload.quotes).toHaveLength(0);
    expect(payload.trip).toBeNull();
    expect((await csrf(page)).length).toBeGreaterThan(10);
  });

  test('command chain creates quote and trip with event journal', async ({ page }) => {
    const scopeId = `log-chain-${Date.now()}`;
    await page.goto(`/api/platform-v7/logistics/runtime?scopeId=${scopeId}&actorRole=logistics`, { waitUntil: 'networkidle' });
    const token = await csrf(page);

    const send = await command(page, token, { scopeId, action: 'send_request', actorRole: 'logistics', requestId: 'LR-2041', idempotencyKey: `${scopeId}:send` });
    expect(send.ok()).toBeTruthy();
    expect((await send.json()).request.status).toBe('sent');

    const viewed = await command(page, token, { scopeId, action: 'view_request', actorRole: 'logistics', requestId: 'LR-2041', idempotencyKey: `${scopeId}:view` });
    expect(viewed.ok()).toBeTruthy();
    expect((await viewed.json()).request.status).toBe('viewed');

    const quote = await command(page, token, { scopeId, action: 'submit_quote', actorRole: 'logistics', requestId: 'LR-2041', idempotencyKey: `${scopeId}:quote` });
    expect(quote.ok()).toBeTruthy();
    const quotePayload = await quote.json();
    expect(quotePayload.quotes).toHaveLength(1);
    expect(quotePayload.quotes[0].quoteId).toBe('LQ-3001');
    expect(quotePayload.event.title).toBe('Перевозчик предложил условия');

    const accept = await command(page, token, { scopeId, action: 'accept_quote', actorRole: 'logistics', requestId: 'LR-2041', quoteId: 'LQ-3001', idempotencyKey: `${scopeId}:accept` });
    expect(accept.ok()).toBeTruthy();
    const acceptPayload = await accept.json();
    expect(acceptPayload.trip.tripId).toBe('TR-2041');
    expect(acceptPayload.request.status).toBe('assigned');
    expect(acceptPayload.quotes[0].status).toBe('accepted');
    expect(acceptPayload.event.title).toBe('Предложение выбрано, рейс создан');
  });

  test('command route is idempotent for accept quote', async ({ page }) => {
    const scopeId = `log-idem-${Date.now()}`;
    await page.goto(`/api/platform-v7/logistics/runtime?scopeId=${scopeId}&actorRole=logistics`, { waitUntil: 'networkidle' });
    const token = await csrf(page);
    await command(page, token, { scopeId, action: 'submit_quote', actorRole: 'logistics', requestId: 'LR-2041', idempotencyKey: `${scopeId}:quote` });

    const data = { scopeId, action: 'accept_quote', actorRole: 'logistics', requestId: 'LR-2041', quoteId: 'LQ-3001', idempotencyKey: `${scopeId}:accept` };
    const first = await command(page, token, data);
    const second = await command(page, token, data);
    expect(first.ok()).toBeTruthy();
    expect(second.ok()).toBeTruthy();
    const firstPayload = await first.json();
    const secondPayload = await second.json();
    expect(firstPayload.trip.tripId).toBe('TR-2041');
    expect(secondPayload.idempotent).toBe(true);
    expect(secondPayload.trip.tripId).toBe('TR-2041');
  });

  test('command route blocks second trip creation with a new key', async ({ page }) => {
    const scopeId = `log-block-${Date.now()}`;
    await page.goto(`/api/platform-v7/logistics/runtime?scopeId=${scopeId}&actorRole=logistics`, { waitUntil: 'networkidle' });
    const token = await csrf(page);
    await command(page, token, { scopeId, action: 'submit_quote', actorRole: 'logistics', requestId: 'LR-2041', idempotencyKey: `${scopeId}:quote` });
    await command(page, token, { scopeId, action: 'accept_quote', actorRole: 'logistics', requestId: 'LR-2041', quoteId: 'LQ-3001', idempotencyKey: `${scopeId}:accept` });

    const second = await command(page, token, { scopeId, action: 'accept_quote', actorRole: 'logistics', requestId: 'LR-2041', quoteId: 'LQ-3001', idempotencyKey: `${scopeId}:accept-again` });
    expect(second.status()).toBe(400);
    const payload = await second.json();
    expect(payload.ok).toBe(false);
    expect(payload.command.status).toBe('FAILED');
    expect(payload.event.title).toBe('Действие остановлено');
    expect(payload.event.details).toContain('Рейс уже создан');
  });
});

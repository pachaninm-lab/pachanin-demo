import { expect, test } from '@playwright/test';

async function getCookieValue(page: import('@playwright/test').Page, name: string) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === name)?.value || '';
}

test.describe('platform-v7 bid runtime API', () => {
  test('runtime view sets csrf cookie and hides competing buyer bids', async ({ page }) => {
    const scopeId = `api-buyer-${Date.now()}`;
    const response = await page.goto(`/api/platform-v7/bids/runtime?scopeId=${scopeId}&lotId=LOT-2403&role=buyer&viewerCounterpartyId=cp-buyer-2`, { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    const payload = await response?.json();
    expect(payload.ok).toBe(true);
    expect(payload.bids).toHaveLength(1);
    expect(payload.bids[0].buyerId).toBe('cp-buyer-2');

    const csrf = await getCookieValue(page, 'pc_csrf_token');
    expect(csrf.length).toBeGreaterThan(10);
  });

  test('command route improves buyer bid and writes event journal', async ({ page }) => {
    const scopeId = `api-improve-${Date.now()}`;
    await page.goto(`/api/platform-v7/bids/runtime?scopeId=${scopeId}&lotId=LOT-2403&role=buyer&viewerCounterpartyId=cp-buyer-2`, { waitUntil: 'networkidle' });
    const csrf = await getCookieValue(page, 'pc_csrf_token');

    const response = await page.request.post('/api/platform-v7/bids/runtime/command', {
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      data: {
        scopeId,
        action: 'improve_bid',
        actorRole: 'buyer',
        lotId: 'LOT-2403',
        bidId: 'BID-7002',
        viewerCounterpartyId: 'cp-buyer-2',
        idempotencyKey: `${scopeId}:improve:BID-7002`,
        priceDelta: 100,
      },
    });

    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.command.status).toBe('SUCCEEDED');
    expect(payload.event.title).toBe('Ставка изменена');
    expect(payload.bids).toHaveLength(1);
    expect(payload.bids[0].pricePerTon).toBe(15800);
    expect(payload.events[0].title).toBe('Ставка изменена');
  });

  test('command route is idempotent for repeated accept bid command', async ({ page }) => {
    const scopeId = `api-accept-${Date.now()}`;
    await page.goto(`/api/platform-v7/bids/runtime?scopeId=${scopeId}&lotId=LOT-2403&role=seller`, { waitUntil: 'networkidle' });
    const csrf = await getCookieValue(page, 'pc_csrf_token');
    const data = {
      scopeId,
      action: 'accept_bid',
      actorRole: 'seller',
      lotId: 'LOT-2403',
      bidId: 'BID-7002',
      idempotencyKey: `${scopeId}:accept:BID-7002`,
    };

    const first = await page.request.post('/api/platform-v7/bids/runtime/command', {
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      data,
    });
    const second = await page.request.post('/api/platform-v7/bids/runtime/command', {
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      data,
    });

    expect(first.ok()).toBeTruthy();
    expect(second.ok()).toBeTruthy();
    const firstPayload = await first.json();
    const secondPayload = await second.json();
    expect(firstPayload.command.status).toBe('SUCCEEDED');
    expect(firstPayload.event.title).toBe('Ставка принята');
    expect(firstPayload.deals).toHaveLength(1);
    expect(secondPayload.idempotent).toBe(true);
    expect(secondPayload.deals).toHaveLength(1);
  });
});

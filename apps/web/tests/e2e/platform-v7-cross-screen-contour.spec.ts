import { expect, test } from '@playwright/test';

async function getCookieValue(page: import('@playwright/test').Page, name: string) {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === name)?.value || '';
}

async function readBody(page: import('@playwright/test').Page): Promise<string> {
  await expect(page.locator('body')).toBeVisible();
  return page.locator('body').innerText();
}

test.describe('platform-v7 cross-screen execution contour', () => {
  test('accepted bid creates runtime deal and key screens expose the execution chain', async ({ page }) => {
    const scopeId = `cross-contour-${Date.now()}`;
    await page.goto(`/api/platform-v7/bids/runtime?scopeId=${scopeId}&lotId=LOT-2403&role=seller`, { waitUntil: 'networkidle' });
    const csrf = await getCookieValue(page, 'pc_csrf_token');

    const accept = await page.request.post('/api/platform-v7/bids/runtime/command', {
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      data: {
        scopeId,
        action: 'accept_bid',
        actorRole: 'seller',
        lotId: 'LOT-2403',
        bidId: 'BID-7002',
        idempotencyKey: `${scopeId}:accept:BID-7002`,
      },
    });

    expect(accept.ok()).toBeTruthy();
    const accepted = await accept.json();
    expect(accepted.command.status).toBe('SUCCEEDED');
    expect(accepted.event.title).toBe('Ставка принята');
    expect(accepted.deals).toHaveLength(1);
    expect(accepted.deals[0].dealId).toBe('DL-9116');
    expect(accepted.deals[0].acceptedBidId).toBe('BID-7002');
    expect(accepted.deals[0].logisticsMode).toBe('platform_logistics_required');

    await page.goto('/platform-v7/deals/DL-9116', { waitUntil: 'networkidle' });
    const dealText = await readBody(page);
    expect(dealText).toContain('Принятая ставка');
    expect(dealText).toContain('BID-7002');
    expect(dealText).toContain('Заявка в логистику создана');
    expect(dealText).toContain('К выпуску денег');

    await page.goto('/platform-v7/logistics/requests', { waitUntil: 'networkidle' });
    const logisticsText = await readBody(page);
    expect(logisticsText).toContain('Логистика: входящие заявки');
    expect(logisticsText).toContain('LR-2041');
    expect(logisticsText).toContain('Тамбов → Воронеж');
    expect(logisticsText).not.toContain('Лучшая ставка');
    expect(logisticsText).not.toContain('Минимум продавца');

    await page.goto('/platform-v7/logistics/trips/TR-2041', { waitUntil: 'networkidle' });
    const tripText = await readBody(page);
    expect(tripText).toContain('TR-2041');
    expect(tripText).toContain('DL-9116');
    expect(tripText).toContain('LR-2041');
    expect(tripText).toContain('Полевые подтверждения');

    await page.goto('/platform-v7/bank/release-safety', { waitUntil: 'networkidle' });
    const bankText = await readBody(page);
    expect(bankText).toContain('Проверка выпуска денег');
    expect(bankText).toContain('Выпуск денег заблокирован');
    expect(bankText).toContain('Выпуск денег разрешён');
    expect(bankText).toContain('транспортный пакет');
  });
});

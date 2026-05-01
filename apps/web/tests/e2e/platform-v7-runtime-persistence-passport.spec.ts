import { expect, test } from '@playwright/test';

test.describe('platform-v7 runtime persistence passport', () => {
  test('bid runtime response is explicitly marked as non-durable pilot memory store', async ({ page }) => {
    const response = await page.goto(`/api/platform-v7/bids/runtime?scopeId=passport-bid-${Date.now()}&lotId=LOT-2403&role=seller`, { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    const payload = await response?.json();

    expect(payload.persistence.mode).toBe('server_memory');
    expect(payload.persistence.durable).toBe(false);
    expect(payload.persistence.productionReady).toBe(false);
    expect(payload.persistence.resetRisk).toBe('restart_or_deploy');
    expect(payload.persistence.label).toBe('controlled_pilot_memory_store');
  });

  test('logistics runtime response is explicitly marked as non-durable pilot memory store', async ({ page }) => {
    const response = await page.goto(`/api/platform-v7/logistics/runtime?scopeId=passport-logistics-${Date.now()}&actorRole=logistics`, { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    const payload = await response?.json();

    expect(payload.persistence.mode).toBe('server_memory');
    expect(payload.persistence.durable).toBe(false);
    expect(payload.persistence.productionReady).toBe(false);
    expect(payload.persistence.resetRisk).toBe('restart_or_deploy');
    expect(payload.persistence.label).toBe('controlled_pilot_memory_store');
  });
});

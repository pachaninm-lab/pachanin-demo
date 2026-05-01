import { expect, test } from '@playwright/test';

const baselineCases = [
  { name: 'lots-320-light', route: '/platform-v7/lots', width: 320, height: 844, colorScheme: 'light' as const, mustContain: ['Лоты', 'Пшеница'] },
  { name: 'lots-390-dark', route: '/platform-v7/lots', width: 390, height: 844, colorScheme: 'dark' as const, mustContain: ['Лоты', 'Пшеница'] },
  { name: 'buyer-390-light', route: '/platform-v7/buyer', width: 390, height: 844, colorScheme: 'light' as const, mustContain: ['Доступные лоты', 'Отправить'] },
  { name: 'seller-390-light', route: '/platform-v7/seller', width: 390, height: 844, colorScheme: 'light' as const, mustContain: ['Мои лоты', 'став'] },
  { name: 'bids-430-light', route: '/platform-v7/lots/LOT-2403/bids', width: 430, height: 932, colorScheme: 'light' as const, mustContain: ['Ставки', 'Принять'] },
  { name: 'deal-430-light', route: '/platform-v7/deals/DL-9116', width: 430, height: 932, colorScheme: 'light' as const, mustContain: ['DL-9116', 'Принятая ставка'] },
  { name: 'logistics-390-light', route: '/platform-v7/logistics/requests', width: 390, height: 844, colorScheme: 'light' as const, mustContain: ['Логистика', 'LR-2041'] },
  { name: 'trip-390-light', route: '/platform-v7/logistics/trips/TR-2041', width: 390, height: 844, colorScheme: 'light' as const, mustContain: ['TR-2041', 'Полевые подтверждения'] },
  { name: 'driver-320-light', route: '/platform-v7/driver', width: 320, height: 844, colorScheme: 'light' as const, mustContain: ['Рейс', 'погруз'] },
  { name: 'elevator-390-light', route: '/platform-v7/elevator', width: 390, height: 844, colorScheme: 'light' as const, mustContain: ['Приёмка', 'вес'] },
  { name: 'lab-390-light', route: '/platform-v7/lab', width: 390, height: 844, colorScheme: 'light' as const, mustContain: ['Лаборатория', 'протокол'] },
  { name: 'bank-390-dark', route: '/platform-v7/bank/release-safety', width: 390, height: 844, colorScheme: 'dark' as const, mustContain: ['Проверка выпуска денег', 'заблокирован'] },
  { name: 'deal-tablet-light', route: '/platform-v7/deals/DL-9116', width: 768, height: 1024, colorScheme: 'light' as const, mustContain: ['DL-9116', 'Деньги'] },
  { name: 'bids-desktop-light', route: '/platform-v7/lots/LOT-2403/bids', width: 1366, height: 900, colorScheme: 'light' as const, mustContain: ['Ставки', 'Журнал действий'] },
] as const;

test.describe('platform-v7 screenshot baseline smoke gates', () => {
  for (const item of baselineCases) {
    test(`${item.name} captures non-empty baseline without overflow`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: item.colorScheme });
      await page.setViewportSize({ width: item.width, height: item.height });

      const response = await page.goto(item.route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${item.route} should return ok response`).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();

      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length, `${item.name} should render meaningful text`).toBeGreaterThan(80);
      for (const fragment of item.mustContain) {
        expect(bodyText, `${item.name} should contain ${fragment}`).toContain(fragment);
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${item.name} should not overflow horizontally`).toBeLessThanOrEqual(1);

      const screenshot = await page.screenshot({ fullPage: true });
      expect(screenshot.byteLength, `${item.name} screenshot should not be empty`).toBeGreaterThan(10_000);
    });
  }
});

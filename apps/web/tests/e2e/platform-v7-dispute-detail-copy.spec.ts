import { expect, test } from '@playwright/test';

const routes = [
  '/platform-v7/disputes/DK-2024-89',
  '/platform-v7/dispute/DK-2024-89',
] as const;

const hiddenPhrases = [
  'Evidence readiness',
  'Blockers',
  'Readiness snapshot',
  'stable evidence objects',
  'Type',
  'Source',
  'Trust',
  'Actor',
  'Geo',
  'Chain',
  'captured:',
  'uploaded:',
  'signature:',
] as const;

test.describe('platform-v7 dispute detail copy', () => {
  for (const route of routes) {
    test(`${route} keeps external copy clean`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx`).toBeTruthy();

      const text = await page.locator('body').innerText();

      expect(text).toContain('Пакет доказательств');
      expect(text).toContain('Проверка закрытия спора');

      for (const phrase of hiddenPhrases) {
        expect(text, `${route} should not show ${phrase}`).not.toContain(phrase);
      }
    });
  }
});

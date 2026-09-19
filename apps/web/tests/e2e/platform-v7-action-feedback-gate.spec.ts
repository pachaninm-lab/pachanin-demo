import { expect, test } from '@playwright/test';

const ACTION_ROUTES = [
  { route: '/platform-v7/seller', expectedAction: /создать лот|открыть предложения|принять предложение|запросить/i },
  { route: '/platform-v7/buyer', expectedAction: /сделать ставку|открыть сделку|подтвердить резерв|принять груз/i },
  { route: '/platform-v7/bank', expectedAction: /открыть проверку|подтвердить выпуск|удержать|ручную проверку/i },
  { route: '/platform-v7/control-tower', expectedAction: /открыть сделку|открыть документы|открыть спор|открыть банк/i },
  { route: '/platform-v7/disputes', expectedAction: /запросить доказательство|закрыть спор|открыть доказательства|решение/i },
] as const;

const DEAD_ACTION_TEXT = [/^выполнить$/i, /^открыть$/i, /^запустить$/i, /^action$/i, /^todo$/i];

async function visibleActionTexts(page: import('@playwright/test').Page) {
  return page.locator('button:visible, a:visible, [role="button"]:visible').evaluateAll((nodes) =>
    nodes.map((node) => (node.textContent ?? '').trim()).filter(Boolean),
  );
}

test.describe('platform-v7 action feedback gate', () => {
  for (const item of ACTION_ROUTES) {
    test(`${item.route} exposes concrete action language`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(item.route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${item.route} should return 200`).toBeTruthy();
      await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText, `${item.route} should expose at least one concrete expected action`).toMatch(item.expectedAction);

      const actionTexts = await visibleActionTexts(page);
      expect(actionTexts.length, `${item.route} should expose visible actions`).toBeGreaterThan(0);

      for (const text of actionTexts) {
        for (const deadPattern of DEAD_ACTION_TEXT) {
          expect(text, `${item.route} should not expose vague action text: ${text}`).not.toMatch(deadPattern);
        }
      }
    });
  }
});

import { expect, test, type Locator, type Page } from '@playwright/test';

const viewports = [
  { width: 320, height: 700, name: '320x700' },
  { width: 390, height: 844, name: '390x844' },
  { width: 430, height: 932, name: '430x932' },
] as const;

const SEEDED_TITLE = 'Production mobile acceptance';
const HISTORY_STORAGE = 'gekta-conversations-v2';

async function seedConversation(page: Page) {
  await page.addInitScript(({ storageKey, title }) => {
    const now = '2026-08-12T00:00:00.000Z';
    localStorage.setItem(storageKey, JSON.stringify([{
      id: 'production-mobile-acceptance',
      locale: 'ru',
      title,
      createdAt: now,
      updatedAt: now,
      messages: [
        { id: 'user-mobile', role: 'user', text: 'Что проверить при снижении урожайности озимой пшеницы?', createdAt: now },
        {
          id: 'assistant-mobile',
          role: 'assistant',
          text: 'Проверьте состояние посевов, питание, влагу, болезни и фактическую агротехнологию по полю.',
          createdAt: now,
          status: 'answered',
          citations: [{ sourceId: 'source-mobile', title: 'Официальный источник с длинным адресом для проверки переноса', uri: 'https://example.com/agriculture/very-long-production-mobile-acceptance-source-path-that-must-not-cause-horizontal-overflow' }],
        },
      ],
    }]));
  }, { storageKey: HISTORY_STORAGE, title: SEEDED_TITLE });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectTargetsAtLeast(locator: Locator, minimum: number) {
  const boxes = await locator.evaluateAll((nodes) => nodes
    .filter((node) => {
      const element = node as HTMLElement;
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    })
    .map((node) => {
      const box = (node as HTMLElement).getBoundingClientRect();
      return { tag: node.tagName, label: (node as HTMLElement).getAttribute('aria-label') || (node.textContent || '').trim(), width: box.width, height: box.height };
    }));

  expect(boxes.length, 'expected visible mobile controls').toBeGreaterThan(0);
  expect(boxes.every((box) => box.width >= minimum && box.height >= minimum), JSON.stringify(boxes, null, 2)).toBe(true);
}

async function openSeededConversation(page: Page) {
  await page.getByRole('button', { name: 'Открыть историю' }).click();
  await expect(page.getByRole('dialog', { name: 'Gekta navigation' })).toBeVisible();
  await expectTargetsAtLeast(page.getByRole('dialog', { name: 'Gekta navigation' }).locator('button, input, select, a'), 44);
  await page.getByRole('button', { name: SEEDED_TITLE }).click();
  await expect(page.getByRole('dialog', { name: 'Gekta navigation' })).toHaveCount(0);
  await expect(page.locator('[data-gekta-role="assistant"]')).toBeVisible();
}

test.describe('Gekta exact production mobile acceptance', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} keeps Gekta usable without overflow and with 44px touch targets`, async ({ page }, testInfo) => {
      const runtimeFailures: string[] = [];
      page.on('pageerror', (error) => runtimeFailures.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
      });

      await seedConversation(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await page.goto('/gekta', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.locator('[data-gekta-chat-workspace="true"]')).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await openSeededConversation(page);
      await expect(page.locator('#gekta-composer-input')).toBeVisible();
      await expectTargetsAtLeast(page.locator('[data-gekta-chat-workspace="true"] header button:visible'), 44);
      await expectTargetsAtLeast(page.locator('[data-gekta-chat-workspace="true"] button[aria-label="Прикрепить файл"]:visible, [data-gekta-chat-workspace="true"] button[aria-label="Отправить"]:visible'), 44);
      await expectTargetsAtLeast(page.locator('[data-gekta-role="assistant"] button:visible'), 44);

      const sources = page.locator('[data-gekta-role="assistant"] summary').filter({ hasText: 'Источники' });
      await expect(sources).toHaveCount(1);
      await expect(sources).toContainText('Источники');
      await sources.click();
      const sourceLink = page.locator('[data-gekta-role="assistant"] a[href^="https://example.com/"]');
      await expect(sourceLink).toBeVisible();
      await expectTargetsAtLeast(sourceLink, 44);
      await expectNoHorizontalOverflow(page);

      const workspace = await page.locator('[data-gekta-chat-workspace="true"]').evaluate((node) => {
        const box = (node as HTMLElement).getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width, height: box.height };
      });
      expect(workspace.left).toBeGreaterThanOrEqual(-1);
      expect(workspace.right).toBeLessThanOrEqual(viewport.width + 1);
      expect(workspace.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(workspace.height).toBeLessThanOrEqual(viewport.height + 1);

      expect(runtimeFailures).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`gekta-production-${viewport.name}.png`),
        fullPage: false,
        animations: 'disabled',
      });
    });
  }

  test('canonical EN and ZH Gekta routes remain mobile and localized at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      { path: '/gekta/en', lang: 'en', menu: 'Open history', brand: 'GEKTA' },
      { path: '/gekta/zh', lang: 'zh-CN', menu: '打开历史记录', brand: 'GEKTA' },
    ]) {
      const response = await page.goto(route.path, { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.locator('html')).toHaveAttribute('lang', route.lang);
      await expect(page.getByRole('button', { name: route.menu })).toBeVisible();
      await expect(page.locator('[data-gekta-chat-workspace="true"] main > header')).toContainText(route.brand);
      await expectNoHorizontalOverflow(page);
    }
  });
});

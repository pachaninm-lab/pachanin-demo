import { expect, test, type Locator, type Page } from '@playwright/test';

const viewports = [
  { width: 320, height: 700, name: '320x700' },
  { width: 375, height: 812, name: '375x812' },
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


async function acceptRequiredConsent(page: Page) {
  const consent = page.locator('[data-gekta-consent="true"]');
  await expect(consent).toBeVisible();

  const legalLinks = consent.locator([
    'a[href="/legal/usloviya-ispolzovaniya-gekta"]',
    'a[href="/legal/politika-konfidencialnosti"]',
  ].join(', '));
  await expect(legalLinks).toHaveCount(2);
  await expectTargetsAtLeast(legalLinks, 44);

  const acceptButton = consent.locator('[data-gekta-consent-accept="true"]');
  await expectTargetsAtLeast(acceptButton, 44);
  await acceptButton.click();
  await expect(consent).toHaveCount(0);
}

function visibleWorkspaceTargets(page: Page) {
  return page.locator([
    '[data-gekta-chat-workspace="true"] a:visible',
    '[data-gekta-chat-workspace="true"] button:visible',
    '[data-gekta-chat-workspace="true"] input:not([type="hidden"]):visible',
    '[data-gekta-chat-workspace="true"] select:visible',
    '[data-gekta-chat-workspace="true"] summary:visible',
    '[data-gekta-chat-workspace="true"] textarea:visible',
    '[data-gekta-chat-workspace="true"] [role="button"]:visible',
  ].join(', '));
}

async function openSeededConversation(page: Page) {
  await page.getByRole('button', { name: 'Открыть историю' }).click();
  const dialog = page.getByRole('dialog', { name: 'Gekta navigation' });
  await expect(dialog).toBeVisible();
  await expectTargetsAtLeast(dialog.locator('button, input, select, a'), 44);

  const viewport = page.viewportSize();
  const drawer = page.locator('[data-gekta-mobile-drawer-panel="true"]');
  const drawerBox = await drawer.boundingBox();
  expect(drawerBox).not.toBeNull();
  if (drawerBox && viewport) {
    expect(drawerBox.width).toBeGreaterThanOrEqual(Math.min(viewport.width * 0.88, 350));
    expect(drawerBox.width).toBeLessThanOrEqual(viewport.width + 1);
  }

  await page.getByRole('button', { name: SEEDED_TITLE }).click();
  await expect(dialog).toHaveCount(0);
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
      await acceptRequiredConsent(page);
      await expectNoHorizontalOverflow(page);

      const starterCards = page.locator('[data-gekta-starter="true"]');
      const visibleStarterCards = page.locator('[data-gekta-starter="true"]:visible');
      const moreExamples = page.locator('[data-gekta-more-examples="true"]');
      await expect(visibleStarterCards).toHaveCount(3);
      await expect(moreExamples).toBeVisible();
      await moreExamples.click();
      await expect(page.locator('#gekta-more-examples')).toBeVisible();
      expect(await starterCards.count()).toBeGreaterThan(3);
      expect(await visibleStarterCards.count()).toBeGreaterThan(3);
      await moreExamples.click();
      await expect(visibleStarterCards).toHaveCount(3);

      await openSeededConversation(page);
      const composer = page.locator('#gekta-composer-input');
      await expect(composer).toBeVisible();
      const composerFontSize = await composer.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).fontSize));
      expect(composerFontSize).toBeGreaterThanOrEqual(16);

      const visualViewport = await page.evaluate(() => {
        const cssHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gekta-visual-viewport-height'));
        const actualHeight = window.visualViewport?.height ?? window.innerHeight;
        return { cssHeight, actualHeight };
      });
      expect(Number.isFinite(visualViewport.cssHeight)).toBe(true);
      expect(Math.abs(visualViewport.cssHeight - visualViewport.actualHeight)).toBeLessThanOrEqual(2);

      await expectTargetsAtLeast(page.locator('[data-gekta-chat-workspace="true"] header button:visible'), 44);
      await expectTargetsAtLeast(page.locator('[data-gekta-chat-workspace="true"] header a:visible'), 44);
      await expectTargetsAtLeast(page.locator('[data-gekta-chat-workspace="true"] button[aria-label="Прикрепить файл"]:visible, [data-gekta-chat-workspace="true"] button[aria-label="Отправить"]:visible'), 44);
      await expectTargetsAtLeast(page.locator('[data-gekta-role="assistant"] button:visible'), 44);
      await expectTargetsAtLeast(visibleWorkspaceTargets(page), 44);

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

  for (const route of [
    { path: '/gekta/en', locale: 'EN', lang: 'en', menu: 'Open history', closeMenu: 'Close history', brand: 'GEKTA' },
    { path: '/gekta/zh', locale: 'ZH', lang: 'zh-CN', menu: '打开历史记录', closeMenu: '关闭历史记录', brand: 'GEKTA' },
  ] as const) {
    for (const viewport of viewports) {
      test(`${route.locale} ${viewport.name} remains localized, progressive and 44px-safe`, async ({ page }, testInfo) => {
        const runtimeFailures: string[] = [];
        page.on('pageerror', (error) => runtimeFailures.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
        });

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(route.path, { waitUntil: 'load' });
        expect(response?.ok()).toBe(true);
        await expect(page.locator('html')).toHaveAttribute('lang', route.lang);
        await expect(page.getByRole('button', { name: route.menu })).toBeVisible();
        await expect(page.locator('[data-gekta-chat-workspace="true"] main > header')).toContainText(route.brand);
        await expectNoHorizontalOverflow(page);

        const visibleStarterCards = page.locator('[data-gekta-starter="true"]:visible');
        const moreExamples = page.locator('[data-gekta-more-examples="true"]');
        await expect(visibleStarterCards).toHaveCount(3);
        await moreExamples.click();
        expect(await visibleStarterCards.count()).toBeGreaterThan(3);
        await moreExamples.click();
        await expect(visibleStarterCards).toHaveCount(3);

        const composer = page.locator('#gekta-composer-input');
        const composerFontSize = await composer.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).fontSize));
        expect(composerFontSize).toBeGreaterThanOrEqual(16);

        const visualViewport = await page.evaluate(() => {
          const cssHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gekta-visual-viewport-height'));
          const actualHeight = window.visualViewport?.height ?? window.innerHeight;
          return { cssHeight, actualHeight };
        });
        expect(Number.isFinite(visualViewport.cssHeight)).toBe(true);
        expect(Math.abs(visualViewport.cssHeight - visualViewport.actualHeight)).toBeLessThanOrEqual(2);

        await expectTargetsAtLeast(visibleWorkspaceTargets(page), 44);

        await page.getByRole('button', { name: route.menu }).click();
        const dialog = page.getByRole('dialog', { name: 'Gekta navigation' });
        await expect(dialog).toBeVisible();
        await expectTargetsAtLeast(dialog.locator('button, input, select, a'), 44);
        const drawer = page.locator('[data-gekta-mobile-drawer-panel="true"]');
        const drawerBox = await drawer.boundingBox();
        expect(drawerBox).not.toBeNull();
        if (drawerBox) {
          expect(drawerBox.width).toBeGreaterThanOrEqual(Math.min(viewport.width * 0.88, 350));
          expect(drawerBox.width).toBeLessThanOrEqual(viewport.width + 1);
        }
        await drawer.getByRole('button', { name: route.closeMenu }).click();
        await expect(dialog).toHaveCount(0);

        const workspace = await page.locator('[data-gekta-chat-workspace="true"]').evaluate((node) => {
          const box = (node as HTMLElement).getBoundingClientRect();
          return { left: box.left, right: box.right, width: box.width };
        });
        expect(workspace.left).toBeGreaterThanOrEqual(-1);
        expect(workspace.right).toBeLessThanOrEqual(viewport.width + 1);
        expect(workspace.width).toBeLessThanOrEqual(viewport.width + 1);

        expect(runtimeFailures).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`gekta-production-${route.locale.toLowerCase()}-${viewport.name}.png`),
          fullPage: false,
          animations: 'disabled',
        });
      });
    }
  }

  test('public platform keeps one floating communication surface and no double mobile footer reserve', async ({ page } ) => {
    await page.setViewportSize({ width: 430, height: 932 });
    const response = await page.goto('/platform-v7', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expectNoHorizontalOverflow(page);

    const competingLauncher = page.locator('.pc-public-contact-dock, .pc-public-assistant-shortcut, .p7-support-chat-button').filter({ visible: true });
    if (await competingLauncher.count()) {
      await expect(page.locator('.pc-gekta-floating')).not.toBeVisible();
    }

    const footerLinks = page.locator('.pc-v7-public-entry .pc-v6-footer nav a:visible');
    await expectTargetsAtLeast(footerLinks, 44);
    const pageBottomReserve = await page.locator('.pc-v7-public-entry').evaluate((node) => Number.parseFloat(getComputedStyle(node).paddingBottom));
    expect(pageBottomReserve).toBeLessThanOrEqual(1);
  });
});

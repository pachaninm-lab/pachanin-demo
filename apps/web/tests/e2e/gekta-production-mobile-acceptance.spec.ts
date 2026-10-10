import { expect, test, type Locator, type Page } from '@playwright/test';

const viewports = [
  { width: 320, height: 700, name: '320x700' },
  { width: 375, height: 812, name: '375x812' },
  { width: 390, height: 844, name: '390x844' },
  { width: 430, height: 932, name: '430x932' },
] as const;

const SEEDED_TITLE = 'Production mobile acceptance';
const HISTORY_STORAGE = 'gekta-conversations-v2';

async function seedConversation(page: Page, locale: 'ru' | 'en' | 'zh' = 'ru') {
  await page.addInitScript(({ storageKey, title, locale }) => {
    const now = '2026-08-12T00:00:00.000Z';
    localStorage.setItem(storageKey, JSON.stringify([{
      id: 'production-mobile-acceptance',
      locale,
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
  }, { storageKey: HISTORY_STORAGE, title: SEEDED_TITLE, locale });
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

async function textLineCount(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const lineTops = new Set<number>();
    let node = walker.nextNode();
    while (node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width > 0 && rect.height > 0) lineTops.add(Math.round(rect.top * 2) / 2);
      }
      node = walker.nextNode();
    }
    return lineTops.size;
  });
}

type MobileLegalPresentation = Readonly<{ locale: string; snapshot: string; termsHref: string; privacyHref: string }>;

function mobileConsentLocale(pageUrl: string): 'ru' | 'en' | 'zh' {
  const match = new URL(pageUrl).pathname.match(/^\/gekta(?:\/(en|zh))?\/?$/u);
  expect(match).not.toBeNull();
  return (match?.[1] || 'ru') as 'ru' | 'en' | 'zh';
}

function assertMobileLegalLinks(hrefs: string[], pageUrl: string, legalVersion: string, locale: string, presentation?: MobileLegalPresentation) {
  const paths = ['/legal/usloviya-ispolzovaniya-gekta', '/legal/politika-konfidencialnosti'];
  expect(legalVersion.length).toBeGreaterThan(0);
  expect(hrefs).toEqual(presentation ? [presentation.termsHref, presentation.privacyHref] : paths);
  if (presentation) {
    expect(presentation.locale).toBe(locale);
    expect(presentation.snapshot.length).toBeGreaterThan(0);
    expect(presentation.snapshot.length).toBeLessThanOrEqual(2_048);
  }
  const urls = hrefs.map((href, index) => {
    expect(href.startsWith('/legal/')).toBe(true);
    const url = new URL(href, pageUrl);
    expect(url.origin).toBe(new URL(pageUrl).origin);
    expect(url.pathname).toBe(paths[index]);
    expect(url.hash).toBe('');
    if (presentation) {
      expect([...url.searchParams.keys()].sort()).toEqual(['h', 'p', 'v']);
      expect(url.searchParams.get('v')).toBe(legalVersion);
      expect(url.searchParams.get('h')).toMatch(/^[0-9a-f]{64}$/u);
      expect(url.searchParams.get('p')).toMatch(/^[0-9a-f]{64}$/u);
    } else expect(url.search).toBe('');
    return url;
  });
  if (presentation) {
    expect(urls[0].searchParams.get('p')).toBe(urls[1].searchParams.get('p'));
    expect(urls[0].searchParams.get('h')).not.toBe(urls[1].searchParams.get('h'));
  }
}

async function acceptRequiredConsent(page: Page) {
  const consent = page.locator('[data-gekta-consent="true"]');
  await expect(consent).toBeVisible();

  const locale = mobileConsentLocale(page.url());
  const noticeResponse = await page.evaluate(async locale => {
    const response = await fetch(`/api/gekta/entitlement?lang=${locale}`, { cache: 'no-store' });
    return { ok: response.ok, body: await response.json() };
  }, locale);
  expect(noticeResponse.ok).toBe(true);
  const notice = noticeResponse.body as { legalVersion: string; legalPresentation?: MobileLegalPresentation };
  const legalLinks = consent.locator('a');
  await expect(legalLinks).toHaveCount(2);
  const hrefs = await legalLinks.evaluateAll(nodes => nodes.map(node => node.getAttribute('href') || ''));
  // The accepted predecessor has bare links and no presentation descriptor.
  // A descriptor requires the exact committed URLs; stripping hashes cannot pass.
  assertMobileLegalLinks(hrefs, page.url(), notice.legalVersion, locale, notice.legalPresentation);
  await expectTargetsAtLeast(legalLinks, 44);

  const acceptButton = consent.locator('[data-gekta-consent-accept="true"]');
  await expectTargetsAtLeast(acceptButton, 44);
  const acknowledgement = page.waitForResponse(response => new URL(response.url()).pathname === '/api/gekta/entitlement'
    && response.request().method() === 'POST' && response.request().postDataJSON()?.action === 'consent');
  await acceptButton.click();
  const acceptedResponse = await acknowledgement;
  expect(acceptedResponse.ok()).toBe(true);
  const accepted = await acceptedResponse.json();
  expect(accepted.consent?.version).toBe(notice.legalVersion);
  if (notice.legalPresentation) {
    expect(accepted.consentCurrent).toBe(true);
    expect(accepted.consent?.surfaceLocale).toBe(locale);
    expect(accepted.consent?.evidenceHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
  }
  await expect(consent).toHaveCount(0);
  // useDialogFocus restores the opener in requestAnimationFrame after unmount.
  // Finish that UI handoff before the next synthetic fill takes keyboard focus.
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function acceptConsentIfPresent(page: Page) {
  const consent = page.locator('[data-gekta-consent="true"]');
  if (await consent.count()) await acceptRequiredConsent(page);
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

async function openDrawerAndAssertModal(page: Page, menu: string, closeMenu: string, viewportWidth: number) {
  const opener = page.getByRole('button', { name: menu });
  await opener.click();

  const dialog = page.getByRole('dialog', { name: 'Gekta' });
  await expect(dialog).toBeVisible();
  const panel = page.locator('[data-gekta-mobile-drawer-panel="true"]');
  const close = panel.getByRole('button', { name: closeMenu });
  await expect(close).toBeFocused();
  await expectTargetsAtLeast(dialog.locator('button, input, select, a'), 44);

  const background = page.locator('[data-gekta-chat-workspace="true"] > div').first();
  await expect(background).toHaveAttribute('inert', '');
  await expect(background).toHaveAttribute('aria-hidden', 'true');
  const discovery = page.locator('[data-gekta-server-discovery="true"]');
  if (await discovery.count()) {
    await expect(discovery).toHaveAttribute('inert', '');
    await expect(discovery).toHaveAttribute('aria-hidden', 'true');
  }

  const drawerBox = await panel.boundingBox();
  expect(drawerBox).not.toBeNull();
  if (drawerBox) {
    const expectedWidth = Math.min(viewportWidth * 0.88, 360, viewportWidth - 48);
    expect(Math.abs(drawerBox.width - expectedWidth)).toBeLessThanOrEqual(2);
    expect(viewportWidth - drawerBox.width).toBeGreaterThanOrEqual(47);
  }

  return { opener, dialog, panel, close, background, discovery };
}

async function closeDrawerWithEscape(page: Page, menu: string, closeMenu: string, viewportWidth: number) {
  const drawer = await openDrawerAndAssertModal(page, menu, closeMenu, viewportWidth);
  await page.keyboard.press('Escape');
  await expect(drawer.dialog).toHaveCount(0);
  await expect(drawer.opener).toBeFocused();
  await expect.poll(() => drawer.background.evaluate((node) => node.hasAttribute('inert'))).toBe(false);
  if (await drawer.discovery.count()) {
    await expect.poll(() => drawer.discovery.evaluate((node) => node.hasAttribute('inert'))).toBe(false);
  }
}

async function openSeededConversation(page: Page, viewportWidth: number, menu = 'Открыть историю', closeMenu = 'Закрыть историю') {
  await closeDrawerWithEscape(page, menu, closeMenu, viewportWidth);
  await page.getByRole('button', { name: menu }).click();
  const dialog = page.getByRole('dialog', { name: 'Gekta' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: SEEDED_TITLE }).click();
  await expect(dialog).toHaveCount(0);
}

async function expectStartSurface(page: Page, viewportWidth: number) {
  const composer = page.locator('#gekta-composer-input');
  const composerRoot = page.locator('[data-gekta-composer-root="true"]');
  const hero = page.locator('[data-gekta-server-hero="true"]');
  const examples = page.locator('[data-gekta-examples="true"]');
  await expect(composer).toBeVisible();
  await expect(hero).toBeVisible();
  await expect(examples).toBeVisible();
  await expect(page.locator('[data-gekta-starter="true"]:visible')).toHaveCount(2);
  await expect(page.locator('[data-gekta-more-examples="true"]')).toBeVisible();
  await expect(page.locator("[data-gekta-primary-cta='true'], [data-gekta-floating-entry]")).toHaveCount(0);

  const h1 = hero.locator('h1');
  if (viewportWidth === 320) expect(await textLineCount(h1)).toBeLessThanOrEqual(5);

  const [heroBox, composerBox, examplesBox] = await Promise.all([
    hero.boundingBox(),
    composerRoot.boundingBox(),
    examples.boundingBox(),
  ]);
  expect(heroBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  expect(examplesBox).not.toBeNull();
  if (heroBox && composerBox && examplesBox) {
    expect(heroBox.y + heroBox.height).toBeLessThanOrEqual(composerBox.y + 2);
    expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(examplesBox.y + 2);
    const viewportHeight = page.viewportSize()?.height ?? Number.POSITIVE_INFINITY;
    expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(viewportHeight + 1);
  }

  const initialScroll = await page.locator('[data-gekta-chat-workspace="true"] main > div').first().evaluate((node) => {
    const style = window.getComputedStyle(node);
    return { overflowY: style.overflowY, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
  });
  expect(['auto', 'scroll']).not.toContain(initialScroll.overflowY);

  const composerFontSize = await composer.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).fontSize));
  expect(composerFontSize).toBeGreaterThanOrEqual(16);
  const privacyFontSize = await page.locator('#gekta-composer-boundary').evaluate((node) => Number.parseFloat(window.getComputedStyle(node).fontSize));
  expect(privacyFontSize).toBeGreaterThanOrEqual(14);
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
      await expectStartSurface(page, viewport.width);
      await expectNoHorizontalOverflow(page);

      const moreExamples = page.locator('[data-gekta-more-examples="true"]');
      await moreExamples.click();
      expect(await page.locator('[data-gekta-starter="true"]:visible').count()).toBeGreaterThan(2);
      await moreExamples.click();
      await expect(page.locator('[data-gekta-starter="true"]:visible')).toHaveCount(2);

      await openSeededConversation(page, viewport.width);
      await acceptRequiredConsent(page);
      await expect(page.locator('[data-gekta-role="assistant"]')).toBeVisible();
      const composer = page.locator('#gekta-composer-input');
      await expect(composer).toBeVisible();

      const activeScroll = await page.locator('[data-gekta-chat-workspace="true"] main > div').first().evaluate((node) => window.getComputedStyle(node).overflowY);
      expect(['auto', 'scroll']).toContain(activeScroll);

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
    { path: '/gekta/en', locale: 'EN', surfaceLocale: 'en', lang: 'en', menu: 'Open history', closeMenu: 'Close history', brand: 'GEKTA' },
    { path: '/gekta/zh', locale: 'ZH', surfaceLocale: 'zh', lang: 'zh-CN', menu: '打开历史记录', closeMenu: '关闭历史记录', brand: 'GEKTA' },
  ] as const) {
    for (const viewport of viewports) {
      test(`${route.locale} ${viewport.name} remains localized, progressive and 44px-safe`, async ({ page }, testInfo) => {
        const runtimeFailures: string[] = [];
        page.on('pageerror', (error) => runtimeFailures.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error' && /hydration|uncaught|error boundary/i.test(message.text())) runtimeFailures.push(message.text());
        });

        await seedConversation(page, route.surfaceLocale);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(route.path, { waitUntil: 'load' });
        expect(response?.ok()).toBe(true);
        await expect(page.locator('html')).toHaveAttribute('lang', route.lang);
        await expect(page.getByRole('button', { name: route.menu })).toBeVisible();
        await expect(page.locator('[data-gekta-chat-workspace="true"] main > header')).toContainText(route.brand);
        await expectStartSurface(page, viewport.width);
        await expectNoHorizontalOverflow(page);

        const moreExamples = page.locator('[data-gekta-more-examples="true"]');
        await moreExamples.click();
        expect(await page.locator('[data-gekta-starter="true"]:visible').count()).toBeGreaterThan(2);
        await moreExamples.click();
        await expect(page.locator('[data-gekta-starter="true"]:visible')).toHaveCount(2);

        const visualViewport = await page.evaluate(() => {
          const cssHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gekta-visual-viewport-height'));
          const actualHeight = window.visualViewport?.height ?? window.innerHeight;
          return { cssHeight, actualHeight };
        });
        expect(Number.isFinite(visualViewport.cssHeight)).toBe(true);
        expect(Math.abs(visualViewport.cssHeight - visualViewport.actualHeight)).toBeLessThanOrEqual(2);

        await expectTargetsAtLeast(visibleWorkspaceTargets(page), 44);
        const drawer = await openDrawerAndAssertModal(page, route.menu, route.closeMenu, viewport.width);
        await drawer.close.click();
        await expect(drawer.dialog).toHaveCount(0);
        await expect(drawer.opener).toBeFocused();
        await expect.poll(() => drawer.background.evaluate((node) => node.hasAttribute('inert'))).toBe(false);

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

        await openSeededConversation(page, viewport.width, route.menu, route.closeMenu);
        await acceptRequiredConsent(page);
        await expect(page.locator('[data-gekta-role="assistant"]')).toBeVisible();
        await expectTargetsAtLeast(visibleWorkspaceTargets(page), 44);
        await expectNoHorizontalOverflow(page);
        expect(runtimeFailures).toEqual([]);
      });
    }
  }

  test('390px preserves draft, caret and composer geometry through 20 keyboard cycles', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/gekta', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await page.locator('[data-gekta-starter="true"]').first().click();
    await acceptConsentIfPresent(page);

    const composer = page.locator('#gekta-composer-input');
    const draft = 'Строка 1\nСтрока 2\nСтрока 3\nСтрока 4\nСтрока 5';
    await composer.fill(draft);
    await expect(composer).toHaveValue(draft);
    await composer.evaluate((node) => (node as HTMLTextAreaElement).setSelectionRange(17, 17));
    await composer.focus();

    for (let cycle = 0; cycle < 20; cycle += 1) {
      await page.setViewportSize({ width: 390, height: 520 });
      await page.waitForFunction(() => {
        const cssHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gekta-visual-viewport-height'));
        const actualHeight = window.visualViewport?.height ?? window.innerHeight;
        return Math.abs(cssHeight - actualHeight) <= 2;
      });
      await expect(page.locator('html')).toHaveAttribute('data-gekta-keyboard-open', 'true');

      const geometry = await page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true']")?.getBoundingClientRect();
        const surface = document.querySelector<HTMLElement>("[data-gekta-drop-target='true']")?.getBoundingClientRect();
        const viewport = window.visualViewport;
        const visibleBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
        return {
          shellHeight: shell?.height ?? 0,
          surfaceBottom: surface?.bottom ?? Number.POSITIVE_INFINITY,
          gap: surface ? visibleBottom - surface.bottom : Number.NEGATIVE_INFINITY,
        };
      });
      expect(geometry.shellHeight).toBeGreaterThan(64);
      expect(geometry.surfaceBottom).toBeLessThanOrEqual(522);
      expect(geometry.gap).toBeGreaterThanOrEqual(7);
      expect(geometry.gap).toBeLessThanOrEqual(20);
      await expect(page.locator('#gekta-composer-boundary')).toBeHidden();
      await expect(composer).toHaveValue(draft);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(() => {
        const cssHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gekta-visual-viewport-height'));
        const actualHeight = window.visualViewport?.height ?? window.innerHeight;
        return Math.abs(cssHeight - actualHeight) <= 2;
      });
      await expect(page.locator('html')).not.toHaveAttribute('data-gekta-keyboard-open', 'true');
    }

    await expect(page.locator('#gekta-composer-boundary')).toBeVisible();
    await expect(composer).toHaveValue(draft);
    const selection = await composer.evaluate((node) => ({
      start: (node as HTMLTextAreaElement).selectionStart,
      end: (node as HTMLTextAreaElement).selectionEnd,
      height: (node as HTMLTextAreaElement).getBoundingClientRect().height,
    }));
    expect(selection.start).toBe(17);
    expect(selection.end).toBe(17);
    expect(selection.height).toBeLessThanOrEqual(144);
    await expectNoHorizontalOverflow(page);
  });

  test('public platform keeps one floating communication surface and no double mobile footer reserve', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    const response = await page.goto('/platform-v7', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);
    await expectNoHorizontalOverflow(page);

    const competingLauncher = page.locator('.pc-public-contact-dock, .pc-public-assistant-shortcut, .p7-support-chat-button').filter({ visible: true });
    if (await competingLauncher.count()) {
      await expect(page.locator('.pc-gekta-floating')).not.toBeVisible();
    }

    const mobileNavLinks = page.locator('.pc-cp-bottom-nav a:visible');
    await expect(mobileNavLinks).toHaveCount(5);
    await expectTargetsAtLeast(mobileNavLinks, 44);
    await expect(page.locator('.pc-cp-footer')).toBeHidden();
    const pageBottomReserve = await page.locator('main.pc-canonical-public').evaluate((node) => Number.parseFloat(getComputedStyle(node).paddingBottom));
    expect(pageBottomReserve).toBeLessThanOrEqual(1);
  });
});

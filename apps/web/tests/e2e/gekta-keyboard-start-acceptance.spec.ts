import { expect, test } from '@playwright/test';

async function waitForViewportAuthority(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
    const cssHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gekta-visual-viewport-height'));
    const actualHeight = window.visualViewport?.height ?? window.innerHeight;
    return Number.isFinite(cssHeight) && Math.abs(cssHeight - actualHeight) <= 2;
  });
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

test('390px empty start survives 20 keyboard cycles while discovery remains scrollable and caret stays stable', async ({ page }) => {
  const runtimeFailures: string[] = [];
  page.on('pageerror', (error) => runtimeFailures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydration|uncaught|error boundary|unhandled/i.test(message.text())) runtimeFailures.push(message.text());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/gekta', { waitUntil: 'load' });
  expect(response?.ok()).toBe(true);
  await waitForViewportAuthority(page);

  const workspace = page.locator('[data-gekta-chat-workspace="true"]');
  const composer = page.locator('#gekta-composer-input');
  const composerRoot = page.locator('[data-gekta-composer-root="true"]');
  const privacy = page.locator('#gekta-composer-boundary');
  const discovery = page.locator('[data-gekta-server-discovery="true"]');
  await expect(workspace).toBeVisible();
  await expect(composer).toBeVisible();
  await expect(composerRoot).toBeVisible();
  await expect(discovery).toBeAttached();
  expect(await composerRoot.evaluate((node) => Boolean(node.closest('[data-gekta-composer-slot="true"]')))).toBe(true);
  await composerRoot.evaluate((node) => {
    const host = node.closest<HTMLElement>('[data-gekta-composer-slot="true"]');
    if (host) host.dataset.gektaStableComposerHost = 'true';
  });

  const initialState = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true'] main > div:first-of-type");
    const workspace = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true']");
    return {
      rootOverflow: root ? getComputedStyle(root).overflowY : '',
      workspacePosition: workspace ? getComputedStyle(workspace).position : '',
      bodyOverflow: getComputedStyle(document.body).overflowY,
      htmlOverflow: getComputedStyle(document.documentElement).overflowY,
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      viewportHeight: window.innerHeight,
    };
  });
  expect(['auto', 'scroll']).not.toContain(initialState.rootOverflow);
  expect(initialState.workspacePosition).not.toBe('fixed');
  expect(initialState.bodyOverflow).not.toBe('hidden');
  expect(initialState.htmlOverflow).not.toBe('hidden');
  expect(initialState.scrollHeight).toBeGreaterThan(initialState.viewportHeight);

  const draft = 'Проверить поле 17: питание, влага и болезни';
  await composer.fill(draft);
  await composer.evaluate((node) => (node as HTMLTextAreaElement).setSelectionRange(19, 19, 'none'));
  await composer.focus();

  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.setViewportSize({ width: 390, height: 520 });
    await waitForViewportAuthority(page);
    await expect(page.locator('html')).toHaveAttribute('data-gekta-keyboard-open', 'true');
    await expect(composer).toBeVisible();
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(draft);
    await expect(privacy).toBeHidden();
    await expect(discovery).toBeAttached();

    const openState = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true']");
      const header = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true'] header")?.getBoundingClientRect();
      const composerRoot = document.querySelector<HTMLElement>("[data-gekta-composer-root='true']");
      const stableHost = composerRoot?.closest<HTMLElement>("[data-gekta-composer-slot='true']");
      const surface = document.querySelector<HTMLElement>("[data-gekta-drop-target='true']")?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const visibleBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const textarea = document.querySelector<HTMLTextAreaElement>('#gekta-composer-input');
      return {
        workspacePosition: workspace ? getComputedStyle(workspace).position : '',
        composerPosition: composerRoot ? getComputedStyle(composerRoot).position : '',
        stableHost: stableHost?.dataset.gektaStableComposerHost === 'true',
        headerHeight: header?.height ?? 0,
        surfaceHeight: surface?.height ?? 0,
        surfaceBottom: surface?.bottom ?? Number.POSITIVE_INFINITY,
        gap: surface ? visibleBottom - surface.bottom : Number.NEGATIVE_INFINITY,
        bodyOverflow: getComputedStyle(document.body).overflowY,
        htmlOverflow: getComputedStyle(document.documentElement).overflowY,
        documentScrollHeight: document.scrollingElement?.scrollHeight ?? 0,
        visibleHeight: viewport?.height ?? window.innerHeight,
        selectionStart: textarea?.selectionStart ?? -1,
        selectionEnd: textarea?.selectionEnd ?? -1,
      };
    });
    expect(openState.workspacePosition).not.toBe('fixed');
    expect(openState.composerPosition).toBe('fixed');
    expect(openState.stableHost).toBe(true);
    expect(openState.headerHeight).toBeGreaterThanOrEqual(44);
    expect(openState.surfaceHeight).toBeGreaterThanOrEqual(64);
    expect(openState.surfaceBottom).toBeLessThanOrEqual(522);
    expect(openState.gap).toBeGreaterThanOrEqual(-2);
    expect(openState.gap).toBeLessThanOrEqual(32);
    expect(openState.bodyOverflow).not.toBe('hidden');
    expect(openState.htmlOverflow).not.toBe('hidden');
    expect(openState.documentScrollHeight).toBeGreaterThan(openState.visibleHeight);
    expect(openState.selectionStart).toBe(19);
    expect(openState.selectionEnd).toBe(19);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy({ top: 24, behavior: 'auto' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'auto' }), scrollBefore);
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(draft);

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForViewportAuthority(page);
    await expect(page.locator('html')).not.toHaveAttribute('data-gekta-keyboard-open', 'true');
    await expect(composer).toBeVisible();
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(draft);
    await expect(privacy).toBeVisible();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflowY)).not.toBe('hidden');
    await expect.poll(() => composerRoot.evaluate((node) => getComputedStyle(node).position)).not.toBe('fixed');
    expect(await composerRoot.evaluate((node) => node.closest<HTMLElement>("[data-gekta-composer-slot='true']")?.dataset.gektaStableComposerHost === 'true')).toBe(true);
  }

  const finalState = await composer.evaluate((node) => ({
    start: (node as HTMLTextAreaElement).selectionStart,
    end: (node as HTMLTextAreaElement).selectionEnd,
    height: (node as HTMLTextAreaElement).getBoundingClientRect().height,
  }));
  expect(finalState.start).toBe(19);
  expect(finalState.end).toBe(19);
  expect(finalState.height).toBeLessThanOrEqual(144);
  await expectNoHorizontalOverflow(page);
  expect(runtimeFailures).toEqual([]);
});

test('320px drawer keeps security and support inside Gekta and all controls remain actionable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const response = await page.goto('/gekta', { waitUntil: 'load' });
  expect(response?.ok()).toBe(true);
  await waitForViewportAuthority(page);
  await expectNoHorizontalOverflow(page);

  const openMenu = page.locator('[data-gekta-chat-workspace="true"] header > button').first();
  await expect(openMenu).toBeVisible();
  await openMenu.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();

  const securityLink = drawer.getByRole('link', { name: 'Данные и безопасность' });
  await expect(securityLink).toBeVisible();
  await securityLink.click();
  await expect(page).toHaveURL(/\/gekta\/security$/);
  await expect(page.locator('[data-gekta-utility-page="security"]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Безопасность');
  await expectNoHorizontalOverflow(page);
  const securityNavMetrics = await page.locator("nav[aria-label='Gekta sections']").evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
  expect(securityNavMetrics.scroll).toBeLessThanOrEqual(securityNavMetrics.client + 1);

  await page.getByRole('link', { name: 'Поддержка', exact: true }).first().click();
  await expect(page).toHaveURL(/\/gekta\/support$/);
  const support = page.locator('[data-gekta-utility-page="support"]');
  await expect(support).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const form = page.locator('[data-gekta-support-form="true"]');
  await expect(form).toBeVisible();

  await page.route('**/api/platform-v7/inquiries', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    const payload = request.postDataJSON() as { source?: string; message?: string; consent?: string };
    expect(payload.source).toBe('support_chat');
    expect(payload.message).toContain('iPhone');
    expect(payload.consent).toBe('yes');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accepted: true, sent: true }) });
  });

  await form.locator('input[name="name"]').fill('Максим');
  await form.locator('input[name="contact"]').fill('maxim@example.test');
  await form.locator('textarea[name="message"]').fill('iPhone: проверка кликабельности и мобильного интерфейса Гекты.');
  await form.locator('input[name="consent"]').check();
  const submit = form.getByRole('button', { name: 'Отправить обращение' });
  const submitBox = await submit.boundingBox();
  expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await submit.click();
  await expect(page.getByRole('heading', { name: 'Обращение отправлено' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

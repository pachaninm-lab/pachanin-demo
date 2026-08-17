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

test('390px empty start survives 20 keyboard cycles without blank state, overlap or caret loss', async ({ page }) => {
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
  await expect(workspace).toBeVisible();
  await expect(composer).toBeVisible();
  await expect(composerRoot).toBeVisible();
  await expect.poll(() => composerRoot.evaluate((node) => Boolean(node.closest('[data-gekta-composer-slot="true"]')))).toBe(true);

  const initialOverflow = await workspace.locator('main > div').first().evaluate((node) => window.getComputedStyle(node).overflowY);
  expect(['auto', 'scroll']).not.toContain(initialOverflow);

  const draft = 'Проверить поле 17: питание, влага и болезни';
  await composer.fill(draft);
  await composer.evaluate((node) => (node as HTMLTextAreaElement).setSelectionRange(19, 19, 'none'));
  await composer.focus();
  const initialScrollY = await page.evaluate(() => window.scrollY);

  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.setViewportSize({ width: 390, height: 520 });
    await waitForViewportAuthority(page);
    await expect(page.locator('html')).toHaveAttribute('data-gekta-keyboard-open', 'true');
    await expect.poll(() => composerRoot.evaluate((node) => Boolean(node.closest('[data-gekta-composer-slot="true"]')))).toBe(false);
    await expect(composer).toBeVisible();
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(draft);
    await expect(privacy).toBeHidden();

    const openState = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true']")?.getBoundingClientRect();
      const header = document.querySelector<HTMLElement>("[data-gekta-chat-workspace='true'] header")?.getBoundingClientRect();
      const surface = document.querySelector<HTMLElement>("[data-gekta-drop-target='true']")?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const visibleBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const textarea = document.querySelector<HTMLTextAreaElement>('#gekta-composer-input');
      return {
        shellHeight: shell?.height ?? 0,
        headerHeight: header?.height ?? 0,
        surfaceHeight: surface?.height ?? 0,
        surfaceBottom: surface?.bottom ?? Number.POSITIVE_INFINITY,
        gap: surface ? visibleBottom - surface.bottom : Number.NEGATIVE_INFINITY,
        bodyOverflow: document.body.style.overflow,
        selectionStart: textarea?.selectionStart ?? -1,
        selectionEnd: textarea?.selectionEnd ?? -1,
      };
    });
    expect(openState.shellHeight).toBeGreaterThan(64);
    expect(openState.shellHeight).toBeLessThanOrEqual(522);
    expect(openState.headerHeight).toBeGreaterThanOrEqual(44);
    expect(openState.surfaceHeight).toBeGreaterThanOrEqual(64);
    expect(openState.surfaceBottom).toBeLessThanOrEqual(522);
    expect(openState.gap).toBeGreaterThanOrEqual(7);
    expect(openState.gap).toBeLessThanOrEqual(20);
    expect(openState.bodyOverflow).toBe('hidden');
    expect(openState.selectionStart).toBe(19);
    expect(openState.selectionEnd).toBe(19);

    await page.setViewportSize({ width: 390, height: 844 });
    await waitForViewportAuthority(page);
    await expect(page.locator('html')).not.toHaveAttribute('data-gekta-keyboard-open', 'true');
    await expect.poll(() => composerRoot.evaluate((node) => Boolean(node.closest('[data-gekta-composer-slot="true"]')))).toBe(true);
    await expect(composer).toBeVisible();
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(draft);
    await expect(privacy).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  }

  const finalState = await composer.evaluate((node) => ({
    start: (node as HTMLTextAreaElement).selectionStart,
    end: (node as HTMLTextAreaElement).selectionEnd,
    height: (node as HTMLTextAreaElement).getBoundingClientRect().height,
  }));
  expect(finalState.start).toBe(19);
  expect(finalState.end).toBe(19);
  expect(finalState.height).toBeLessThanOrEqual(144);
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScrollY);
  await expectNoHorizontalOverflow(page);
  expect(runtimeFailures).toEqual([]);
});

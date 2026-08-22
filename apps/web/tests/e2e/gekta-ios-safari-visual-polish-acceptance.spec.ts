import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectAppearanceReset(locator: Locator) {
  const controls = await locator.evaluateAll((nodes) => nodes
    .filter((node) => {
      const element = node as HTMLElement;
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    })
    .map((node) => {
      const style = window.getComputedStyle(node as HTMLElement) as CSSStyleDeclaration & { webkitAppearance?: string };
      return {
        label: (node as HTMLElement).getAttribute('aria-label') || (node.textContent || '').trim(),
        appearance: style.appearance,
        webkitAppearance: style.webkitAppearance || '',
      };
    }));

  expect(controls.length, 'expected visible controls with branded appearance').toBeGreaterThan(0);
  expect(
    controls.every((control) => control.appearance === 'none' || control.webkitAppearance === 'none'),
    JSON.stringify(controls, null, 2),
  ).toBe(true);
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
      return { label: (node as HTMLElement).getAttribute('aria-label') || (node.textContent || '').trim(), width: box.width, height: box.height };
    }));

  expect(boxes.length, 'expected visible mobile controls').toBeGreaterThan(0);
  expect(boxes.every((box) => box.width >= minimum && box.height >= minimum), JSON.stringify(boxes, null, 2)).toBe(true);
}

async function acceptConsentIfPresent(page: Page) {
  const consent = page.locator('[data-gekta-consent="true"]');
  if (!(await consent.count())) return;
  const accept = consent.locator('[data-gekta-consent-accept="true"]');
  await expect(accept).toBeVisible();
  await accept.click();
  await expect(consent).toHaveCount(0);
}

async function expectTextControlsIosSafe(page: Page) {
  const controls = page.locator("input:not([type='checkbox']):not([type='radio']):not([type='file']):visible, textarea:visible, select:visible");
  const metrics = await controls.evaluateAll((nodes) => nodes.map((node) => {
    const element = node as HTMLElement;
    const style = window.getComputedStyle(element) as CSSStyleDeclaration & { webkitAppearance?: string };
    const box = element.getBoundingClientRect();
    return {
      tag: element.tagName,
      height: box.height,
      fontSize: Number.parseFloat(style.fontSize),
      appearance: style.appearance,
      webkitAppearance: style.webkitAppearance || '',
    };
  }));
  expect(metrics.length).toBeGreaterThan(0);
  expect(metrics.every((item) => item.height >= 44 && item.fontSize >= 16), JSON.stringify(metrics, null, 2)).toBe(true);
  expect(metrics.every((item) => item.appearance === 'none' || item.webkitAppearance === 'none'), JSON.stringify(metrics, null, 2)).toBe(true);
}

test('320px keeps Safari controls branded and Gekta utility routes visually native', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const response = await page.goto('/gekta', { waitUntil: 'load' });
  expect(response?.ok()).toBe(true);
  await acceptConsentIfPresent(page);

  const composer = page.locator('#gekta-composer-input');
  await expect(composer).toBeVisible();
  await expect(composer).toHaveAttribute('placeholder', 'Задай вопрос Гекте');
  const boundary = page.locator('#gekta-composer-boundary');
  await expect(boundary).toHaveText('Не отправляй пароли, токены и другие секреты.');
  const boundaryHeight = await boundary.evaluate((node) => node.getBoundingClientRect().height);
  expect(boundaryHeight).toBeLessThanOrEqual(44);

  const workspaceButtons = page.locator('[data-gekta-chat-workspace="true"] button:visible');
  await expectAppearanceReset(workspaceButtons);
  await expectTargetsAtLeast(workspaceButtons, 44);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('gekta-ios-safari-polish-320x700.png'),
    fullPage: false,
    animations: 'disabled',
  });

  await page.getByRole('button', { name: 'Открыть историю' }).click();
  const drawer = page.getByRole('dialog', { name: 'Gekta' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('link', { name: 'Поддержка' }).click();
  await expect(page).toHaveURL(/\/gekta\/support\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Поддержка в одном интерфейсе' })).toBeVisible();
  await expectAppearanceReset(page.locator('button:visible'));
  await expectTargetsAtLeast(page.locator('button:visible, a:visible'), 44);
  await expectTextControlsIosSafe(page);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('gekta-support-ios-safari-polish-320x700.png'),
    fullPage: false,
    animations: 'disabled',
  });

  const securityResponse = await page.goto('/gekta/security', { waitUntil: 'load' });
  expect(securityResponse?.ok()).toBe(true);
  await expect(page.getByRole('heading', { level: 1, name: 'Безопасность без выхода из Гекты' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('gekta-security-ios-safari-polish-320x700.png'),
    fullPage: false,
    animations: 'disabled',
  });
});

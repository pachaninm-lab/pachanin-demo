import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectMinimumTargets(page: Page, selector: string) {
  const targets = page.locator(selector);
  await expect(targets.first()).toBeVisible();
  const valid = await targets.evaluateAll((nodes) => nodes.filter((node) => {
    const style = window.getComputedStyle(node);
    const box = node.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
  }).every((node) => {
    const box = node.getBoundingClientRect();
    return box.width >= 44 && box.height >= 44;
  }));
  expect(valid, `${selector} must expose at least 44×44 CSS px visible targets`).toBe(true);
}

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.describe('Platform V7 public registration official UX', () => {
  test('Russian registration exposes official human language without internal terminology', async ({ page }) => {
    const response = await page.goto('/platform-v7/register?lang=ru', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);

    await expect(page.getByRole('heading', { level: 1, name: 'Регистрация организации и пользователя' })).toBeVisible();
    await expect(page.getByText('Поля со знаком * обязательны для заполнения.')).toBeVisible();
    await expect(page.getByLabel('Формат участия *')).toBeVisible();
    await expect(page.getByLabel('Адрес электронной почты *')).toBeVisible();
    await expect(page.getByLabel('Пароль *')).toBeVisible();
    await expect(page.getByLabel('Повторите пароль *')).toBeVisible();
    await expect(page.getByText(/12–128 символов.*как минимум три группы/)).toBeVisible();

    const visibleText = await page.locator('body').innerText();
    for (const forbidden of ['P0', 'Первый клиентский доступ', 'Рабочее пространство', 'correlation ID', 'Рабочий email']) {
      expect(visibleText).not.toContain(forbidden);
    }
    expect(visibleText).not.toMatch(/\b(?:Заполни|Ожидай|Повтори позже|Открой письмо|Используй)\b/u);

    await page.getByLabel('Формат участия *').selectOption('employee');
    await expect(page.getByText('Новая организация при этом не создаётся.')).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
  });

  for (const width of [320, 375, 390, 430, 768, 1280]) {
    test(`${width}px registration reflow stays usable`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const response = await page.goto('/platform-v7/register?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.getByRole('button', { name: 'Отправить заявку на регистрацию' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectMinimumTargets(page, '.p0-register-form input:not([type="checkbox"]):visible');
      await expectMinimumTargets(page, '.p0-register-form select:visible');
      await expectMinimumTargets(page, '.p0-register-form button:visible');
    });
  }

  test('empty form remains client-side and explains required fields', async ({ page }) => {
    const mutations: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') mutations.push(`${request.method()} ${request.url()}`);
    });
    await page.goto('/platform-v7/register?lang=ru', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Отправить заявку на регистрацию' }).click();
    await expect(page.getByRole('alert')).toContainText('Проверьте обязательные поля');
    expect(mutations.filter((item) => item.includes('/api/auth/register'))).toEqual([]);
  });

  test('captures bounded Russian registration visual evidence', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Visual evidence is captured once in Chromium.');
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const response = await page.goto('/platform-v7/register?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`registration-official-ru-${width}px.png`),
        fullPage: true,
        animations: 'disabled',
      });
    }
  });
});

import { expect, test } from '@playwright/test';

async function expectNoGuestAuthArtifacts(page: import('@playwright/test').Page) {
  const cookies = await page.context().cookies();
  const cookieNames = cookies.map((cookie) => cookie.name).join(' ');
  expect(cookieNames).not.toMatch(/pc-role|auth|session/i);

  const storage = await page.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
  }));
  expect(storage.local.join(' ')).not.toMatch(/pc-v7-active-role|pc-role|auth|session/i);
  expect(storage.session.join(' ')).not.toMatch(/pc-v7-active-role|pc-role|auth|session/i);
}

test.describe('platform-v7 public demo and question form', () => {
  test('homepage exposes demo and question CTAs without replacing login', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto('/platform-v7', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole('link', { name: /посмотреть демо-сделку/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /задать вопрос/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /^войти$/i })).toBeVisible();
  });

  test('demo is public, synthetic, and does not create a guest session', async ({ page }) => {
    await page.context().clearCookies();
    const response = await page.goto('/platform-v7/demo', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByTestId('platform-v7-demo-flow-hero')).toContainText(/ДЕМО|синтетические данные|тестовый сценарий/i);
    await expect(page.getByText(/Рабочее действие недоступно в демо/i).first()).toBeVisible();
    await expect(page.locator('a[href*="/platform-v7/seller"], a[href*="/platform-v7/buyer"], a[href*="/platform-v7/bank"], a[href*="/platform-v7/disputes"]')).toHaveCount(0);
    await expectNoGuestAuthArtifacts(page);
  });

  test('question form is public and Netlify-ready without backend session side effects', async ({ page }) => {
    await page.context().clearCookies();
    const response = await page.goto('/platform-v7/contact', { waitUntil: 'networkidle' });

    expect(response?.ok()).toBeTruthy();
    const form = page.locator('form[name="platform-v7-question"]');
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('method', /POST/i);
    await expect(form).toHaveAttribute('data-netlify', 'true');
    await expect(form.locator('input[name="form-name"]')).toHaveValue('platform-v7-question');
    await expect(page.getByLabel(/тип вопроса/i)).toBeVisible();
    await expect(page.getByLabel(/телефон или email/i)).toBeVisible();
    await expect(page.getByLabel(/сообщение/i)).toBeVisible();
    await expectNoGuestAuthArtifacts(page);
  });
});

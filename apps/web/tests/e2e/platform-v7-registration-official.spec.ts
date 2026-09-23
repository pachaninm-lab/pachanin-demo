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

    await expect(page.getByRole('heading', { level: 1, name: 'Подключение организации', exact: true })).toBeVisible();
    await expect(page.getByText('Поля со знаком * обязательны для заполнения.')).toBeVisible();
    await expect(page.getByLabel('Формат участия *', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Адрес электронной почты *', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Пароль *', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Повторите пароль *', { exact: true })).toBeVisible();
    await expect(page.getByText(/12–128 символов.*как минимум три группы/)).toBeVisible();

    const visibleText = await page.locator('body').innerText();
    for (const forbidden of ['P0', 'Первый клиентский доступ', 'Рабочее пространство', 'correlation ID', 'Рабочий email']) {
      expect(visibleText).not.toContain(forbidden);
    }
    expect(visibleText).not.toMatch(/\b(?:Заполни|Ожидай|Повтори позже|Открой письмо|Используй)\b/u);

    await page.getByLabel('Формат участия *', { exact: true }).selectOption('employee');
    await expect(page.getByText('Новая организация при этом не создаётся.')).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
  });

  for (const width of [320, 375, 390, 430, 768, 1280]) {
    test(`${width}px registration reflow stays usable`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const response = await page.goto('/platform-v7/register?lang=ru', { waitUntil: 'load' });
      expect(response?.ok()).toBe(true);
      await expect(page.getByRole('button', { name: 'Отправить заявку на регистрацию', exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectMinimumTargets(page, '.p0-register-form input:not([type="checkbox"]):visible');
      await expectMinimumTargets(page, '.p0-register-form select:visible');
      await expectMinimumTargets(page, '.p0-register-form button:visible');
    });
  }

  test('native required-field validation prevents an empty registration request', async ({ page }) => {
    const mutations: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') mutations.push(`${request.method()} ${request.url()}`);
    });
    await page.goto('/platform-v7/register?lang=ru', { waitUntil: 'load' });
    const legalName = page.getByLabel('Наименование организации / ФИО предпринимателя *', { exact: true });
    expect(await legalName.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);
    const workspace = page.locator('form.p0-register-form select[name="workspace"]');
    await expect(workspace).toHaveValue('');
    await page.getByRole('button', { name: 'Отправить заявку на регистрацию', exact: true }).click();
    await expect(workspace).toBeFocused();
    await workspace.selectOption('seller');
    await page.getByRole('button', { name: 'Отправить заявку на регистрацию', exact: true }).click();
    await expect(legalName).toBeFocused();
    expect(mutations.filter((item) => item.includes('/api/auth/register'))).toEqual([]);
  });



  const sectionTitles = {
    ru: ['Формат участия', 'Сведения об организации', 'Заявитель и доступ', 'Подтверждение условий'],
    en: ['Participation type', 'Organization details', 'Applicant and access', 'Terms and privacy'],
    zh: ['参与方式', '组织信息', '申请人与访问设置', '条款与个人信息'],
  } as const;
  for (const locale of ['ru', 'en', 'zh'] as const) {
    for (const width of [390, 1280] as const) {
      test('UX-21 ' + locale + ' ' + width + ': one form keeps four sections and all required fields', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop-chromium', 'Focused form sections and reflow evidence in Chromium.');
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        const response = await page.goto('/platform-v7/register?lang=' + locale, { waitUntil: 'load' });
        expect(response?.status()).toBe(200);
        const form = page.locator('form.p0-register-form');
        await expect(form).toHaveCount(1);
        const headings = await form.locator('section.p0-register-card h2').allTextContents();
        expect(headings.map((heading) => heading.replace(/^\d+\.\s*/u, '').trim())).toEqual(sectionTitles[locale]);
        for (const name of ['workspace', 'orgType', 'orgLegalName', 'orgInn', 'region',
          'fullName', 'position', 'phone', 'email', 'password', 'confirmPassword',
          'acceptTerms', 'acceptPrivacy']) {
          await expect(form.locator('[name="' + name + '"]')).toHaveAttribute('required', '');
        }
        for (const name of ['orgKpp', 'orgOgrn']) {
          await expect(form.locator('[name="' + name + '"]')).not.toHaveAttribute('required', '');
        }
        await expectNoHorizontalOverflow(page);
        await page.screenshot({
          path: testInfo.outputPath('registration-sections-' + (process.env.GITHUB_SHA || 'local') + '-' + locale + '-' + width + '.png'),
          fullPage: true, animations: 'disabled',
        });
      });
    }
  }

  for (const locale of ['ru', 'en', 'zh'] as const) {
    test('T08 ' + locale + ': pending POST locks the visible version after snapshot', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-chromium', 'Focused registration mutation evidence in Chromium; existing browser matrix remains.');
      await page.setViewportSize({ width: 390, height: 844 });
      let release!: () => void;
      const pending = new Promise<void>((resolve) => { release = () => resolve(); });
      const attempts: Array<{ payload: Record<string, unknown>; key: string }> = [];
      await page.route('**/api/auth/register', async (route) => {
        attempts.push({
          payload: route.request().postDataJSON() as Record<string, unknown>,
          key: route.request().headers()['idempotency-key'],
        });
        if (attempts.length === 1) {
          await pending;
          await route.abort('failed');
          return;
        }
        await route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' });
      });
      await page.goto('/platform-v7/register?lang=' + locale, { waitUntil: 'load' });
      const form = page.locator('form.p0-register-form');
      const fill = (name: string, value: string) => form.locator('[name="' + name + '"]').fill(value);
      await form.locator('[name="workspace"]').selectOption('seller');
      await fill('orgLegalName', 'Fixture Organisation');
      await fill('orgInn', '1234567890');
      await fill('region', 'Tambov');
      await fill('fullName', 'Fixture Person');
      await fill('position', 'Director');
      await fill('phone', '+79990000000');
      await fill('email', 'fixture@example.invalid');
      await fill('password', 'StrongPassword#123');
      await fill('confirmPassword', 'StrongPassword#123');
      await form.locator('[name="acceptTerms"]').check();
      await form.locator('[name="acceptPrivacy"]').check();
      expect(await form.evaluate((node) => (node as HTMLFormElement).checkValidity())).toBe(true);
      await form.locator('button[type="submit"]').click();
      await expect.poll(() => attempts.length).toBe(1);
      await expect(form.locator('fieldset.p0-register-fields')).toHaveAttribute('disabled', '');
      await expect(form.locator('[name="email"]')).toBeDisabled();
      expect(attempts[0].payload).toMatchObject({
        workspace: 'seller', orgLegalName: 'Fixture Organisation', email: 'fixture@example.invalid',
        password: 'StrongPassword#123', acceptTerms: true, acceptPrivacy: true,
      });
      const entry = page.getByRole('button', { name: {
        ru: 'Присоединиться к организации',
        en: 'Join an existing organisation',
        zh: '加入已有机构',
      }[locale], exact: true });
      await expect(entry).toBeDisabled();
      await entry.evaluate((node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await expect(form.locator('[name="workspace"]')).toHaveValue('seller');
      release();
      await expect(form.getByRole('alert')).toContainText(
        locale === 'ru' ? 'Результат отправки пока не подтверждён' : /not confirmed|未确认/i,
      );
      await expect(entry).toBeEnabled();
      await form.locator('button[type="submit"]').click();
      await expect.poll(() => attempts.length).toBe(2);
      expect(attempts[1].payload).toEqual(attempts[0].payload);
      expect(attempts[1].key).toBe(attempts[0].key);
      await expect(page.locator('.p0-register-state')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  for (const locale of ['ru', 'en', 'zh'] as const) {
    test('T15 ' + locale + ': execution requires an explicit participation choice and employee joins an organisation', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-chromium', 'Focused registration intent contract in Chromium.');
      const response = await page.goto('/platform-v7/register?lang=' + locale + '&intent=execution', { waitUntil: 'load' });
      expect(response?.status()).toBe(200);
      const workspace = page.locator('form.p0-register-form select[name="workspace"]');
      await expect(workspace).toHaveValue('');
      expect(await workspace.evaluate((node) => (node as HTMLSelectElement).validity.valueMissing)).toBe(true);
      const options = await workspace.locator('option:not([disabled])').evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLOptionElement).value));
      expect(options).toEqual(['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'employee']);
      const joinLabels = { ru: 'Присоединиться к организации', en: 'Join an existing organisation', zh: '加入已有机构' } as const;
      await expect(workspace.locator('optgroup')).toHaveAttribute('label', joinLabels[locale]);
      await workspace.selectOption('employee');
      await expect(workspace).toHaveValue('employee');
      expect(await workspace.evaluate((node) => (node as HTMLSelectElement).validity.valueMissing)).toBe(false);
      if (locale === 'ru') await expect(page.getByText('Новая организация при этом не создаётся.', { exact: false })).toBeVisible();
      for (const [intent, expected] of [['sell', 'seller'], ['buy', 'buyer'], ['finance', 'bank'], ['employee', 'employee']] as const) {
        await page.goto('/platform-v7/register?lang=' + locale + '&intent=' + intent, { waitUntil: 'load' });
        await expect(page.locator('form.p0-register-form select[name="workspace"]')).toHaveValue(expected);
      }
      await page.goto('/platform-v7/register?lang=' + locale, { waitUntil: 'load' });
      await expect(page.locator('form.p0-register-form select[name="workspace"]')).toHaveValue('');
      const currentUrl = page.url();
      const legalName = page.locator('form.p0-register-form [name="orgLegalName"]');
      await legalName.fill('Existing Organisation');
      await page.getByRole('button', { name: joinLabels[locale], exact: true }).click();
      await expect(page).toHaveURL(currentUrl);
      await expect(legalName).toHaveValue('Existing Organisation');
      await expect(page.locator('form.p0-register-form select[name="workspace"]')).toHaveValue('employee');
    });
  }

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

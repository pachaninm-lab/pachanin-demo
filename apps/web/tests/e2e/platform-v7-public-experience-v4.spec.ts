import { expect, test } from '@playwright/test';

for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
  test(`canonical public homepage reflows at ${width}px`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.setViewportSize({ width, height: width < 768 ? 860 : 960 });
    await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Управляйте агросделкой');
    await expect(page.locator('a[href^="/platform-v7/register"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="platform-v7-deal-card"]')).toBeVisible();
    await expect(page.getByText('9 ролей', { exact: true })).toBeVisible();
    await expect(page.getByText('7 шагов', { exact: true })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('.pc-site-header')?.getBoundingClientRect();
      const heading = document.querySelector('h1')?.getBoundingClientRect();
      const primary = document.querySelector('.pc-v6-hero .pc-v6-primary')?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerBottom: header?.bottom ?? 0,
        headingTop: heading?.top ?? 0,
        primaryHeight: primary?.height ?? 0,
      };
    });

    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.headingTop).toBeGreaterThanOrEqual(metrics.headerBottom - 1);
    expect(metrics.primaryHeight).toBeGreaterThanOrEqual(44);
    expect(runtimeErrors).toEqual([]);
  });
}

test('homepage exposes exactly nine public role perspectives without changing URL authority', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  const roles = page.locator('#participants');
  await roles.scrollIntoViewIfNeeded();
  const tabs = roles.getByRole('tab');
  await expect(tabs).toHaveCount(9);

  for (const label of [
    'Продавец',
    'Покупатель',
    'Логистика',
    'Водитель',
    'Элеватор / хранение',
    'Лаборатория',
    'Сюрвейер',
    'Банк / финансы',
    'Сотрудник платформы',
  ]) {
    await expect(roles.getByRole('tab', { name: label })).toBeVisible();
  }

  await expect(roles).toContainText('реальные полномочия определяются системой после регистрации и проверки организации');
  const before = page.url();
  await roles.getByRole('tab', { name: 'Сотрудник платформы' }).click();
  await expect(roles.getByRole('tabpanel')).toContainText('Оператор / контроль платформы');
  expect(page.url()).toBe(before);
});

test('homepage presents one seven-step ordinary Deal journey and keeps exceptions separate', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  const path = page.locator('#deal-path');
  await expect(path.getByRole('heading', { level: 2 })).toContainText('Семь шагов обычной агросделки');
  await expect(path.locator('article')).toHaveCount(7);
  await expect(path.getByRole('heading', { level: 3, name: 'Товар и условия' })).toBeVisible();
  await expect(path.getByRole('heading', { level: 3, name: 'Сделка и договор' })).toBeVisible();
  await expect(path.getByRole('heading', { level: 3, name: 'Расчёт и закрытие' })).toBeVisible();
  await expect(path.getByText(/Товар и условия → торги и контрагент → Сделка и договор/)).toBeVisible();

  const states = page.locator('#live');
  await expect(states.getByText('Обычное исполнение — основной сценарий')).toBeVisible();
  await expect(states.locator('input[name="public-deal-state"]:checked')).toHaveAttribute('id', 'public-deal-state-normal');
});

test('registration stays primary while Deal exploration, PDF and organization assistance remain separate', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  const header = page.locator('.pc-site-header');
  await expect(header.locator('a[href^="/platform-v7/register"]')).toBeVisible();

  const hero = page.locator('.pc-v6-hero');
  await expect(hero.locator('.pc-v6-primary')).toHaveAttribute('href', /\/platform-v7\/register\?lang=ru/);
  await expect(hero.locator('a[href="#live"]')).toBeVisible();
  await expect(hero.locator('a[href="/downloads/prozrachnaya-tsena-presentation.pdf"]')).toBeVisible();

  const final = page.locator('.pc-v6-final');
  await final.scrollIntoViewIfNeeded();
  await expect(final.locator('.pc-v6-primary')).toHaveAttribute('href', /\/platform-v7\/register\?lang=ru/);
  await expect(final.locator('a[href="#connect-organization"]')).toBeVisible();

  const assistance = page.locator('#connect-organization');
  await expect(assistance).toContainText('Эта форма не является регистрацией');
  await expect(assistance.getByRole('button', { name: 'Продолжить' })).toBeVisible();
  await expect(assistance.getByRole('button', { name: 'Отправить запрос на помощь' })).toBeHidden();
});

test('mobile service menu stays inside the 320px viewport and exposes trust navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  const menu = page.locator('.pc-site-mobile-menu');
  const summary = menu.locator('summary');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute('aria-label', 'Меню');
  await summary.click();

  const mobileNav = menu.locator('.pc-site-mobile-nav');
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.locator('a[href="#participants"]')).toBeVisible();
  await expect(mobileNav.locator('a[href="#deal-path"]')).toBeVisible();
  await expect(mobileNav.locator('a[href="#trust"]')).toBeVisible();

  const bounds = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const headerChildren = Array.from(document.querySelectorAll('.pc-site-header > *, .pc-site-actions > *'))
      .filter((node) => window.getComputedStyle(node).display !== 'none')
      .map((node) => node.getBoundingClientRect());
    const nav = document.querySelector('.pc-site-mobile-nav')?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - viewport,
      headerInside: headerChildren.every((rect) => rect.left >= -1 && rect.right <= viewport + 1),
      navInside: Boolean(nav && nav.left >= -1 && nav.right <= viewport + 1),
    };
  });

  expect(bounds.overflow).toBeLessThanOrEqual(1);
  expect(bounds.headerInside).toBe(true);
  expect(bounds.navInside).toBe(true);
  await summary.click();
  await expect(mobileNav).toBeHidden();
});

test('how-it-works leads with the ordinary journey while retaining fictional-data boundaries', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/platform-v7/how-it-works?lang=ru', { waitUntil: 'load' });

  await expect(page.getByRole('heading', { level: 1 })).toContainText('От условий до закрытия — один понятный путь');
  await expect(page.locator('.pc-ppe-demo-banner')).toContainText('вымышленный пример');
  await expect(page.locator('a[href^="/platform-v7/register"]').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Что вы хотите сделать?' })).toBeVisible();

  await page.getByRole('button', { name: /Купить продукцию/ }).click();
  await expect(page).toHaveURL(/stage=terms/);
  await expect(page).toHaveURL(/perspective=buyer/);
  await expect(page.locator('[data-testid="public-deal-quick-stage"]')).toContainText('Условия');
  await expect(page.locator('[data-testid="public-deal-journey-context"]')).toContainText('Вымышленный пример');
});

test('detailed explorer preserves ten internal stages and browser history without exposing extra public roles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal&stage=acceptance&lens=participants&view=detail&intent=buy', { waitUntil: 'load' });

  const stageTrack = page.locator('.pc-ppe-stage-track');
  await expect(stageTrack).toBeVisible();
  await expect(stageTrack.getByRole('button')).toHaveCount(10);

  const perspective = page.locator('.pc-ppe-context-panel select');
  await expect(perspective.locator('option[data-public-perspective="true"]')).toHaveCount(9);
  const legacyStaff = perspective.locator('option[data-legacy-staff="true"]');
  await expect(legacyStaff).toHaveCount(3);
  for (const option of await legacyStaff.all()) {
    await expect(option).toHaveAttribute('hidden', '');
    await expect(option).toBeDisabled();
  }

  await stageTrack.getByRole('button', { name: /Документы/ }).click();
  await expect(page).toHaveURL(/stage=documents/);
  await page.goBack();
  await expect(page).toHaveURL(/stage=acceptance/);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('reduced motion pauses guided autoplay rather than advancing automatically', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal&stage=acceptance&lens=execution&intent=buy', { waitUntil: 'load' });

  await page.getByRole('button', { name: 'Начать быстрый показ' }).click();
  await expect(page).toHaveURL(/stage=terms/);
  const url = page.url();
  await page.waitForTimeout(3200);
  expect(page.url()).toBe(url);
  await expect(page.getByRole('button', { name: 'Продолжить' })).toBeVisible();
});

test('public pages retain information at a 200 percent text scale', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.pc-v6-hero .pc-v6-primary')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('support opens as an accessible modal bottom sheet and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });

  const trigger = page.locator('.p7-support-chat-button');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Поддержка' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  await expect(dialog.getByLabel('Тема')).toBeFocused();

  const bounds = await dialog.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width, viewport: window.innerWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.width).toBeGreaterThanOrEqual(318);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('support control does not cover final registration and assistance actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/platform-v7?lang=ru', { waitUntil: 'load' });
  await page.locator('.pc-v6-final').scrollIntoViewIfNeeded();
  await page.waitForTimeout(220);

  const intersections = await page.evaluate(() => {
    const support = document.querySelector('.p7-support-chat-button')?.getBoundingClientRect();
    const actions = Array.from(document.querySelectorAll('.pc-v6-final .pc-v6-actions a')).map((node) => node.getBoundingClientRect());
    if (!support) return [];
    return actions.map((action) => !(support.right <= action.left || support.left >= action.right || support.bottom <= action.top || support.top >= action.bottom));
  });

  expect(intersections).not.toContain(true);
});

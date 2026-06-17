import { expect, test } from '@playwright/test';

const routes = [
  { path: '/platform-v7', text: 'Прозрачная Цена' },
  { path: '/platform-v7/control-tower', text: 'Центр управления' },
  { path: '/platform-v7/driver', text: 'Полевой экран водителя' },
  { path: '/platform-v7/elevator', text: 'Приёмка как доказательство сделки' },
  { path: '/platform-v7/lab', text: 'Лаборатория как доказательство качества' },
  { path: '/platform-v7/surveyor', text: 'Независимая фиксация на площадке' },
  { path: '/platform-v7/deals/DL-9102/clean', text: 'Карточка сделки · пилотный контур' },
  { path: '/platform-v7/bank/release-safety', text: 'Проверка безопасности выпуска денег' },
] as const;

const roleCases = [
  { role: 'driver', home: '/platform-v7/driver', requiredDock: ['Маршрут', 'Фото', 'ИИ', 'Меню'], menuMustContain: ['Маршрут', 'Фото', 'События', 'Документы'], forbiddenMenu: ['Банк', 'Сделки'] },
  { role: 'elevator', home: '/platform-v7/elevator', requiredDock: ['Приёмка', 'Вес', 'ИИ', 'Меню'], menuMustContain: ['Очередь', 'Вес', 'Выгрузка', 'Акты'], forbiddenMenu: ['Сделки', 'Банк'] },
  { role: 'lab', home: '/platform-v7/lab', requiredDock: ['Пробы', 'Качество', 'ИИ', 'Меню'], menuMustContain: ['Пробы', 'Качество', 'Протокол', 'Повторный анализ'], forbiddenMenu: ['Сделки', 'Споры'] },
  { role: 'seller', home: '/platform-v7/seller', requiredDock: ['Главная', 'Документы', 'Деньги', 'ИИ', 'Меню'], menuMustContain: ['Партии', 'Офферы', 'Документы', 'СДИЗ / ЭТрН', 'Приёмка', 'Деньги / резерв', 'Блокеры'], forbiddenMenu: ['Банковское основание'] },
  { role: 'bank', home: '/platform-v7/bank', requiredDock: ['Основание', 'Факторинг', 'Эскроу', 'ИИ', 'Меню'], menuMustContain: ['Банковское основание', 'Факторинг', 'Эскроу', 'Документы', 'Удержания', 'Риски'], forbiddenMenu: ['Кабинет продавца'] },
  { role: 'operator', home: '/platform-v7/control-tower', requiredDock: ['Центр', 'Сделки', 'Деньги', 'ИИ', 'Меню'], menuMustContain: ['Центр управления', 'Сделки', 'Лоты и запросы', 'Логистика', 'Деньги', 'Споры', 'Комплаенс'], forbiddenMenu: ['Кабинет продавца'] },
] as const;

const staleMobileCopy = [
  ['Controlled', 'pilot'].join(' '),
  ['Control', 'Tower'].join(' '),
  ['call', 'backs'].join(''),
  ['evidence', 'first'].join('-'),
  ['sandbox', 'dispatch'].join(' '),
  ['Action', 'handoff'].join(' '),
  ['domain', 'core'].join('-'),
  ['run', 'time'].join(''),
  ['leg', 'acy'].join(''),
  ['mo', 'ck'].join(''),
  ['de', 'bug'].join(''),
] as const;

async function setRole(page: any, role: string) {
  await page.addInitScript((value: string) => {
    window.sessionStorage.setItem('pc-v7-active-role', value);
    document.cookie = `pc-role=${value}; Path=/; SameSite=Lax`;
  }, role);
}

async function noHorizontalOverflow(page: any, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} should not overflow horizontally`).toBeLessThanOrEqual(8);
}

test.describe('platform-v7 mobile smoke', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

  for (const route of routes) {
    test(`${route.path} renders at 375px without horizontal overflow`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${route.path} should return ok response`).toBeTruthy();

      await expect(page.locator('body')).toContainText(route.text, { timeout: 15000 });
      await expect(page.locator('body')).not.toContainText('Ошибка страницы');

      for (const copy of staleMobileCopy) {
        await expect(page.getByText(copy, { exact: false }), `${route.path} should not show stale mobile copy`).toHaveCount(0);
      }

      const pageShape = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headings: document.querySelectorAll('h1, h2').length,
        controls: document.querySelectorAll('a, button').length,
      }));

      expect(pageShape.overflow, `${route.path} should not overflow horizontally`).toBeLessThanOrEqual(8);
      expect(pageShape.headings, `${route.path} should keep a usable mobile hierarchy`).toBeGreaterThan(0);
      expect(pageShape.controls, `${route.path} should keep reachable mobile controls`).toBeGreaterThan(0);

      const brokenImages = await page.locator('img:visible').evaluateAll((images) =>
        images
          .filter((img) => img instanceof HTMLImageElement)
          .filter((img) => !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0)
          .map((img) => ({ src: img.getAttribute('src'), alt: img.getAttribute('alt') }))
      );

      expect(brokenImages, `${route.path} should not have broken visible images on mobile`).toEqual([]);
    });
  }

  for (const item of roleCases) {
    test(`role shell dock and full menu work for ${item.role}`, async ({ page }) => {
      await setRole(page, item.role);
      const response = await page.goto(item.home, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${item.role} home should load`).toBeTruthy();
      await expect(page.locator('.pc-v7-role-dock')).toBeVisible({ timeout: 15000 });

      for (const label of item.requiredDock) {
        await expect(page.locator('.pc-v7-role-dock').getByText(label, { exact: true }), `${item.role} dock should show ${label}`).toBeVisible();
      }

      const menuButton = page.locator('.pc-v7-role-dock').getByText('Меню', { exact: true });
      await expect(menuButton, `${item.role} should expose full function menu`).toBeVisible();
      await menuButton.click();
      await expect(page.locator('.pc-v7-safe-drawer-nav')).toBeVisible();
      for (const label of item.menuMustContain) {
        await expect(page.locator('.pc-v7-safe-drawer-nav').getByText(label, { exact: true }), `${item.role} menu should contain ${label}`).toBeVisible();
      }
      for (const label of item.forbiddenMenu) {
        await expect(page.locator('.pc-v7-safe-drawer-nav').getByText(label, { exact: true }), `${item.role} menu should not contain ${label}`).toHaveCount(0);
      }

      await page.locator('.pc-v7-role-dock').getByText('ИИ', { exact: true }).click();
      await expect(page).toHaveURL(/\/platform-v7\/ai/);
      await expect(page.locator('body')).toContainText('ИИ-помощник роли');
      await expect(page.locator('body')).toContainText('только');

      await page.locator('.pc-v4-brand').first().click();
      await expect(page).toHaveURL(/\/platform-v7$/);

      await setRole(page, item.role);
      await page.goto(item.home, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Открыть уведомления роли').click();
      await expect(page.locator('.pc-v7-notice-panel')).toBeVisible();
      await expect(page.locator('.pc-v7-notice-panel')).toContainText('Уведомления роли');
      await expect(page.locator('body')).not.toContainText('Ошибка страницы');

      await noHorizontalOverflow(page, `${item.role} shell`);
    });
  }
});

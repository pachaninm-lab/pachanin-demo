import { expect, test, type Page } from '@playwright/test';

type Locale = 'ru' | 'en' | 'zh';
type RoleKey =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'storage'
  | 'laboratory'
  | 'surveyor'
  | 'bank'
  | 'employee';

type RoleExpectation = Readonly<{ key: RoleKey; label: string; lensSnippet: string }>;

const localeCopy: Record<Locale, Readonly<{
  rolesLabel: string;
  preview: string;
  responsibility: string;
  next: string;
  evidence: string;
  money: string;
  authorityBoundary: string;
}>> = {
  ru: {
    rolesLabel: 'Выберите роль для просмотра',
    preview: 'Упрощённый экран рабочего кабинета',
    responsibility: 'Ответственность',
    next: 'Следующее действие',
    evidence: 'Основание',
    money: 'Денежный смысл',
    authorityBoundary: 'критическое решение остаётся за уполномоченным участником',
  },
  en: {
    rolesLabel: 'Choose a role to preview',
    preview: 'Simplified workspace screen',
    responsibility: 'Responsibility',
    next: 'Next action',
    evidence: 'Basis',
    money: 'Money meaning',
    authorityBoundary: 'critical decisions stay with an authorised participant',
  },
  zh: {
    rolesLabel: '选择角色查看',
    preview: '简化工作空间界面',
    responsibility: '责任',
    next: '下一步',
    evidence: '依据',
    money: '资金含义',
    authorityBoundary: '关键决定仍由有权限的参与方作出',
  },
};

const roles: Record<Locale, readonly RoleExpectation[]> = {
  ru: [
    { key: 'seller', label: 'Продавец', lensSnippet: 'Условия товара' },
    { key: 'buyer', label: 'Покупатель', lensSnippet: 'Соответствие фактического исполнения' },
    { key: 'logistics', label: 'Логистика', lensSnippet: 'Партия, маршрут' },
    { key: 'driver', label: 'Водитель', lensSnippet: 'Только нужные для рейса' },
    { key: 'storage', label: 'Элеватор / хранение', lensSnippet: 'Приёмка партии' },
    { key: 'laboratory', label: 'Лаборатория', lensSnippet: 'Проба, методика' },
    { key: 'surveyor', label: 'Сюрвейер', lensSnippet: 'Цепочка фактов' },
    { key: 'bank', label: 'Банк / финансы', lensSnippet: 'Основание финансового действия' },
    { key: 'employee', label: 'Сотрудник платформы', lensSnippet: 'Причина исключения' },
  ],
  en: [
    { key: 'seller', label: 'Seller', lensSnippet: 'Product terms' },
    { key: 'buyer', label: 'Buyer', lensSnippet: 'Execution against terms' },
    { key: 'logistics', label: 'Logistics', lensSnippet: 'Lot, route' },
    { key: 'driver', label: 'Driver', lensSnippet: 'Only the route' },
    { key: 'storage', label: 'Elevator / storage', lensSnippet: 'Lot intake' },
    { key: 'laboratory', label: 'Laboratory', lensSnippet: 'Sample, method' },
    { key: 'surveyor', label: 'Surveyor', lensSnippet: 'fact and evidence chain' },
    { key: 'bank', label: 'Bank / finance', lensSnippet: 'basis for a financial action' },
    { key: 'employee', label: 'Platform employee', lensSnippet: 'Exception cause' },
  ],
  zh: [
    { key: 'seller', label: '卖方', lensSnippet: '商品条件' },
    { key: 'buyer', label: '买方', lensSnippet: '实际履约' },
    { key: 'logistics', label: '物流', lensSnippet: '批次、路线' },
    { key: 'driver', label: '司机', lensSnippet: '仅查看完成指定运输任务' },
    { key: 'storage', label: '筒仓 / 仓储', lensSnippet: '批次接收' },
    { key: 'laboratory', label: '实验室', lensSnippet: '样品、方法' },
    { key: 'surveyor', label: '检验机构', lensSnippet: '可用于独立核验' },
    { key: 'bank', label: '银行 / 金融', lensSnippet: '金融动作的依据' },
    { key: 'employee', label: '平台员工', lensSnippet: '异常原因' },
  ],
};

const visualViews = [
  { locale: 'ru' as const, width: 320, height: 800 },
  { locale: 'ru' as const, width: 390, height: 844 },
  { locale: 'ru' as const, width: 1280, height: 900 },
  { locale: 'en' as const, width: 390, height: 844 },
  { locale: 'zh' as const, width: 390, height: 844 },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

async function openRoleWorkspace(page: Page, locale: Locale) {
  const response = await page.goto(`/platform-v7?lang=${locale}`, { waitUntil: 'load' });
  expect(response?.ok()).toBe(true);
  const copy = localeCopy[locale];
  const workspace = page.getByRole('region', { name: copy.preview });
  await workspace.scrollIntoViewIfNeeded();
  await expect(workspace).toBeVisible();
  const tabs = page.getByRole('tablist', { name: copy.rolesLabel });
  await expect(tabs.getByRole('tab')).toHaveCount(9);
  return { copy, workspace, tabs };
}

test.describe('Phase 5 role-by-role human acceptance evidence', () => {
  for (const view of visualViews) {
    test(`${view.locale} ${view.width}px captures all nine role workspaces`, async ({ page }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop-chromium',
        'Human visual evidence is captured once in Chromium; cross-browser role semantics are exercised separately.',
      );
      test.setTimeout(150_000);

      await page.setViewportSize({ width: view.width, height: view.height });
      const { copy, workspace, tabs } = await openRoleWorkspace(page, view.locale);
      const registerHref = `/platform-v7/register?lang=${view.locale}`;
      await expect(page.locator('.pc-v6-header-cta')).toHaveAttribute('href', registerHref);

      for (const role of roles[view.locale]) {
        const tab = tabs.getByRole('tab', { name: role.label, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');

        const panel = page.locator('#public-role-panel');
        await expect(panel).toHaveAttribute('aria-labelledby', `public-role-tab-${role.key}`);
        await expect(panel).toContainText(role.lensSnippet);
        await expect(panel).toContainText(copy.responsibility);
        await expect(panel).toContainText(copy.next);
        await expect(panel).toContainText(copy.evidence);
        await expect(panel).toContainText(copy.money);
        await expect(workspace).toContainText(copy.authorityBoundary, { ignoreCase: true });
        await expectNoHorizontalOverflow(page);

        await workspace.screenshot({
          path: testInfo.outputPath(`phase5-role-${view.locale}-${view.width}px-${role.key}.png`),
          animations: 'disabled',
        });
      }
    });
  }

  test('all nine roles remain keyboard reachable and authority-bounded across browsers', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const { copy, workspace, tabs } = await openRoleWorkspace(page, 'ru');
    const roleTabs = tabs.getByRole('tab');

    // Buyer is the default state. Home moves to the first role, then ArrowRight
    // must traverse the complete public role set without changing authority.
    await roleTabs.nth(1).focus();
    await page.keyboard.press('Home');

    for (let index = 0; index < roles.ru.length; index += 1) {
      if (index > 0) await page.keyboard.press('ArrowRight');
      const role = roles.ru[index]!;
      const tab = roleTabs.nth(index);
      await expect(tab).toBeFocused();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(tab).toHaveText(role.label);

      const panel = page.locator('#public-role-panel');
      await expect(panel).toHaveAttribute('aria-labelledby', `public-role-tab-${role.key}`);
      await expect(panel).toContainText(role.lensSnippet);
      await expect(panel).toContainText(copy.responsibility);
      await expect(panel).toContainText(copy.next);
      await expect(panel).toContainText(copy.evidence);
      await expect(panel).toContainText(copy.money);
    }

    const roleExperience = workspace.locator('xpath=..');
    await expect(roleExperience).toContainText('публичный пример', { ignoreCase: true });
    await expect(workspace).toContainText(copy.authorityBoundary, { ignoreCase: true });
    await expect(page.locator('.pc-v6-header-cta')).toHaveAttribute('href', '/platform-v7/register?lang=ru');
    await expectNoHorizontalOverflow(page);
  });
});

import { expect, test } from '@playwright/test';

const p0Routes = [
  '/platform-v7',
  '/platform-v7/roles',
  '/platform-v7/seller',
  '/platform-v7/seller/batches/new',
  '/platform-v7/seller/lots/new',
  '/platform-v7/buyer',
  '/platform-v7/buyer/rfq/new',
  '/platform-v7/buyer/matches',
  '/platform-v7/buyer/offers',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/surveyor',
  '/platform-v7/bank',
  '/platform-v7/bank/clean',
  '/platform-v7/bank/events',
  '/platform-v7/bank/release-safety',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/disputes/DK-2024-89',
  '/platform-v7/dispute/DK-2024-89',
  '/platform-v7/deals/DL-9102/clean',
  '/platform-v7/deals/DL-9106/audit',
  '/platform-v7/deals/DL-9106/money',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/investor',
  '/platform-v7/demo',
  '/platform-v7/demo/execution-flow',
  '/platform-v7/simulator',
  '/platform-v7/trust',
  '/platform-v7/reports',
] as const;

const crawlerSeedRoutes = [
  '/platform-v7',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/deals',
  '/platform-v7/logistics',
  '/platform-v7/bank',
  '/platform-v7/control-tower',
] as const;

const mobileSmokeRoutes = [
  '/platform-v7',
  '/platform-v7/deals',
  '/platform-v7/deals/DL-9106/audit',
  '/platform-v7/deals/DL-9106/money',
  '/platform-v7/seller',
  '/platform-v7/seller/batches/new',
  '/platform-v7/seller/lots/new',
  '/platform-v7/buyer',
  '/platform-v7/buyer/rfq/new',
  '/platform-v7/buyer/matches',
  '/platform-v7/buyer/offers',
  '/platform-v7/logistics',
  '/platform-v7/driver',
  '/platform-v7/bank',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/surveyor',
  '/platform-v7/documents',
] as const;

const visibleExecutionRoutes = [
  { route: '/platform-v7', text: 'Центр исполнения сделки' },
  { route: '/platform-v7/deals', text: 'Сделки: деньги, документы, рейс и спор в одном контуре' },
  { route: '/platform-v7/logistics', text: 'Рейс, водитель, маршрут и инциденты связаны с деньгами' },
  { route: '/platform-v7/driver', text: 'Водитель фиксирует события рейса без доступа к деньгам и лишним ролям' },
  { route: '/platform-v7/bank', text: 'Деньги выпускаются только после доказанных условий' },
  { route: '/platform-v7/buyer', text: 'Ставка должна сразу вести к сделке, резерву денег и логистике' },
  { route: '/platform-v7/seller', text: 'Лот должен приводить к сделке, документам и получению денег' },
  { route: '/platform-v7/elevator', text: 'Вес и качество должны сразу влиять на документы и деньги' },
  { route: '/platform-v7/lab', text: 'Качество должно сразу показывать допуск, удержание и риск спора' },
  { route: '/platform-v7/surveyor', text: 'Сюрвейер фиксирует расхождения как доказательства для спора и выплаты' },
  { route: '/platform-v7/documents', text: 'Неполный пакет документов должен сразу останавливать деньги' },
] as const;

const forbiddenVisibleCopy = [
  'Controlled pilot',
  'Simulation-grade',
  'evidence-first',
  'domain-core',
  'marketplace',
  'Action handoff',
  'requestReserve',
  'fully live',
  'fully integrated',
  'production-ready',
  'Release review',
  'sandbox',
  'mock',
  'debug',
  'test user',
  'legacy',
  'runtime',
] as const;

test.describe('platform-v7 route audit baseline', () => {
  for (const route of p0Routes) {
    test(`${route} returns an application page without crash copy`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${route} should return 2xx`).toBeTruthy();
      await expect(page.locator('body'), `${route} should render body`).toBeVisible();
      await expect(page.locator('text=/404|500|Application error|Unhandled Runtime Error/i'), `${route} should not render crash or 404 copy`).toHaveCount(0);

      for (const term of forbiddenVisibleCopy) {
        await expect(page.getByText(term, { exact: false }), `${route} should not show ${term}`).toHaveCount(0);
      }
    });
  }

  test('recursive platform-v7 link crawler catches hidden internal 404s', async ({ page }) => {
    const discovered = new Set<string>(crawlerSeedRoutes);
    const visited = new Set<string>();
    const queue: Array<{ route: string; depth: number }> = crawlerSeedRoutes.map((route) => ({ route, depth: 0 }));
    const maxDepth = 2;
    const maxRoutes = 85;

    while (queue.length > 0 && visited.size < maxRoutes) {
      const current = queue.shift();
      if (!current || visited.has(current.route)) continue;

      visited.add(current.route);
      const response = await page.goto(current.route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${current.route} should return 2xx during crawl`).toBeTruthy();
      await expect(page.locator('text=/404|500|Application error|Unhandled Runtime Error/i'), `${current.route} should not render crash or 404 copy during crawl`).toHaveCount(0);

      if (current.depth >= maxDepth) continue;

      const links = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map((anchor) => anchor.href));
      for (const href of links) {
        const route = normalizePlatformRoute(href);
        if (!route || discovered.has(route) || visited.has(route)) continue;
        discovered.add(route);
        queue.push({ route, depth: current.depth + 1 });
        if (discovered.size >= maxRoutes) break;
      }
    }

    expect(visited.size, 'crawler should find more than the static seed list').toBeGreaterThan(crawlerSeedRoutes.length);
  });

  test('workflow action state persists across seller, deal and buyer surfaces', async ({ page }) => {
    await page.goto('/platform-v7/seller', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.localStorage.removeItem('pc-platform-v7-workflow-state-v2'));
    await page.reload({ waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /Опубликовать лот/ }).click();
    await expect(page.getByText('Лот опубликован внутри управляемого контура. Контакты не раскрыты.')).toBeVisible();

    await page.goto('/platform-v7/deals/DL-9106/audit', { waitUntil: 'networkidle' });
    await expect(page.getByText('лот опубликован как управляемый рыночный лот')).toBeVisible();
    await expect(page.getByText('Лот опубликован', { exact: true })).toBeVisible();

    await page.goto('/platform-v7/buyer', { waitUntil: 'networkidle' });
    await expect(page.getByText('лот опубликован как управляемый рыночный лот')).toBeVisible();
  });

  test('clean routes render stable Russian pilot copy', async ({ page }) => {
    await page.goto('/platform-v7/deals/DL-9102/clean', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Карточка сделки' })).toBeVisible();
    await expect(page.getByText('Стабильная пилотная карточка исполнения сделки.')).toBeVisible();

    await page.goto('/platform-v7/bank/clean', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Деньги по сделкам' })).toBeVisible();
    await expect(page.getByText('Стабильная пилотная страница контроля денег по сделке.')).toBeVisible();
  });

  test('key routes render visible execution entry copy', async ({ page }) => {
    for (const item of visibleExecutionRoutes) {
      await page.goto(item.route, { waitUntil: 'networkidle' });
      await expect(page.getByText(item.text, { exact: false }), `${item.route} should show visible execution entry`).toBeVisible();
    }
  });

  test('seller and buyer actions mutate visible state and audit journal', async ({ page }) => {
    await page.goto('/platform-v7/seller', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.localStorage.removeItem('pc-platform-v7-workflow-state-v2'));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('workflow-action-panel-seller')).toBeVisible();
    await page.getByRole('button', { name: /Опубликовать лот/ }).click();
    await expect(page.getByText('Лот опубликован внутри управляемого контура. Контакты не раскрыты.')).toBeVisible();
    await expect(page.getByText('Лот опубликован', { exact: true })).toBeVisible();

    await page.goto('/platform-v7/buyer', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('workflow-action-panel-buyer')).toBeVisible();
    await page.getByRole('button', { name: /Подтвердить резерв денег/ }).click();
    await expect(page.getByText('Резерв подтверждён. Выпуск денег продавцу остаётся закрыт до обязательных условий.')).toBeVisible();
    await expect(page.getByText('Резерв денег подтверждён', { exact: true })).toBeVisible();
  });

  test('key routes render on narrow mobile width without page-level overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of mobileSmokeRoutes) {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return 2xx on mobile`).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('text=/404|500|Application error|Unhandled Runtime Error/i')).toHaveCount(0);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} should not create page-level horizontal overflow on mobile`).toBeLessThanOrEqual(2);
    }
  });
});

function normalizePlatformRoute(href: string): string | null {
  try {
    const url = new URL(href);
    if (!url.pathname.startsWith('/platform-v7')) return null;
    if (url.pathname.startsWith('/platform-v7r')) return null;
    if (url.pathname.includes('/api/')) return null;
    if (url.pathname.includes('/_next/')) return null;

    return url.pathname.replace(/\/$/, '') || '/platform-v7';
  } catch {
    return null;
  }
}

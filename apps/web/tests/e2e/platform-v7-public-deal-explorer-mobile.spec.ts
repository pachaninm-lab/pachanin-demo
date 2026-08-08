import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => Math.max(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    document.body.scrollWidth - document.body.clientWidth,
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

for (const width of [320, 390, 430]) {
  test(`Deal journey is intent-first and self-explanatory at ${width}px`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await page.setViewportSize({ width, height: 860 });
    const response = await page.goto('/platform-v7/how-it-works?lang=ru&entry=deal', { waitUntil: 'load' });
    expect(response?.ok()).toBe(true);

    const intent = page.locator('.pc-ppe-v5-intent');
    const intentOptions = intent.locator('.pc-ppe-v5-intent-option');
    await expect(intent).toBeVisible();
    await expect(intent.getByRole('heading', { name: 'Что вы хотите сделать?' })).toBeVisible();
    await expect(intentOptions).toHaveCount(6);
    await expect(page.locator('[data-testid="public-deal-quick-stage"]')).toHaveCount(0);

    const help = page.getByRole('button', { name: 'Открыть способы помощи' });
    await expect(help).toBeVisible();
    const helpBox = await help.boundingBox();
    expect(helpBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(helpBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('button', { name: 'Открыть ИИ-помощника по платформе' })).toHaveCount(0);
    await help.click();
    await expect(help).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Открыть ИИ-помощника по платформе' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Открыть поддержку' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Позвонить по номеру/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toHaveAttribute('aria-expanded', 'false');
    await expectNoHorizontalOverflow(page);

    await intent.getByRole('button', { name: /Продать продукцию/ }).click();
    await expect(page).toHaveURL(/intent=sell/);
    await expect(page).toHaveURL(/perspective=seller/);
    await expect(page).toHaveURL(/stage=terms/);

    const whatIf = page.locator('[data-testid="public-deal-what-if"]');
    await expect(whatIf).toBeVisible();
    await expect(whatIf.getByText('Что будет, если…')).toBeVisible();
    await expect(whatIf.getByText(/сценарий интерфейса, а не прогноз/)).toBeVisible();

    const scenarios = whatIf.locator('.pc-ppe-v5-what-if-grid');
    await expect(scenarios.getByRole('button')).toHaveCount(3);
    const scenarioBoxes = await scenarios.getByRole('button').evaluateAll((nodes) => nodes.map((node) => {
      const box = (node as HTMLElement).getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));
    expect(scenarioBoxes.every((box) => box.width >= 44 && box.height >= 44)).toBe(true);

    const partial = scenarios.getByRole('button', { name: 'Приняли не весь объём' });
    await partial.click();
    await expect(page).toHaveURL(/scenario=partial/);
    await expect(partial).toHaveAttribute('aria-pressed', 'true');
    await expect(whatIf.getByText(/фактически принятый объём/)).toBeVisible();

    const context = page.locator('[data-testid="public-deal-journey-context"]');
    const stage = page.locator('[data-testid="public-deal-quick-stage"]');
    await expect(context).toBeVisible();
    await expect(stage).toBeVisible();
    await expect(stage.getByText('Что произошло')).toBeVisible();
    await expect(stage.getByText('Что требуется от вас')).toBeVisible();
    await expect(stage.getByText('Что делает платформа')).toBeVisible();
    await expect(stage.getByText('Деньги')).toBeVisible();
    await expect(stage.getByText('Документы')).toBeVisible();
    await expect(stage.getByText('Риск')).toBeVisible();
    await expect(stage.locator('.pc-ppe-v5-tai-button')).toHaveCount(3);

    const hierarchy = await page.evaluate(() => {
      const scenario = document.querySelector('.pc-ppe-v5-scenario')?.getBoundingClientRect();
      const context = document.querySelector('[data-testid="public-deal-journey-context"]')?.getBoundingClientRect();
      const stage = document.querySelector('[data-testid="public-deal-quick-stage"]')?.getBoundingClientRect();
      return {
        scenarioBeforeContext: Boolean(scenario && context && scenario.bottom <= context.top + 1),
        contextBeforeStage: Boolean(context && stage && context.bottom <= stage.top + 1),
      };
    });
    expect(hierarchy.scenarioBeforeContext).toBe(true);
    expect(hierarchy.contextBeforeStage).toBe(true);

    await stage.getByRole('button', { name: 'Следующий этап' }).click();
    await expect(page).toHaveURL(/stage=admission/);
    await expect(stage.getByRole('heading', { name: /Допуск|Admission|准入/ })).toBeVisible();

    await page.getByRole('button', { name: 'Изучить подробно' }).click();
    await expect(page).toHaveURL(/view=detail/);
    await expect(page.locator('[data-testid="public-deal-detailed-mode"]')).toBeVisible();
    await expect(page.locator('.pc-ppe-explorer')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Вернуться к быстрому просмотру' }).click();
    await expect(page.locator('[data-testid="public-deal-quick-stage"]')).toBeVisible();

    const firstTaiPrompt = page.locator('.pc-ppe-v5-tai-button').first();
    await firstTaiPrompt.click();
    await expect(page.locator('#pc-public-assistant-panel')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.locator('.pc-ppe-v5-stage-rail button').nth(9).click();
    await expect(page).toHaveURL(/stage=closure/);
    await expect(page.getByRole('heading', { name: 'Сделка завершена' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Подключить организацию/ })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    expect(runtimeErrors).toEqual([]);
  });
}

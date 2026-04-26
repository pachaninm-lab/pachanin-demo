import { expect, test, type Page } from '@playwright/test';

async function expectActionFeedback(page: Page, buttonName: string | RegExp, successLabel: string | RegExp) {
  await page.getByRole('button', { name: buttonName }).first().click();
  await expect(page.getByRole('button', { name: successLabel }).first()).toBeVisible();
  await expect(page.getByText('Успешно').first()).toBeVisible();
}

test.describe('platform-v7 action feedback regressions', () => {
  test('operator can remove blocker and see action log feedback', async ({ page }) => {
    const response = await page.goto('/platform-v7/control-tower', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.getByTestId('control-tower-operator-panel')).toBeVisible();
    await expectActionFeedback(page, 'Снять препятствие', 'Препятствие снято');
    await expect(page.getByText('Журнал действий оператора')).toBeVisible();
  });

  test('bank factoring action writes visible success feedback', async ({ page }) => {
    const response = await page.goto('/platform-v7/bank/factoring', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.getByText('Заявки на факторинг')).toBeVisible();
    await expectActionFeedback(page, /Завершить скоринг|Принять пакет|Выплатить аванс/, 'Готово');
    await expect(page.getByText('Журнал действий факторинга')).toBeVisible();
  });

  test('lab runtime actions write visible success feedback', async ({ page }) => {
    const response = await page.goto('/platform-v7/lab', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.getByText('Лаборатория')).toBeVisible();
    await expectActionFeedback(page, 'Начать анализ', 'Анализ начат');
    await expect(page.getByText('Журнал лабораторных действий')).toBeVisible();
  });

  test('elevator runtime actions write visible success feedback', async ({ page }) => {
    const response = await page.goto('/platform-v7/elevator', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.getByText('Приёмка и весовая')).toBeVisible();
    await expectActionFeedback(page, 'Допустить', 'Допущено');
    await expect(page.getByText('Журнал действий приёмки')).toBeVisible();
  });

  test('dispute runtime action writes visible success feedback', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('pc-buyer-runtime-v2', JSON.stringify({
        state: {
          localRfqs: [],
          shortlistedSourceIds: [],
          draftDeals: [{
            id: 'DRAFT-3901',
            sourceId: 'RFQ-E2E-1',
            sourceType: 'LOCAL_RFQ',
            grain: 'Пшеница 4 класс',
            volume: 320,
            region: 'Тамбовская область',
            price: 12500,
            quality: 'ГОСТ, протеин 12.5%',
            payment: 'Резерв и выпуск после приёмки',
            sellerName: 'Контрагент не выбран',
            buyerName: 'Текущий покупатель',
            status: 'dispute_open',
            docsState: 'complete',
            reserveState: 'approved',
            paymentState: 'blocked',
            disputeState: 'open',
            blockers: ['dispute'],
            nextStep: 'Закрыть спор и заново пройти денежный шаг.',
            nextOwner: 'Арбитр',
            riskFlags: [],
            evidenceUploaded: 2,
            createdAt: '2026-04-26T10:00:00.000Z',
            events: [{ ts: '2026-04-26T10:00:00.000Z', actor: 'Система', action: 'E2E draft dispute' }],
          }],
        },
        version: 0,
      }));
    });

    const response = await page.goto('/platform-v7/disputes', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();

    await expect(page.getByText('Draft-сделки со спором')).toBeVisible();
    await expectActionFeedback(page, 'Закрыть спор', 'Спор закрыт');
    await expect(page.getByText('Журнал действий по спорам')).toBeVisible();
  });
});

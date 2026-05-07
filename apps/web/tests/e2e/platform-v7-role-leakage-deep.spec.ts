import { expect, test } from '@playwright/test';

const ROLE_CASES = [
  {
    route: '/platform-v7/driver/field',
    role: 'driver',
    hiddenText: ['инвестор', 'ставк', 'резерв', 'выпуск денег', 'центр управления', 'control tower', 'банк', 'банков', 'операторская очередь'],
    visibleText: ['Рейс водителя', 'Только текущий рейс'],
  },
  {
    route: '/platform-v7/logistics',
    role: 'logistics',
    hiddenText: ['цена зерна', 'банковский резерв', 'чужие ставки', 'подтвердить выпуск денег', 'инвесторский режим'],
    visibleText: ['Логистика'],
  },
  {
    route: '/platform-v7/buyer',
    role: 'buyer',
    hiddenText: ['operator controls', 'scoring notes', 'чужие scoring', 'операторская очередь', 'внутренняя заметка'],
    visibleText: ['Покупатель'],
  },
  {
    route: '/platform-v7/seller',
    role: 'seller',
    hiddenText: ['scoring notes', 'чужие scoring', 'операторская очередь', 'внутренняя заметка'],
    visibleText: ['Продавец'],
  },
  {
    route: '/platform-v7/bank',
    role: 'bank',
    hiddenText: ['создать лот', 'начать погрузку', 'я прибыл', 'сделать ставку', 'изменить ставку', 'продать зерно за 5 минут', 'операторская очередь'],
    visibleText: ['Кабинет банка', 'Деньги выпускаются только после условий сделки'],
  },
  {
    route: '/platform-v7/bank/release-safety',
    role: 'bank-release-safety',
    hiddenText: ['платформа сама выпускает деньги', 'гарантирует оплату', 'прямой выпуск', 'выпустить сейчас'],
    visibleText: ['Проверка безопасности выпуска денег', 'Закрыть условия'],
  },
  {
    route: '/platform-v7/operator',
    role: 'operator',
    hiddenText: ['я прибыл', 'начать погрузку', 'сделать фото', 'инвесторский режим', 'купить зерно как покупатель'],
    visibleText: ['Оператор'],
  },
  {
    route: '/platform-v7/investor',
    role: 'investor',
    hiddenText: ['я прибыл', 'начать погрузку', 'подтвердить выпуск денег', 'операторская очередь', 'выпустить сейчас', 'создать лот'],
    visibleText: ['Инвесторский режим', 'controlled-pilot'],
  },
] as const;

test.describe('platform-v7 role-specific visibility gate', () => {
  for (const item of ROLE_CASES) {
    test(`${item.role} route hides unrelated workspace content`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(item.route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${item.route} should return 200`).toBeTruthy();
      await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);

      const text = (await page.locator('body').innerText()).toLowerCase();
      for (const itemText of item.hiddenText) {
        expect(text, `${item.route} should hide ${itemText}`).not.toContain(itemText.toLowerCase());
      }
      for (const itemText of item.visibleText) {
        expect(text, `${item.route} should show ${itemText}`).toContain(itemText.toLowerCase());
      }
    });
  }
});

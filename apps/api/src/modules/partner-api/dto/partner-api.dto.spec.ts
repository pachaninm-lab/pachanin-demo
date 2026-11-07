import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { GenerateApiKeyDto, SubscribeWebhookDto, TestWebhookDto } from './partner-api.dto';

/**
 * V2.2.1 / V2.2.2 — партнёрское API.
 *
 * Три обработчика объявляли тело инлайн-типом. Инлайн-тип стирается до
 * `Object`, ValidationPipe его не видит, и на этих маршрутах не проверялось
 * ничего. Механизм измерен отдельно, в
 * common/validation/request-body-validation-mechanism.spec.ts; здесь
 * проверяется, что конкретно эти три тела теперь проверяются.
 *
 * Пайп берётся ровно той же конфигурации, что в main.ts. Иначе набор доказывал
 * бы поведение какого-то другого пайпа.
 */

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });

const asBody = <T>(metatype: new () => T) => (value: unknown) =>
  pipe.transform(value, { type: 'body', metatype } as never);

const apiKey = asBody(GenerateApiKeyDto);
const webhook = asBody(SubscribeWebhookDto);
const testHook = asBody(TestWebhookDto);

describe('GenerateApiKeyDto — то, что раньше принималось или падало пятисоткой', () => {
  it('rateLimit сверху ограничен: вызывающий больше не снимает себе лимит', async () => {
    // Замерено до правки: `rateLimit: 999999999` принималось и сохранялось.
    await expect(apiKey({ name: 'k', scopes: [], rateLimit: 999_999_999 })).rejects.toThrow();
  });

  it('rateLimit снизу ограничен', async () => {
    await expect(apiKey({ name: 'k', scopes: [], rateLimit: 0 })).rejects.toThrow();
  });

  it('отрицательный expiresInDays отклоняется, а не выпускает просроченный ключ', async () => {
    // Замерено до правки: `expiresInDays: -30` принималось, и ключ выдавался с
    // датой окончания в прошлом.
    await expect(apiKey({ name: 'k', scopes: [], expiresInDays: -30 })).rejects.toThrow();
  });

  it('огромный expiresInDays отклоняется, а не превращается в RangeError', async () => {
    // Замерено до правки: `new Date(...).toISOString()` бросал
    // `RangeError: Invalid time value`, и клиент получал 500 вместо 400.
    await expect(apiKey({ name: 'k', scopes: [], expiresInDays: 1e12 })).rejects.toThrow();
  });

  it('scopes строкой отклоняется, а не роняет сервис', async () => {
    // Замерено до правки: `params.scopes.filter is not a function`, то есть 500.
    await expect(apiKey({ name: 'k', scopes: 'deals:read' })).rejects.toThrow();
  });

  it('неизвестный scope отклоняется на границе, а не в сервисе', async () => {
    await expect(apiKey({ name: 'k', scopes: ['deals:read', 'billing:admin'] })).rejects.toThrow();
  });

  it('имя ограничено по длине', async () => {
    // Замерено до правки: имя длиной 100000 принималось и сохранялось.
    await expect(apiKey({ name: 'x'.repeat(100_000), scopes: [] })).rejects.toThrow();
  });

  it('имя обязательно', async () => {
    await expect(apiKey({ scopes: [] })).rejects.toThrow();
  });

  it('законный запрос по-прежнему проходит', async () => {
    // Обратная сторона: если бы проходило только пустое тело, «всё закрыто»
    // прошло бы как успех.
    const result = await apiKey({
      name: 'Интеграция 1С',
      scopes: ['deals:read', 'shipments:read'],
      rateLimit: 500,
      expiresInDays: 90,
    });
    expect(result).toEqual({
      name: 'Интеграция 1С',
      scopes: ['deals:read', 'shipments:read'],
      rateLimit: 500,
      expiresInDays: 90,
    });
  });

  it('необязательные поля можно не присылать', async () => {
    const result = await apiKey({ name: 'k', scopes: ['deals:read'] });
    expect(result).toEqual({ name: 'k', scopes: ['deals:read'] });
  });

  it('лишнее поле срезается, а не доходит до сервиса', async () => {
    const result = await apiKey({ name: 'k', scopes: [], smuggled: 'x' });
    expect(result).not.toHaveProperty('smuggled');
  });
});

describe('SubscribeWebhookDto — подписка на события', () => {
  it('events строкой отклоняется', async () => {
    // Это главный из трёх дефектов. `getActiveSubscriptionsForEvent` фильтрует
    // по `w.events.includes('*')`. У массива это проверка элемента, у строки —
    // проверка ПОДСТРОКИ. Замерено до правки: строка проходила и подписка
    // срабатывала, то есть строка со звёздочкой подписывала вебхук на все
    // события платформы.
    await expect(webhook({ url: 'https://example.test/hook', events: 'deal.created' })).rejects.toThrow();
  });

  it('строка со звёздочкой больше не проходит как подписка на всё', async () => {
    await expect(webhook({ url: 'https://example.test/hook', events: 'всё*' })).rejects.toThrow();
  });

  it('элемент events должен быть строкой', async () => {
    await expect(webhook({ url: 'https://example.test/hook', events: [{ any: true }] })).rejects.toThrow();
  });

  it('url обязателен и ограничен по длине', async () => {
    await expect(webhook({ events: [] })).rejects.toThrow();
    await expect(webhook({ url: `https://x.test/${'a'.repeat(3000)}`, events: [] })).rejects.toThrow();
  });

  it('законная подписка проходит, включая явную звёздочку отдельным элементом', async () => {
    // Обратная сторона: подписка на все события остаётся возможной — но только
    // как осознанный элемент массива, а не как случайная подстрока.
    const result = await webhook({ url: 'https://example.test/hook', events: ['*'] });
    expect(result).toEqual({ url: 'https://example.test/hook', events: ['*'] });
  });
});

describe('TestWebhookDto — пробная доставка', () => {
  it('testData строкой отклоняется', async () => {
    await expect(testHook({ testData: 'не объект' })).rejects.toThrow();
  });

  it('eventType ограничен по длине', async () => {
    await expect(testHook({ eventType: 'e'.repeat(500) })).rejects.toThrow();
  });

  it('пустое тело допустимо: оба поля необязательны', async () => {
    // Обратная сторона: оба поля имеют значения по умолчанию в обработчике,
    // сделать их обязательными значило бы сломать работавших вызывающих.
    await expect(testHook({})).resolves.toEqual({});
  });

  it('законная проба проходит', async () => {
    const result = await testHook({ eventType: 'deal.created', testData: { dealId: 'd-1' } });
    expect(result).toEqual({ eventType: 'deal.created', testData: { dealId: 'd-1' } });
  });
});

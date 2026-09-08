import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LogMaskingMiddleware } from './log-masking.middleware';

/**
 * Кодируется ли КАЖДОЕ поле строки доступа, а не одно названное в записи ASVS
 * (V16.4.1).
 *
 * Это отдельный набор от log-encode.spec.ts: там проверяется сам кодировщик,
 * здесь — что он применён на всех подстановках. Контроль, покрывающий пять
 * полей из шести, — это отсутствующий контроль на шестом.
 */

const CSI = '\u009b';

function runMiddleware(
  overrides: Partial<Request> = {},
  responseOverrides: Record<string, unknown> = {},
): string {
  const logged: string[] = [];
  jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
    logged.push(String(message));
  });

  const listeners: Array<() => void> = [];
  const req = {
    method: 'GET',
    path: '/api/deals',
    ip: '203.0.113.7',
    headers: { 'user-agent': 'Mozilla/5.0' },
    ...overrides,
  } as unknown as Request;
  const res = {
    statusCode: 200,
    ...responseOverrides,
    on: (event: string, listener: () => void) => {
      if (event === 'finish') listeners.push(listener);
    },
  } as unknown as Response;

  new LogMaskingMiddleware().use(req, res, () => undefined);
  for (const listener of listeners) listener();

  jest.restoreAllMocks();
  return logged.join('\n');
}

describe('LogMaskingMiddleware — кодирование применено на каждой подстановке', () => {
  it.each([
    ['user-agent', () => ({ headers: { 'user-agent': `Mozilla${CSI}FORGED` } })],
    ['ip (при trust proxy выводится из X-Forwarded-For)', () => ({ ip: `::1${CSI}FORGED` })],
    ['path', () => ({ path: `/api/deals${CSI}FORGED` })],
    ['method', () => ({ method: `GET${CSI}FORGED` })],
    ['user id из сессии', () => ({ user: { id: `u-1${CSI}FORGED` } })],
  ])('%s не может внести управляющий символ в строку', (_name, build) => {
    const line = runMiddleware(build() as Partial<Request>);

    expect(line).not.toContain(CSI);
    expect(line).toContain('\\x9b');
    // Содержимое остаётся видимым: подделку надо расследовать, а не потерять.
    expect(line).toContain('FORGED');
  });

  it('маскирование IPv4 не считается защитой от подстановки', () => {
    // Замерено, а не предположено: у `203.0.113.7<CSI>FORGED` ровно четыре
    // части через точку, поэтому maskIp обрезает до первых двух октетов и
    // полезная нагрузка исчезает сама. Это побочный эффект другой функции, а
    // не контроль: у `::1<CSI>FORGED` частей одна, maskIp возвращает значение
    // как есть, и без кодирования символ дошёл бы до строки. Поэтому граница
    // здесь — кодировщик, а не маска.
    expect(runMiddleware({ ip: `203.0.113.7${CSI}FORGED` } as Partial<Request>))
      .toContain('ip=203.0.*.*');
    expect(runMiddleware({ ip: `::1${CSI}FORGED` } as Partial<Request>))
      .toContain('ip=::1\\x9bFORGED');
  });

  it('обычный запрос читается по-прежнему', () => {
    // Обратная сторона: если бы строка стала нечитаемой, «всё экранировано»
    // прошло бы как успех.
    const line = runMiddleware();

    expect(line).toContain('GET /api/deals 200');
    expect(line).toContain('ip=203.0.*.*');
    expect(line).toContain('user=anon');
    expect(line).toContain('ua="Mozilla/5.0"');
    expect(line).not.toContain('\\x');
  });

  it('статус подставляется как число и текста принести не может', () => {
    // Подделывается именно res.statusCode. Первая версия этого теста
    // подставляла его в ЗАПРОС и потому не проверяла ничего: строка собиралась
    // из настоящего res.statusCode = 200 и проходила бы при любом коде.
    // Поймано мутацией, а не чтением.
    const line = runMiddleware({}, { statusCode: '200 FORGED' });

    expect(line).not.toContain('200 FORGED');
    expect(line).not.toContain('FORGED');
    // Number('200 FORGED') это NaN: подделка обязана стать явно нечисловой,
    // а не тихо подставиться как 200.
    expect(line).toContain('NaN');
  });

  it('нормальный статус подставляется как есть', () => {
    // Обратная сторона: приведение не должно ломать обычную строку.
    expect(runMiddleware({}, { statusCode: 404 })).toContain('/api/deals 404 ');
  });

  it('исключённые пути по-прежнему не логируются вовсе', () => {
    expect(runMiddleware({ path: '/health' } as Partial<Request>)).toBe('');
  });
});

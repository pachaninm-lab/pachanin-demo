import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { POST as CONFIRM } from '@/app/api/settlement-engine/deal/[dealId]/confirm/route';
import { POST as RELEASE } from '@/app/api/settlement-engine/deal/[dealId]/release/route';

/**
 * V3.5.1 на двух денежных прокси расчётного движка.
 *
 * Обе ручки брали учётку из ambient-куки: `runtimeAuthHeaders()` читает
 * `pc_access_token` через `cookies()` и превращает его в
 * `Authorization: Bearer`. Проверено чтением хелпера, а не выведено из имени.
 * Поэтому чужая страница могла бы заставить прокси потратить учётку
 * посетителя, и бэкенд увидел бы совершенно годный токен.
 *
 * Что смягчало это ДО правки — фиксирую, потому что иначе тяжесть завышена:
 *   - `SameSite=Lax` на `pc_access_token` блокирует классический межсайтовый
 *     POST;
 *   - `SettlementFinancialMfaGuard` на бэкенде требует MFA не старше 15 минут,
 *     причём из серверной сессии, а не из заголовка клиента.
 * Оба слоя настоящие и остаются на месте. Ни один из них не является
 * anti-forgery токеном, которого требует V3.5.1, и второй сужает окно, а не
 * закрывает его.
 *
 * V3.5.1 здесь НЕ заявляется и остаётся FAIL: закрывается один класс из
 * четырнадцати незащищённых маршрутов, а не требование.
 */

const CASES = [
  ['release', RELEASE, 'http://localhost/api/settlement-engine/deal/DEAL-1/release'],
  ['confirm', CONFIRM, 'http://localhost/api/settlement-engine/deal/DEAL-1/confirm'],
] as const;

function post(
  handler: (request: Request, props: { params: Promise<{ dealId: string }> }) => Promise<Response>,
  url: string,
  headers: Record<string, string>,
  cookies: Record<string, string> = {},
) {
  const request = new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  return handler(request as unknown as Request, { params: Promise.resolve({ dealId: 'DEAL-1' }) });
}

describe.each(CASES)('%s — денежная ручка отказывает подделке', (_name, handler, url) => {
  it('отказывает, когда заголовка нет вовсе', async () => {
    const response = await post(handler, url, {});
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('CSRF_REQUIRED');
  });

  it('отказывает, когда есть кука, но нет заголовка', async () => {
    const response = await post(handler, url, {}, { pc_csrf_token: 'token-value' });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('CSRF_REQUIRED');
  });

  it('отказывает, когда заголовок не совпадает с кукой', async () => {
    const response = await post(handler, url, { 'x-csrf-token': 'other' }, { pc_csrf_token: 'token-value' });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('CSRF_REQUIRED');
    // Отсутствие и несовпадение — разные отказы, и причина это различает.
    expect(body.reason).toBe('csrf_mismatch');
  });

  it('совпадающий токен гейт проходит', async () => {
    // Дальше маршрут упрётся в недоступный бэкенд, и это ожидаемо: здесь
    // проверяется ровно то, что гейт пройден, а не что пересылка удалась.
    // Без этого случая «отказывать всем» прошло бы как успех.
    const response = await post(
      handler,
      url,
      { 'x-csrf-token': 'token-value' },
      { pc_csrf_token: 'token-value' },
    );
    if (response.status === 403) {
      expect((await response.json()).code).not.toBe('CSRF_REQUIRED');
    }
  });
});

describe('гейт стоит перед тратой учётки, а не после', () => {
  it.each(CASES)('%s: assertCsrf вызывается раньше runtimeAuthHeaders', (name) => {
    const source = readFileSync(
      resolve(process.cwd(), `app/api/settlement-engine/deal/[dealId]/${name}/route.ts`),
      'utf8',
    );
    // Только тело обработчика: в докстроке хелпер тоже упомянут, и поиск по
    // всему файлу нашёл бы комментарий вместо вызова.
    const handler = source.slice(source.indexOf('export async function POST'));
    const gate = handler.indexOf('assertCsrf(request)');
    const spend = handler.indexOf('await runtimeAuthHeaders(');
    expect(gate).toBeGreaterThan(-1);
    expect(spend).toBeGreaterThan(-1);
    // Порядок здесь и есть предмет: проверка после обращения к бэкенду
    // означала бы, что запрос уже отправлен от имени посетителя.
    expect(gate).toBeLessThan(spend);
  });
});

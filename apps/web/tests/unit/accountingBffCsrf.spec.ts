import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/platform-v7/accounting/[[...path]]/route';

/**
 * V3.5.1: у изменяющих операций должна быть anti-forgery защита.
 *
 * Этот BFF аутентифицируется КУКОЙ и пересылает её вверх как Bearer на
 * операции из WRITE_PATHS. Куку браузер прикладывает сам, поэтому без проверки
 * чужая страница могла бы инициировать изменение от имени вошедшего.
 *
 * Замерено до правки: из 59 маршрутов с небезопасными методами 37 вызывали
 * assertCsrf, а 22 — нет, и этот был среди них. Запись ASVS называет его
 * поимённо.
 *
 * `SameSite=Lax` на куке классический межсайтовый POST-формы блокирует, и это
 * настоящее смягчение — но неявное и не то, о чём просит требование. Здесь
 * стоит тот же double-submit, что и у остальных 37.
 */

const ROUTE = 'http://localhost/api/platform-v7/accounting/tasks/T-1/transition';
const CONTEXT = { params: Promise.resolve({ path: ['tasks', 'T-1', 'transition'] }) };

function post(headers: Record<string, string>, cookies: Record<string, string> = {}) {
  const request = new NextRequest(ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ to: 'IN_PROGRESS', expectedVersion: 1 }),
  });
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  return POST(request, CONTEXT as never);
}

describe('accounting BFF refuses a forged write', () => {
  it('отказывает, когда заголовка нет вовсе', async () => {
    const response = await post({});
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('CSRF_REQUIRED');
  });

  it('отказывает, когда есть кука, но нет заголовка', async () => {
    const response = await post({}, { pc_csrf_token: 'token-value' });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('CSRF_REQUIRED');
  });

  it('отказывает, когда заголовок не совпадает с кукой', async () => {
    const response = await post({ 'x-csrf-token': 'other' }, { pc_csrf_token: 'token-value' });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('CSRF_REQUIRED');
    // Причина различается: отсутствие и несовпадение - разные отказы.
    expect(body.reason).toBe('csrf_mismatch');
  });

  it('проходит проверку, когда заголовок совпадает с кукой', async () => {
    // Дальше маршрут упрётся в недоступный API_URL, и это ожидаемо: здесь
    // проверяется только то, что CSRF-гейт пройден, а не что пересылка удалась.
    const response = await post({ 'x-csrf-token': 'token-value' }, { pc_csrf_token: 'token-value' });
    if (response.status === 403) {
      expect((await response.json()).code).not.toBe('CSRF_REQUIRED');
    }
  });

  it('GET не затронут: чтение не требует токена', async () => {
    const route = readFileSync(
      resolve(process.cwd(), 'app/api/platform-v7/accounting/[[...path]]/route.ts'),
      'utf8',
    );
    // Проверка стоит в POST, а не в forward(), иначе она задела бы и чтение.
    const postBody = route.slice(route.indexOf('export async function POST'));
    expect(postBody).toContain('assertCsrf');
    const getBody = route.slice(
      route.indexOf('export async function GET'),
      route.indexOf('export async function POST'),
    );
    expect(getBody).not.toContain('assertCsrf');
  });
});

describe('the client that calls it sends the token', () => {
  it('иначе правка сервера сломала бы доску задач', () => {
    // Единственный POST-вызов этого BFF во всём фронтенде. Если он перестанет
    // слать заголовок, доска задач начнёт получать 403 - и упадёт здесь, а не
    // у пользователя.
    const client = readFileSync(
      resolve(process.cwd(), 'app/platform-v7/accounting/AccountingTaskBoardClient.tsx'),
      'utf8',
    );
    expect(client).toContain("'x-csrf-token': csrfToken()");
    expect(client).toContain("startsWith('pc_csrf_token=')");
  });
});

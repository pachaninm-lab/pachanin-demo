import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * V3.5.1 на последнем маршруте, действующем по ambient-куке.
 *
 * `cabinet-session` читает `pc_access_token` через `cookies()`, проверяет по
 * нему роль и ВЫПУСКАЕТ cookie-сессию кабинета `pc_v7_cabinet` на 8 часов.
 * Куку браузер прикладывает сам, поэтому без проверки чужая страница могла бы
 * заставить браузер вошедшего пользователя выпустить себе сессию кабинета.
 * Это изменение состояния, а не чтение.
 *
 * Правка не может сломать работающий вызов, и это установлено чтением, а не
 * предположением: `auth-session-response.ts` выставляет `pc_csrf_token` тем же
 * ответом, что и `pc_access_token`, поэтому любая сессия, способная пройти
 * проверку роли, куку уже несёт.
 *
 * V3.5.1 здесь НЕ заявляется и остаётся FAIL.
 */

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));

const ROUTE = 'http://localhost/api/platform-v7/cabinet-session';

function post(headers: Record<string, string>, cookies: Record<string, string> = {}) {
  const request = new NextRequest(ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ role: 'operator' }),
  });
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  return request;
}

describe('cabinet-session отказывает подделке', () => {
  it('отказывает, когда заголовка нет вовсе', async () => {
    const { POST } = await import('@/app/api/platform-v7/cabinet-session/route');
    const response = await POST(post({}) as unknown as Request);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('CSRF_REQUIRED');
  });

  it('отказывает, когда есть кука, но нет заголовка', async () => {
    const { POST } = await import('@/app/api/platform-v7/cabinet-session/route');
    const response = await POST(post({}, { pc_csrf_token: 'token-value' }) as unknown as Request);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('CSRF_REQUIRED');
  });

  it('отказывает, когда заголовок не совпадает с кукой', async () => {
    const { POST } = await import('@/app/api/platform-v7/cabinet-session/route');
    const response = await POST(
      post({ 'x-csrf-token': 'other' }, { pc_csrf_token: 'token-value' }) as unknown as Request,
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('CSRF_REQUIRED');
    expect(body.reason).toBe('csrf_mismatch');
  });

  it('совпадающий токен гейт проходит', async () => {
    // Дальше маршрут упрётся в отсутствие проверенной роли и вернёт 400/403 с
    // ДРУГИМ кодом. Здесь проверяется ровно то, что гейт пройден: без этого
    // случая «отказывать всем» засчиталось бы как исправление.
    const { POST } = await import('@/app/api/platform-v7/cabinet-session/route');
    const response = await POST(
      post({ 'x-csrf-token': 'token-value' }, { pc_csrf_token: 'token-value' }) as unknown as Request,
    );
    const body = await response.json();
    expect(body.code).not.toBe('CSRF_REQUIRED');
  });

  it('гейт стоит перед разбором тела и чтением учётки', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/platform-v7/cabinet-session/route.ts'),
      'utf8',
    );
    const handler = source.slice(source.indexOf('export async function POST'));
    const gate = handler.indexOf('assertCsrf(request)');
    const body = handler.indexOf('request.json()');
    const credential = handler.indexOf('ACCESS_TOKEN_COOKIE');
    expect(gate).toBeGreaterThan(-1);
    // Порядок и есть предмет: проверка после чтения учётки означала бы, что
    // запрос уже разобран и учётка уже прочитана от имени посетителя.
    expect(gate).toBeLessThan(body);
    expect(gate).toBeLessThan(credential);
  });
});

describe('единственный вызывающий шлёт токен', () => {
  it('иначе серверная правка молча ломала бы вход через legacy-оверлей', () => {
    const client = readFileSync(
      resolve(process.cwd(), 'components/platform-v7/LoginLegacyOverlay.tsx'),
      'utf8',
    );
    expect(client).toContain('applyCsrfHeader');
    expect(client).toContain("cabinet-session");
  });
});

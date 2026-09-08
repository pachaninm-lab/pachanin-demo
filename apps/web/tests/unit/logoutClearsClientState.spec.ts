import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { clearClientSessionState } from '@/lib/client-session-cleanup';

/**
 * V14.3.1: выход обрывал сессию, но не убирал то, что она оставила.
 *
 * Маршрут выхода в остальном аккуратен - проверяет CSRF, отзывает сессию
 * наверху, снимает куки, ставит no-store, - и именно поэтому пробел стоило
 * назвать точно: куки обработаны, клиентское хранилище нет. Во всём фронтенде
 * не было ни одного ответа с `Clear-Site-Data`, а история ассистента, списки
 * документов и чек-листы по сделкам и профиль поддержки переживали выход.
 *
 * Механизмов теперь два, и второй существует потому, что у первого есть
 * граница: `Clear-Site-Data` действует только в защищённом контексте и только
 * если ответ вообще пришёл.
 */

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const ROUTE_SOURCE = resolve(process.cwd(), 'app/api/auth/logout/route.ts');

function post(headers: Record<string, string>, cookies: Record<string, string> = {}) {
  const request = new NextRequest('http://localhost/api/auth/logout', { method: 'POST', headers });
  for (const [name, value] of Object.entries(cookies)) request.cookies.set(name, value);
  return request;
}

describe('маршрут выхода просит браузер очистить хранилище', () => {
  it('успешный выход отдаёт Clear-Site-Data со storage', async () => {
    const { POST } = await import('@/app/api/auth/logout/route');
    const response = await POST(
      post({ 'x-csrf-token': 'tok' }, { pc_csrf_token: 'tok' }) as unknown as Request,
    );
    const header = response.headers.get('clear-site-data') ?? '';
    expect(header).toContain('"storage"');
    expect(header).toContain('"cache"');
  });

  it('cookies в заголовок НЕ включены — их снимает точечная очистка', async () => {
    // Иначе браузер снял бы куки по всему registrable domain и заодно выкинул
    // бы сессию control-host, которую этот выход трогать не должен.
    const { POST } = await import('@/app/api/auth/logout/route');
    const response = await POST(
      post({ 'x-csrf-token': 'tok' }, { pc_csrf_token: 'tok' }) as unknown as Request,
    );
    expect(response.headers.get('clear-site-data')).not.toContain('"cookies"');
  });

  it('отказ по CSRF ничего не очищает', async () => {
    // Обратное направление: заголовок не должен стоять на всех ответах подряд.
    // Запрос, не прошедший проверку, — не выход, и очищать по нему нечего.
    const { POST } = await import('@/app/api/auth/logout/route');
    const response = await POST(post({}) as unknown as Request);
    expect(response.status).toBe(403);
    expect(response.headers.get('clear-site-data')).toBeNull();
  });

  it('заголовок стоит в общей функции ответа, а не на одном пути', () => {
    const source = readFileSync(ROUTE_SOURCE, 'utf8');
    const helper = source.slice(source.indexOf('function response('), source.indexOf('export async function POST'));
    expect(helper).toContain('Clear-Site-Data');
  });
});

describe('клиентская уборка — второй путь, на случай недоступного сервера', () => {
  const realLocal = globalThis.localStorage;
  const realSession = globalThis.sessionStorage;

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: realLocal, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: realSession, configurable: true });
  });

  it('очищает оба хранилища', () => {
    const local = { clear: vi.fn() };
    const session = { clear: vi.fn() };
    Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true });
    clearClientSessionState();
    expect(local.clear).toHaveBeenCalledTimes(1);
    expect(session.clear).toHaveBeenCalledTimes(1);
  });

  it('недоступное localStorage не срывает выход и не мешает очистить sessionStorage', () => {
    // Приватный режим и отключённые site data бросают на самом обращении.
    const session = { clear: vi.fn() };
    Object.defineProperty(globalThis, 'localStorage', {
      get() { throw new Error('storage disabled'); },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true });
    expect(() => clearClientSessionState()).not.toThrow();
    expect(session.clear).toHaveBeenCalledTimes(1);
  });
});

describe('каждый выход во фронтенде вызывает уборку', () => {
  it('перечислять вызывающих вручную нельзя — их находит поиск', () => {
    // Сам список и есть предмет проверки: пятый вызывающий, добавленный позже
    // без уборки, обязан упасть здесь, а не быть замеченным на ревью.
    const tracked = execFileSync('git', ['ls-files', 'app', 'components', 'lib'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
      .split('\n')
      .filter((path) => /\.tsx?$/.test(path));

    const callers = tracked.filter((path) => {
      if (path.startsWith('app/api/auth/logout/')) return false;
      return /fetch\(\s*['"`]\/api\/auth\/logout/.test(readFileSync(resolve(process.cwd(), path), 'utf8'));
    });

    expect(callers.length).toBeGreaterThanOrEqual(4);
    for (const caller of callers) {
      expect(readFileSync(resolve(process.cwd(), caller), 'utf8')).toContain('clearClientSessionState');
    }
  });
});

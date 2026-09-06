// @vitest-environment node
//
// Проверяемый код исполняется на сервере: у маршрутов стоит runtime = 'nodejs'.
// В happy-dom `Cookie` и `Origin` — запрещённые заголовки запроса, конструктор
// Request их молча срезает, и проверка шла бы по пустому входу. Node-окружение
// здесь не удобство, а верность продакшену: в нём Headers склеивает повторный
// заголовок Cookie через '; ' — ровно так, как это делает Node в рантайме.
import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readRequestCookie } from '@/lib/request-cookie';
import { assertCsrf } from '@/lib/server-request-security';

/**
 * V15.3.7 / V1.5.3: один вход — один разбор.
 *
 * В приложении было два разбора заголовка `Cookie`, и на повторе куки они
 * расходились: `server-request-security` брал первое значение, разбор Next —
 * последнее. Решение о доступе зависело от того, чей разбор сработал на этом
 * маршруте. Ниже расхождение сначала воспроизводится на исходном коде обоих
 * разборов, а потом проверяется, что общая функция его снимает.
 *
 * Тесты писались так, чтобы падать при откате правки: если вернуть `.find` или
 * разбор Next, «повтор отклоняется» падает; если убрать try вокруг
 * decodeURIComponent, падает «испорченная кодировка не бросает».
 */

const CSRF = 'pc_csrf_token';

function requestWithCookieHeader(header: string, extra: Record<string, string> = {}): Request {
  return new Request('https://xn----8sbjf4befbjgs9b.xn--p1ai/api/auth/logout', {
    method: 'POST',
    headers: { cookie: header, ...extra },
  });
}

/** Разбор, который стоял в server-request-security до правки. */
function legacyFirstWins(header: string, name: string): string {
  const prefix = `${name}=`;
  const part = header.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
}

/** Разбор Next, который стоял в staff/open-cabinet до правки. */
function nextParser(header: string, name: string): string[] {
  const headers = new Headers();
  headers.append('cookie', header);
  return new RequestCookies(headers).getAll(name).map((cookie) => cookie.value);
}

describe('расхождение двух разборов заголовка Cookie', () => {
  const duplicated = `${CSRF}=AAA; ${CSRF}=BBB; other=1`;

  it('на повторе куки два прежних разбора давали РАЗНЫЕ значения', () => {
    // Это и есть дефект: один запрос, два ответа. Проверяется на настоящем
    // разборе Next, а не на его описании.
    expect(legacyFirstWins(duplicated, CSRF)).toBe('AAA');
    expect(nextParser(duplicated, CSRF)).toEqual(['BBB']);
    expect(legacyFirstWins(duplicated, CSRF)).not.toBe(nextParser(duplicated, CSRF)[0]);
  });

  it('общий разбор отклоняет повтор вместо того, чтобы выбрать сторону', () => {
    // Порядок кук в заголовке задаёт браузер по длине пути и времени создания,
    // а время создания подконтрольно тому, кто ставит куку. Ни «первое», ни
    // «последнее» не является безопасным выбором.
    expect(readRequestCookie(requestWithCookieHeader(duplicated), CSRF)).toBe('');
  });

  it('повтор между двумя заголовками Cookie тоже отклоняется', () => {
    const headers = new Headers();
    headers.append('cookie', `${CSRF}=AAA`);
    headers.append('cookie', `${CSRF}=BBB`);
    // Headers склеивает их через '; ', поэтому разбор по ';' видит оба.
    expect(headers.get('cookie')).toBe(`${CSRF}=AAA; ${CSRF}=BBB`);
    const request = new Request('https://xn----8sbjf4befbjgs9b.xn--p1ai/', { method: 'POST', headers });
    expect(readRequestCookie(request, CSRF)).toBe('');
  });
});

describe('общий разбор на обычном запросе', () => {
  it('возвращает значение, когда кука одна', () => {
    const request = requestWithCookieHeader(`a=1; ${CSRF}=abc123; b=2`);
    expect(readRequestCookie(request, CSRF)).toBe('abc123');
  });

  it('совпадает с разбором Next, когда куки не дублируются', () => {
    const header = `a=1; ${CSRF}=abc123; b=2`;
    expect(readRequestCookie(requestWithCookieHeader(header), CSRF)).toBe(nextParser(header, CSRF)[0]);
  });

  it('не путает куку с другой, чьё имя начинается так же', () => {
    const request = requestWithCookieHeader(`${CSRF}_legacy=WRONG; ${CSRF}=RIGHT`);
    expect(readRequestCookie(request, CSRF)).toBe('RIGHT');
  });

  it('декодирует процентную кодировку', () => {
    expect(readRequestCookie(requestWithCookieHeader(`${CSRF}=a%20b`), CSRF)).toBe('a b');
  });

  it('на отсутствующей куке и пустом заголовке возвращает пустую строку', () => {
    expect(readRequestCookie(requestWithCookieHeader('a=1'), CSRF)).toBe('');
    expect(readRequestCookie(new Request('https://x.invalid/', { method: 'POST' }), CSRF)).toBe('');
  });
});

describe('испорченная кодировка не роняет обработчик', () => {
  for (const broken of ['%', '%zz', 'ok%']) {
    it(`не бросает на значении ${JSON.stringify(broken)}`, () => {
      // decodeURIComponent бросает URIError на таком значении. Раньше оно
      // уходило из assertCsrf наверх, и запрос получал 500 вместо 403 - на
      // любом из маршрутов, где проверка стоит первой строкой обработчика.
      expect(() => legacyFirstWins(`${CSRF}=${broken}`, CSRF)).toThrow();
      expect(readRequestCookie(requestWithCookieHeader(`${CSRF}=${broken}`), CSRF)).toBe('');
    });
  }
});

describe('assertCsrf на настоящем запросе', () => {
  const origin = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
  const previous = process.env.PC_PUBLIC_ORIGIN;

  // Цель сверки origin берётся из настройки, а не из URL запроса. Она
  // закрепляется явно, иначе результат зависел бы от окружения запуска.
  beforeAll(() => { process.env.PC_PUBLIC_ORIGIN = origin; });
  afterAll(() => {
    if (previous === undefined) delete process.env.PC_PUBLIC_ORIGIN;
    else process.env.PC_PUBLIC_ORIGIN = previous;
  });

  it('пропускает совпадающую пару кука/заголовок', () => {
    const request = requestWithCookieHeader(`${CSRF}=abc123`, { origin, 'x-csrf-token': 'abc123' });
    expect(assertCsrf(request)).toEqual({ ok: true });
  });

  it('отказывает, когда кука продублирована, даже если заголовок совпал с одной из них', () => {
    // Без правки первый разбор вернул бы 'AAA' и запрос прошёл бы по значению,
    // которое поставил не сервер.
    const request = requestWithCookieHeader(`${CSRF}=AAA; ${CSRF}=BBB`, { origin, 'x-csrf-token': 'AAA' });
    expect(assertCsrf(request)).toEqual({ ok: false, reason: 'csrf_missing' });
  });

  it('отказывает и на второе значение продублированной куки', () => {
    const request = requestWithCookieHeader(`${CSRF}=AAA; ${CSRF}=BBB`, { origin, 'x-csrf-token': 'BBB' });
    expect(assertCsrf(request)).toEqual({ ok: false, reason: 'csrf_missing' });
  });

  it('на испорченной куке отвечает отказом, а не исключением', () => {
    const request = requestWithCookieHeader(`${CSRF}=%`, { origin, 'x-csrf-token': 'abc123' });
    expect(() => assertCsrf(request)).not.toThrow();
    expect(assertCsrf(request)).toEqual({ ok: false, reason: 'csrf_missing' });
  });

  it('чужой origin отклоняется до сверки токенов', () => {
    const request = requestWithCookieHeader(`${CSRF}=abc123`, {
      origin: 'https://evil.example',
      'x-csrf-token': 'abc123',
    });
    expect(assertCsrf(request)).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('безопасный метод проверку не проходит вовсе', () => {
    const request = new Request(`${origin}/api/auth/logout`, { method: 'GET' });
    expect(assertCsrf(request)).toEqual({ ok: true });
  });
});

describe('staff/open-cabinet читает ту же куку тем же разбором', () => {
  const ROUTE = 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/staff/open-cabinet';

  function post(cookieHeader: string, csrfHeader: string): NextRequest {
    return new NextRequest(ROUTE, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader,
        'x-csrf-token': csrfHeader,
      },
      body: JSON.stringify({ role: 'operator' }),
    });
  }

  it('отказывает продублированной куке, даже если заголовок совпал с последним значением', async () => {
    // До правки маршрут читал разбор Next, а он на повторе отдаёт ПОСЛЕДНЕЕ
    // значение. Значит, значение, поставленное соседом по домену, проходило бы
    // сверку. Проверка идёт до всех остальных, поэтому окружения не требует.
    const { POST } = await import('@/app/platform-v7/staff/open-cabinet/route');
    const response = await POST(post(`${CSRF}=AAA; ${CSRF}=BBB`, 'BBB'));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('CSRF_REJECTED');
  });

  it('отказывает и на первое значение продублированной куки', async () => {
    const { POST } = await import('@/app/platform-v7/staff/open-cabinet/route');
    const response = await POST(post(`${CSRF}=AAA; ${CSRF}=BBB`, 'AAA'));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('CSRF_REJECTED');
  });

  it('рабочий вызов правка не ломает: одна кука проходит сверку и идёт дальше', async () => {
    // Существенно для платформы: отказ должен наступать по неоднозначности, а
    // не всегда. При одной куке проверка пройдена, и маршрут доходит до
    // следующей причины отказа - отсутствия входа владельца.
    const { POST } = await import('@/app/platform-v7/staff/open-cabinet/route');
    const response = await POST(post(`${CSRF}=abc123`, 'abc123'));
    expect((await response.json()).code).not.toBe('CSRF_REJECTED');
  });
});

describe('второго разбора заголовка Cookie в приложении не появилось', () => {
  const SOURCE_ROOTS = ['app', 'lib', 'components', 'middleware.ts'];
  const ALLOWED = new Set(['lib/request-cookie.ts']);

  function sourceFiles(entry: string, collected: string[] = []): string[] {
    const full = resolve(process.cwd(), entry);
    if (!existsSync(full)) return collected;
    if (statSync(full).isFile()) {
      if (/\.(?:ts|tsx)$/u.test(entry)) collected.push(entry);
      return collected;
    }
    for (const child of readdirSync(full)) {
      if (child === 'node_modules') continue;
      sourceFiles(`${entry}/${child}`, collected);
    }
    return collected;
  }

  it('заголовок Cookie читает ровно один файл', () => {
    // Правка началась с двух разборов; при поиске нашёлся третий, в
    // server-request-actor.ts, — тот же .find по первому совпадению, и через
    // него шёл сторож маршрута. Утверждение «разбор один» держится не памятью,
    // а этой проверкой: четвёртая копия уронит её при появлении.
    const readers = SOURCE_ROOTS
      .flatMap((root) => sourceFiles(root))
      .filter((file) => {
        const text = readFileSync(resolve(process.cwd(), file), 'utf8');
        return text.includes("headers.get('cookie')") || text.includes('headers.get("cookie")');
      });
    expect(readers).toEqual([...ALLOWED]);
  });
});

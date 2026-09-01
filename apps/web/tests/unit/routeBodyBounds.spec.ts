import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

/**
 * Тот же обход `content-length`, что закрывался в #4852, найден сплошной
 * проверкой ещё на двух маршрутах (#4853). Оба обхода измерены:
 *
 *   chunked, заголовка нет  → Number(null || '0') === 0        → проверка молчит
 *   content-length: мусор   → Number.isFinite(NaN) === false   → проверка молчит
 *
 * Тяжесть у маршрутов разная, и это зафиксировано отдельно:
 *
 *   public-platform-assistant — пост-проверки размера тела НЕТ вовсе
 *     (MAX_MESSAGE_LENGTH ограничивает поле message, а не тело), и маршрут
 *     аутентификации не требует;
 *   staff/[...path]           — пост-проверка ЕСТЬ, поэтому предел держится,
 *     но срабатывает уже занятой памятью.
 *
 * V5.2.1 здесь не заявляется: её текст о файлах, эти маршруты файлов не
 * принимают. Инженерный дефект без требования за спиной.
 */

const OVERSIZED = 3 * 1024 * 1024;

// NextRequest, а не Request: маршрут читает request.nextUrl, и на голом
// Request счастливый путь падал бы по причине, к предмету теста не относящейся.
async function postRaw(mod: string, body: BodyInit, headers: Record<string, string>) {
  const { POST } = await import(mod);
  const request = new NextRequest('https://example.invalid/x', { method: 'POST', body, headers });
  const response = await POST(request as never);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe('public assistant — тело ограничивается на чтении', () => {
  const MOD = '../../app/api/public-platform-assistant/route';

  it('отказывает большому телу, когда объявленного размера нет', async () => {
    const { status, body } = await postRaw(MOD, new Uint8Array(OVERSIZED), {
      'content-type': 'application/json',
    });
    expect(status).toBe(413);
    expect(body.code).toBe('PUBLIC_ASSISTANT_BODY_TOO_LARGE');
  });

  it('тело в пределах потолка доходит до разбора', async () => {
    // Не 413: граница отсекает по размеру, а не всё подряд.
    const { status, body } = await postRaw(MOD, '{"message":"привет"}', {
      'content-type': 'application/json',
    });
    expect(status).not.toBe(413);
    expect(body.code).not.toBe('PUBLIC_ASSISTANT_BODY_TOO_LARGE');
  });

  it('негодный JSON в пределах потолка — это 400, а не 413', async () => {
    const { status, body } = await postRaw(MOD, '{не json', {
      'content-type': 'application/json',
    });
    expect(status).toBe(400);
    expect(body.code).toBe('PUBLIC_ASSISTANT_INVALID_JSON');
  });

  it('оборвавшийся клиент даёт 400, а не 500', async () => {
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('client went away'));
      },
    });
    const { POST } = await import(MOD);
    const request = new NextRequest('https://example.invalid/x', {
      method: 'POST',
      body: failing,
      headers: { 'content-type': 'application/json' },
      // @ts-expect-error duplex обязателен для потокового тела в undici
      duplex: 'half',
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });
});

/**
 * Найдено обзором на PR: выше проверялся только public-platform-assistant,
 * хотя тот же проход заменил читателя тела и в staff-прокси, а поведение у
 * него ДРУГОЕ — свои коды PAYLOAD_TOO_LARGE и REQUEST_BODY_UNREADABLE.
 * Регрессия, вернувшая бы полную буферизацию именно там, прошла бы мимо.
 *
 * Чтобы дойти до чтения тела, запрос обязан пройти весь фильтр маршрута:
 * cookie доступа, разрешённый путь из WRITE_PATHS, CSRF (cookie + заголовок,
 * сверяются timingSafeEqual), и API_BASE_URL, который берётся на импорте
 * модуля — поэтому env выставляется до динамического импорта.
 */
describe('staff-прокси — тело ограничивается на чтении', () => {
  const MOD = '../../app/api/staff/[...path]/route';
  const CSRF = 'a'.repeat(48);
  const MAX_BODY_BYTES = 64 * 1024; // предел staff-маршрута

  // Заголовок cookie в конструкторе Request отбрасывается (измерено: он
  // приходит в маршрут как null), поэтому cookie ставятся через собственную
  // банку NextRequest, а не заголовком.
  function staffRequest(body: BodyInit, stream = false) {
    const request = new NextRequest('https://example.invalid/api/staff/access/requests', {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': CSRF,
      },
      // @ts-expect-error duplex обязателен для потокового тела в undici
      ...(stream ? { duplex: 'half' } : {}),
    });
    request.cookies.set('pc_access_token', 'token');
    request.cookies.set('pc_csrf_token', CSRF);
    return request;
  }

  const context = { params: Promise.resolve({ path: ['access', 'requests'] }) };

  async function post(body: BodyInit, stream = false) {
    process.env.API_URL = 'http://api.invalid';
    const { POST } = await import(MOD);
    const response = await POST(staffRequest(body, stream) as never, context as never);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it('не вычитывает большое тело целиком, когда объявленного размера нет', async () => {
    // Статус здесь ничего не доказывает: и счёт байтов на чтении, и прежняя
    // проверка ПОСЛЕ чтения возвращают один и тот же 413 PAYLOAD_TOO_LARGE.
    // Измерено мутацией: assert только на статус переживал возврат к
    // request.text(). Разница между ними — потраченная память, поэтому
    // проверяется она: сколько байт маршрут забрал из потока.
    //
    // Тело обязано быть потоком: с Uint8Array undici сам проставляет
    // content-length, и 413 приходит от старой предпроверки заголовка.
    const CHUNK = 16 * 1024;
    const TOTAL = 200 * 1024;
    let produced = 0;
    const oversized = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (produced >= TOTAL) {
          controller.close();
          return;
        }
        produced += CHUNK;
        controller.enqueue(new Uint8Array(CHUNK));
      },
    });

    const { status, body } = await post(oversized, true);
    expect(status).toBe(413);
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    // Предел 64 KiB. Отказ наступает на куске, переступившем его (5-й, 80 KiB),
    // плюс один кусок поток отдаёт наперёд — highWaterMark у стандартной
    // очереди равен единице. Измерено: 98304. Полная буферизация забрала бы
    // все 208 KiB.
    expect(produced).toBeLessThanOrEqual(MAX_BODY_BYTES + 2 * CHUNK);
    expect(produced).toBeLessThan(TOTAL);
  });

  it('оборвавшийся клиент даёт 400 REQUEST_BODY_UNREADABLE, а не 500', async () => {
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('client went away'));
      },
    });
    const { status, body } = await post(failing, true);
    expect(status).toBe(400);
    expect(body.code).toBe('REQUEST_BODY_UNREADABLE');
  });
});

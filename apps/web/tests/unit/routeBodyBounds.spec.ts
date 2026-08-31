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

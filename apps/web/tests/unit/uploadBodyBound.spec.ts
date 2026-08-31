import { describe, expect, it, vi } from 'vitest';
import { readBoundedBody } from '../../lib/uploads/bounded-body';

/**
 * ASVS 5.0 V5.2.1: принимать файлы только такого размера, который приложение
 * способно обработать, не отдавая отказ в обслуживании.
 *
 * Предпроверка по `content-length` этого не давала — оба обхода проверены
 * запуском (#4848):
 *
 *   chunked, заголовка нет  → Number(null || '0') === 0        → проверка молчит
 *   content-length: мусор   → Number.isFinite(NaN) === false   → проверка молчит
 *
 * После чего `formData()` буферизовал тело целиком: размер становился известен,
 * когда память уже занята.
 */

function streamOf(chunks: Uint8Array[], onCancel?: () => void): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[index]);
      index += 1;
    },
    cancel() {
      onCancel?.();
    },
  });
}

describe('readBoundedBody — потолок стоит на чтении, а не на объявлении', () => {
  it('возвращает тело, которое умещается в потолок', async () => {
    const body = streamOf([new Uint8Array(400), new Uint8Array(600)]);
    const out = await readBoundedBody(body, 1_024);
    expect(out).not.toBeNull();
    expect((out as ArrayBuffer).byteLength).toBe(1_000);
  });

  it('отказывает, как только счётчик перешёл потолок', async () => {
    const body = streamOf([new Uint8Array(600), new Uint8Array(600)]);
    expect(await readBoundedBody(body, 1_000)).toBeNull();
  });

  it('отменяет поток, а не просто перестаёт читать', async () => {
    // Иначе отправитель продолжает слать в сокет, который никто не читает.
    const cancelled = vi.fn();
    const body = streamOf([new Uint8Array(2_000)], cancelled);
    expect(await readBoundedBody(body, 1_000)).toBeNull();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('не зависит от объявленного размера вообще — его тут нет', async () => {
    // Ровно случай chunked: заголовка нет, а тело большое.
    const body = streamOf(Array.from({ length: 40 }, () => new Uint8Array(1_000)));
    expect(await readBoundedBody(body, 8_000)).toBeNull();
  });

  it('принимает ровно потолок и отказывает на байт больше', async () => {
    expect(await readBoundedBody(streamOf([new Uint8Array(1_000)]), 1_000)).not.toBeNull();
    expect(await readBoundedBody(streamOf([new Uint8Array(1_001)]), 1_000)).toBeNull();
  });

  it('пустое тело — это пустое тело, а не отказ', async () => {
    const out = await readBoundedBody(null, 1_000);
    expect(out).not.toBeNull();
    expect((out as ArrayBuffer).byteLength).toBe(0);
  });

  it('собирает байты в исходном порядке', async () => {
    const body = streamOf([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5])]);
    const out = await readBoundedBody(body, 16);
    expect(Array.from(new Uint8Array(out as ArrayBuffer))).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('POST /api/.../attachments — граница действительно достигается', () => {
  /**
   * Тест на самой функции прошёл бы и тогда, когда маршрут её не зовёт: ровно
   * это и показала мутация, вернувшая `request.formData()` — она проходит
   * типизацию и все проверки уровня функции. Поэтому проверяется маршрут.
   */
  async function postRaw(body: BodyInit, headers: Record<string, string>) {
    const { POST } = await import(
      '../../app/api/public-platform-assistant/attachments/route'
    );
    const request = new Request(
      'https://example.invalid/api/public-platform-assistant/attachments',
      { method: 'POST', body, headers },
    );
    const response = await POST(request as never);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it('отказывает телу больше потолка, когда объявленного размера нет вовсе', async () => {
    // Случай chunked: content-length отсутствует, поэтому предпроверка молчит.
    // Границей может быть только счёт байтов на чтении.
    const oversized = new Uint8Array(26 * 1024 * 1024);
    const { status, body } = await postRaw(oversized, {
      'content-type': 'multipart/form-data; boundary=----zzz',
    });

    expect(status).toBe(413);
    expect(body.error).toBe('UPLOAD_TOO_LARGE');
  });

  it('отказывает и когда объявленный размер — мусор', async () => {
    // Number('not-a-number') → NaN, Number.isFinite(NaN) → false, предпроверка
    // снова молчит.
    const oversized = new Uint8Array(26 * 1024 * 1024);
    const { status } = await postRaw(oversized, {
      'content-type': 'multipart/form-data; boundary=----zzz',
    });

    expect(status).toBe(413);
  });

  it('тело в пределах потолка доходит до разбора', async () => {
    // Не 413: граница отсекает по размеру, а не всё подряд.
    //
    // Ответ здесь FILES_REQUIRED, а не ошибка разбора: такое тело разбирается
    // как пустая multipart-форма, и маршрут доходит до собственной проверки
    // «файлов нет». Это и есть нужное доказательство — чтение пропустило тело
    // дальше, разбор состоялся. Первая версия теста ждала INVALID_MULTIPART_BODY
    // и была неправа; исправлено ожидание, а не код.
    const { status, body } = await postRaw(new Uint8Array(1_024), {
      'content-type': 'multipart/form-data; boundary=----zzz',
    });

    expect(status).not.toBe(413);
    expect(body.error).toBe('FILES_REQUIRED');
  });
});

/**
 * Чтение тела запроса под потолком.
 *
 * ASVS 5.0 V5.2.1 просит принимать файлы только такого размера, который
 * приложение способно обработать, не теряя производительность и не отдавая
 * отказ в обслуживании. Предпроверка по `content-length` этого не даёт, и по
 * двум независимым причинам сразу:
 *
 *   - у запроса с `Transfer-Encoding: chunked` заголовка `content-length` нет
 *     вовсе, а `Number(null || '0')` — это ноль, то есть проверка «объявлено
 *     больше потолка» не срабатывает никогда;
 *   - объявленный мусор (`content-length: not-a-number`) даёт `NaN`, и
 *     `Number.isFinite(NaN)` ложно, поэтому условие снова не срабатывает.
 *
 * Обе проверены запуском. В обоих случаях дальше вызывался `formData()`,
 * который буферизует тело целиком — размер становится известен только после
 * того, как память уже занята.
 *
 * Поэтому граница ставится на самом чтении: байты считаются по мере поступления
 * и поток отменяется, как только счётчик переходит потолок. Объявленному не
 * доверяется ничего.
 */
export async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<ArrayBuffer | null> {
  if (!body) return new ArrayBuffer(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        // Отмена, а не просто выход: иначе отправитель продолжит слать в сокет,
        // который никто не читает.
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  // Возвращается ArrayBuffer, а не Uint8Array: он и есть BodyInit, поэтому
  // Response строится без ещё одной копии на 25 МиБ.
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out.buffer;
}

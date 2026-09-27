import { NextResponse } from 'next/server';

/**
 * JSON-ответ маршрута API, который браузеру нельзя класть в кэш.
 *
 * ASVS 5.0 V14.3.2 требует, чтобы ответы с чувствительными данными несли
 * указание не сохранять их. Замерено до правки: из 118 обработчиков под
 * apps/web/app/api заголовок ставили 55, а 63 не ставили ничего. Из этих 63
 * девятнадцать объявляли `export const dynamic = 'force-dynamic'` или
 * `revalidate = 0` — и это выглядит покрытием, не будучи им: обе директивы
 * управляют кэшем Next.js на сервере и ни одна не выдаёт заголовка ответа.
 *
 * Помощник вместо правки каждого места возврата по отдельности: вызовы
 * встречаются и с init, и без него, и единая точка позволяет проверить
 * правило разом, а не надеяться, что новый маршрут о нём вспомнит.
 *
 * Существующий заголовок не перетирается. Это существенно: потоковые
 * маршруты (text/event-stream) намеренно ставят `no-cache, no-transform`,
 * где no-transform не даёт промежуточным узлам ломать поток, и подмена его
 * на no-store молча забрала бы эту защиту.
 */
export function jsonNoStore(body: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  return NextResponse.json(body, { ...init, headers });
}

/**
 * Разбор и учёт отчётов о нарушениях Content-Security-Policy.
 *
 * Вынесено из маршрута намеренно. Файл Route Handler в Next.js может
 * экспортировать только имена из фиксированного набора (GET, POST, runtime,
 * dynamic и подобные); экспорт хелпера ради теста ломает production-сборку с
 * «"normaliseReport" is not a valid Route export field». Это не ловится
 * юнит-тестами — vitest контракт маршрута не проверяет, его проверяет только
 * next build. Поэтому чистая логика живёт здесь, а маршрут остаётся маршрутом.
 */

/**
 * Приём отчётов о нарушениях Content-Security-Policy.
 *
 * ASVS 5.0 V3.4.7 требует, чтобы политика называла адрес, куда браузер шлёт
 * нарушения. Без такого адреса CSP работает, но её срабатывания никто не
 * видит: политику нельзя ни проверить на ложные срабатывания, ни использовать
 * как сигнал об атаке.
 *
 * Точка по устройству публичная и неаутентифицированная — браузер шлёт отчёты
 * без учётных данных и не повторяет попытку. Это делает её вектором затопления
 * логов, поэтому здесь три ограничения, и каждое поставлено осознанно:
 *
 *   - тело читается под потолком, а не проверяется по `content-length`:
 *     заголовка может не быть вовсе при chunked-кодировании, и тогда проверка
 *     объявленного размера не срабатывает никогда (см. bounded-body.ts, где
 *     этот обход измерен и закрыт);
 *   - частота ограничена окном: сверх бюджета отчёты считаются, но не пишутся,
 *     и по окончании окна в лог уходит одна строка с числом отброшенных;
 *   - в лог попадают только известные поля, обрезанные по длине и очищенные от
 *     управляющих символов — иначе отправитель диктует содержимое лога;
 *   - у адресов в лог попадают только схема, хост и путь: строка запроса может
 *     нести секрет (токен восстановления пароля), см. redactUri.
 *
 * Ограничение честное и его надо знать: счётчик живёт в памяти процесса. При
 * нескольких экземплярах бюджет умножается на их число. Общего хранилища здесь
 * намеренно нет — оно потребовало бы внешней зависимости, а задача точки в том,
 * чтобы нарушения было видно, а не в том, чтобы быть распределённым счётчиком.
 */

/** Отчёт CSP — это несколько сотен байт. Всё сверх — не отчёт. */
export const MAX_BODY_BYTES = 8 * 1024;
const WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 120;
/** Длина одного поля в логе. Директива и URI бывают длинными, но не такими. */
const MAX_FIELD_CHARS = 256;

export const ACCEPTED_CONTENT_TYPES = [
  'application/csp-report',
  'application/reports+json',
  'application/json',
];

type Window = { startedAt: number; accepted: number; dropped: number };

const state: Window = { startedAt: 0, accepted: 0, dropped: 0 };

/**
 * Обрезка и очистка поля перед записью в лог.
 *
 * Управляющие символы удаляются, а не экранируются: перевод строки в значении
 * поля позволил бы отправителю дописать в лог собственную строку, которая
 * прочтётся как отдельная запись.
 */
function logSafe(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .slice(0, MAX_FIELD_CHARS);
}

/**
 * Адрес для лога: схема, хост и путь — без запроса, фрагмента и учётных данных.
 *
 * Браузер кладёт в document-uri и blocked-uri адрес вместе со строкой запроса
 * (CSP3 §5.4 убирает только фрагмент и user:password), а в запросе живут
 * секреты: страница восстановления пароля получает одноразовый токен в
 * `?token=`. Писать такой адрес в лог — значит переносить действующий токен
 * в журнал контейнера. Для разбора нарушения достаточно знать, на какой
 * странице и какой ресурс сработал, поэтому запрос и фрагмент отрезаются для
 * любого значения, а не только для известных страниц: список страниц с
 * секретом в адресе устареет раньше, чем это правило.
 *
 * Ключевые слова CSP (inline, eval, self) и относительные значения не
 * разбираются как URL — от них тоже отрезается всё после `?` и `#`. У адреса
 * без хоста (data:, blob: и подобных) остаётся только схема: содержимое такого
 * адреса — сами данные.
 */
function redactUri(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value.split(/[?#]/u, 1)[0];
  }
  return url.host ? `${url.protocol}//${url.host}${url.pathname}` : url.protocol;
}

/** Поля, общие для формата report-uri и формата report-to. */
export function normaliseReport(entry: unknown): Record<string, string> | null {
  if (!entry || typeof entry !== 'object') return null;
  const source = entry as Record<string, unknown>;
  // report-uri кладёт всё внутрь "csp-report"; report-to — внутрь "body".
  const body = (source['csp-report'] ?? source.body ?? source) as Record<string, unknown>;
  if (!body || typeof body !== 'object') return null;

  const directive = body['effective-directive'] ?? body.effectiveDirective ?? body['violated-directive'];
  const blocked = body['blocked-uri'] ?? body.blockedURL;
  const document = body['document-uri'] ?? body.documentURL;
  if (directive === undefined && blocked === undefined && document === undefined) return null;

  return {
    directive: logSafe(directive),
    blocked: logSafe(redactUri(blocked)),
    document: logSafe(redactUri(document)),
    disposition: logSafe(body.disposition),
  };
}

/** Разбор обоих форматов: одиночный объект или массив отчётов. */
export function extractReports(payload: unknown): Array<Record<string, string>> {
  const entries = Array.isArray(payload) ? payload : [payload];
  const out: Array<Record<string, string>> = [];
  for (const entry of entries.slice(0, 16)) {
    const report = normaliseReport(entry);
    if (report) out.push(report);
  }
  return out;
}

/** Бюджет окна. Возвращает false, когда отчёт надо отбросить. */
export function admit(now: number, window: Window = state): boolean {
  if (now - window.startedAt >= WINDOW_MS) {
    if (window.dropped > 0) {
      console.warn(`[csp-report] окно закрыто: принято ${window.accepted}, отброшено ${window.dropped}`);
    }
    window.startedAt = now;
    window.accepted = 0;
    window.dropped = 0;
  }
  if (window.accepted >= MAX_REPORTS_PER_WINDOW) {
    window.dropped += 1;
    return false;
  }
  window.accepted += 1;
  return true;
}


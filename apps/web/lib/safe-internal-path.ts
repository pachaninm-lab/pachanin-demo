/**
 * Проверка, что путь ведёт внутрь приложения, а не наружу.
 *
 * `value.startsWith('/')` этой работы не делает, и это измерено. Относительно
 * `https://процент-агро.рф/api/auth/demo` конструктор URL разрешает:
 *
 *   '/lots'         → https://процент-агро.рф/lots      свой хост
 *   '//evil.com'    → https://evil.com/                 ЧУЖОЙ хост
 *   '////evil.com'  → https://evil.com/                 ЧУЖОЙ хост
 *   '/\evil.com'    → https://evil.com/                 ЧУЖОЙ хост
 *
 * Ведущий двойной слэш — это протокол-относительный адрес, а обратный слэш
 * браузеры и конструктор URL приводят к прямому. Все три начинаются с '/',
 * поэтому наивную проверку проходят и уводят пользователя на чужой домен с
 * нашего же адреса — то есть дают фишинг с доверенного хоста.
 *
 * Здесь путь проверяется не по первому символу, а по результату разрешения:
 * годится только то, что осталось на своём origin.
 */

/** Заведомо небезопасные начала: протокол-относительный адрес и его варианты. */
const PROTOCOL_RELATIVE = /^[/\\]{2}/u;

/**
 * Возвращает путь, если он внутренний, иначе fallback.
 *
 * Проверка структурная: значение разрешается относительно фиктивного origin, и
 * результат обязан остаться на нём. Так отсекается всё, что уводит наружу, —
 * включая формы, которые ещё не придуманы, а не только три известные.
 */
export function safeInternalPath(value: string | string[] | undefined | null, fallback = '/'): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  if (!raw.startsWith('/')) return fallback;
  // Быстрый отказ до разрешения: '//' и '/\' — это адрес, а не путь.
  if (PROTOCOL_RELATIVE.test(raw)) return fallback;

  // Контрольный origin выбран так, чтобы совпадение с ним было невозможно
  // случайно: если после разрешения origin другой, путь уводил наружу.
  const probe = 'https://internal-path-probe.invalid';
  let resolved: URL;
  try {
    resolved = new URL(raw, probe);
  } catch {
    return fallback;
  }
  if (resolved.origin !== probe) return fallback;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

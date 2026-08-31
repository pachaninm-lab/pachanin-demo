/**
 * Граница, за которой аналитика не работает.
 *
 * Правило — запрет по умолчанию: путь, которого нет в списке ниже, аналитику
 * не получает. Обратный порядок (запрещать перечисленное) требует помнить про
 * каждый новый приватный раздел, а разделов у платформы 217 только под
 * platform-v7. Список разрешённого короткий и проверяемый глазами.
 *
 * Что сюда не попадает и почему: кабинет, staff, Гекта и публичный
 * AI-ассистент принимают свободный текст и коммерческие данные; вход,
 * регистрация, восстановление пароля и MFA — учётные данные; /lots — рабочий
 * раздел, а не витрина.
 */

/** Пути, на которых аналитика допустима. Сравнение точное или по префиксу. */
export const PUBLIC_ANALYTICS_PATHS: readonly string[] = Object.freeze([
  '/',
  '/legal',
  '/roles',
  '/trust',
]);

/**
 * Session replay выключен.
 *
 * Webvisor записывает DOM и содержимое полей и воспроизводит сессию на стороне
 * третьей стороны. Доказать безопасную public-only границу для него здесь
 * нельзя: публичная часть включает вход, регистрацию, восстановление пароля и
 * ассистента со свободным вводом, а на витрине есть форма заявки. До появления
 * доказанной границы запись сессий не включается — маскирование отдельных
 * полей как основная защита не годится, потому что защищает только то, что
 * кто-то не забыл пометить.
 */
export const SESSION_REPLAY_ENABLED = false as const;

/** Нормализация: локальный префикс и хвостовой слэш не должны решать. */
export function normalizeAnalyticsPath(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/(?:ru|en|zh)(?=\/|$)/u, '');
  const trimmed = withoutLocale.replace(/\/+$/u, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Разрешена ли аналитика на этом пути.
 *
 * Fail-closed: неизвестный путь, пустая строка и всё, что не удалось разобрать,
 * получают false.
 */
export function analyticsAllowedForPath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== 'string' || pathname.length === 0) return false;
  if (!pathname.startsWith('/')) return false;
  const path = normalizeAnalyticsPath(pathname);
  return PUBLIC_ANALYTICS_PATHS.some((allowed) => (
    allowed === '/' ? path === '/' : path === allowed || path.startsWith(`${allowed}/`)
  ));
}

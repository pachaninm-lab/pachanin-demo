/**
 * Мост между браузером и кабинетом Гекты в существующем API платформы.
 *
 * Второго backend здесь нет: маршрут только пересылает уже выданный
 * access-токен платформы на существующий NestJS API. Если API не настроен,
 * мост честно отвечает `service_unavailable`, а интерфейс прячет серверные
 * функции вместо того, чтобы показывать кнопку, которая ничего не делает.
 */

export const GEKTA_BRIDGE_TIMEOUT_MS = 12_000;

/** Разрешённые сегменты пути. Всё остальное отсекается до похода в API. */
const USER_PATHS = [
  /^entitlement$/u,
  /^phone$/u,
  /^projects$/u,
  /^projects\/[A-Za-z0-9_-]{1,64}$/u,
  /^conversations$/u,
  /^conversations\/[A-Za-z0-9_-]{1,64}$/u,
  /^conversations\/[A-Za-z0-9_-]{1,64}\/messages$/u,
  /^history\/import$/u,
] as const;

const OPERATOR_PATHS = [
  /^permissions$/u,
  /^metrics$/u,
  /^search$/u,
  /^accounts\/[A-Za-z0-9_-]{1,64}$/u,
  /^accounts\/[A-Za-z0-9_-]{1,64}\/audit$/u,
  /^accounts\/[A-Za-z0-9_-]{1,64}\/grant$/u,
  /^accounts\/[A-Za-z0-9_-]{1,64}\/grant-lifetime$/u,
  /^accounts\/[A-Za-z0-9_-]{1,64}\/extend-trial$/u,
  /^accounts\/[A-Za-z0-9_-]{1,64}\/suspend$/u,
  /^accounts\/[A-Za-z0-9_-]{1,64}\/reset-quota$/u,
  /^grants\/[A-Za-z0-9_-]{1,64}\/revoke$/u,
] as const;

export type BridgeSurface = 'account' | 'operator';

/**
 * Путь собирается из сегментов, а не из строки запроса: так `..` и
 * закодированный слэш не могут увести запрос на чужой маршрут API.
 */
export function resolveBridgePath(surface: BridgeSurface, segments: readonly string[]): string | null {
  if (!segments.length || segments.length > 4) return null;
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('/'))) return null;
  const path = segments.join('/');
  const allowed = surface === 'operator' ? OPERATOR_PATHS : USER_PATHS;
  return allowed.some((pattern) => pattern.test(path)) ? path : null;
}

export function apiBaseUrl(): string | null {
  const configured = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/u, '');
  if (!configured) return null;
  return /^https?:\/\//u.test(configured) ? configured : null;
}

export function upstreamUrl(surface: BridgeSurface, path: string, search: string): string | null {
  const base = apiBaseUrl();
  if (!base) return null;
  const prefix = surface === 'operator' ? 'gekta/operator' : 'gekta';
  return `${base}/${prefix}/${path}${search}`;
}

/** Из строки запроса пропускаются только те параметры, которые API читает. */
export function safeSearch(surface: BridgeSurface, input: URLSearchParams): string {
  const allowed = surface === 'operator' ? ['phone', 'email', 'accountId'] : ['projectId', 'search'];
  const output = new URLSearchParams();
  for (const key of allowed) {
    const value = input.get(key);
    if (value !== null && value.length <= 320) output.set(key, value);
  }
  const serialized = output.toString();
  return serialized ? `?${serialized}` : '';
}

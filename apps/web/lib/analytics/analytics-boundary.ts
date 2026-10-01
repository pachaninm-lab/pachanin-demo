import {
  TOUR_ENTRY_VARIANTS,
  TOUR_LENSES,
  TOUR_PERSPECTIVES,
  TOUR_RISKS,
  TOUR_SCENARIOS,
  TOUR_STAGES,
} from '@/lib/platform-v7/public-product-experience-state';

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

/** Пути, на которых существующая публичная аналитика допустима. */
export const PUBLIC_ANALYTICS_PATHS: readonly string[] = Object.freeze([
  '/',
  '/legal',
  '/roles',
  '/trust',
]);

/** PostHog дополнительно получает только точную каноническую главную platform-v7. */
export const POSTHOG_PUBLIC_ANALYTICS_PATH = '/platform-v7' as const;

/** Имена браузерных событий, которые принадлежат публичному product-analytics контракту. */
export const PUBLIC_PRODUCT_ANALYTICS_DOM_EVENTS = Object.freeze([
  'pc:public-product-analytics',
  'pc:public-product-funnel',
] as const);

/**
 * Конечный словарь событий. Любое новое имя сначала должно пройти review этой
 * границы; произвольные имена из DOM в стороннюю систему не передаются.
 */
export const PUBLIC_PRODUCT_ANALYTICS_EVENT_NAMES = Object.freeze([
  'public_page_view',
  'home_view',
  'home_v3_view',
  'registration_open',
  'deal_demo_open',
  'home_role_entry_open',
  'hero_tai_explainer_open',
  'tai_detail_open',
  'ai_in_action_opened',
  'ai_current_value_role_cta',
  'deal_xray_open',
  'deal_intelligence_lens_changed',
  'perspective_selected',
  'lens_selected',
  'stage_selected',
  'scenario_selected',
  'risk_selected',
  'document_open',
  'ai_layer_enabled',
  'guided_tour_started',
  'guided_tour_completed',
  'entry_variant_selected',
  'role_selected',
  'connect_cta_click',
  'organization_request_step_completed',
  'submit_organization_request',
  'organization_request_accepted',
  'tai_stage_prompt_opened',
  'deal_preview_opened',
  'scenario_started',
  'scenario_completed',
  'organization_connect_started',
] as const);

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

export type PublicProductAnalyticsValue = string | number | boolean;
export type PublicProductAnalyticsProperties = Record<string, PublicProductAnalyticsValue>;

export type PublicProductAnalyticsCaptureInput = {
  distinctId: string;
  name: string;
  properties: PublicProductAnalyticsProperties;
};

export type SanitizedPublicProductAnalyticsEvent = {
  name: string;
  properties: PublicProductAnalyticsProperties;
};

const PUBLIC_PRODUCT_ANALYTICS_EVENT_SET = new Set<string>(PUBLIC_PRODUCT_ANALYTICS_EVENT_NAMES);
const PERSPECTIVE_VALUES = new Set<string>(TOUR_PERSPECTIVES);
const LENS_VALUES = new Set<string>(TOUR_LENSES);
const STAGE_VALUES = new Set<string>(TOUR_STAGES);
const SCENARIO_VALUES = new Set<string>(TOUR_SCENARIOS);
const RISK_VALUES = new Set<string>(TOUR_RISKS);
const ENTRY_VARIANT_VALUES = new Set<string>(TOUR_ENTRY_VARIANTS);
const ROLE_ENTRY_VALUES = new Set<string>(['seller', 'buyer', 'operator', 'finance']);
const MODE_VALUES = new Set<string>(['durable_server_intake']);
const SOURCE_VALUES = new Set<string>([
  'public_analytics_bridge',
  'hero_tai_definition_v2',
  'home_v5_hero',
  'home_ai_current_value',
  'public_v5_quick_journey',
  'public_v5_journey_controls',
  'public_v5_intent',
  'public_v5_complete',
  'home_preview',
  'home_preview_start',
  'home_preview_stage',
  'how_it_works',
]);
const OPTION_VALUES = new Set<string>([
  'sell',
  'buy',
  'execute',
  'control',
  'progress',
  'evidence',
  'payment',
  'deviation',
]);
const EPHEMERAL_PUBLIC_ANALYTICS_ID = /^tab-[a-z0-9]{6,16}-[a-z0-9]{1,16}$/u;

/** Нормализация: локальный префикс и хвостовой слэш не должны решать. */
export function normalizeAnalyticsPath(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/(?:ru|en|zh)(?=\/|$)/u, '');
  const trimmed = withoutLocale.replace(/\/+$/u, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Разрешена ли существующая публичная аналитика на этом пути.
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

/**
 * PostHog расширяет публичную границу ровно на /platform-v7.
 * `/platform-v7/*` никогда не наследует разрешение по префиксу.
 */
export function posthogPublicAnalyticsAllowedForPath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== 'string' || pathname.length === 0 || !pathname.startsWith('/')) return false;
  const path = normalizeAnalyticsPath(pathname);
  return path === POSTHOG_PUBLIC_ANALYTICS_PATH || analyticsAllowedForPath(path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function enumValue(values: Set<string>, value: unknown): string | undefined {
  return typeof value === 'string' && values.has(value) ? value : undefined;
}

function boundedIndex(value: unknown): number | undefined {
  const number = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d{1,2}$/u.test(value) ? Number(value) : Number.NaN;
  return Number.isInteger(number) && number >= 0 && number <= 20 ? number : undefined;
}

function sanitizeProperty(key: string, value: unknown): PublicProductAnalyticsValue | undefined {
  if (key === 'locale') return value === 'ru' || value === 'en' || value === 'zh' ? value : undefined;
  if (key === 'viewport_group') {
    return value === 'mobile' || value === 'tablet' || value === 'desktop' ? value : undefined;
  }
  if (key === 'replay') return typeof value === 'boolean' ? value : undefined;
  if (key === 'step') {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 20 ? value : undefined;
  }
  if (key === 'document_index') return boundedIndex(value);
  if (key === 'perspective' || key === 'role') return enumValue(PERSPECTIVE_VALUES, value);
  if (key === 'lens') return enumValue(LENS_VALUES, value);
  if (key === 'stage') return enumValue(STAGE_VALUES, value);
  if (key === 'scenario') return enumValue(SCENARIO_VALUES, value);
  if (key === 'risk') return enumValue(RISK_VALUES, value);
  if (key === 'entry_variant') return enumValue(ENTRY_VARIANT_VALUES, value);
  if (key === 'role_entry') return enumValue(ROLE_ENTRY_VALUES, value);
  if (key === 'source_event') return enumValue(PUBLIC_PRODUCT_ANALYTICS_EVENT_SET, value);
  if (key === 'mode') return enumValue(MODE_VALUES, value);
  if (key === 'source') return enumValue(SOURCE_VALUES, value);
  if (key === 'option') return enumValue(OPTION_VALUES, value);
  return undefined;
}

/**
 * Превращает недоверенный DOM/server-action payload в небольшой плоский словарь.
 * Свободный текст, URL, поля форм, вложенные объекты и неизвестные ключи исчезают.
 * Каждое строковое свойство привязано к конечному allowlist или canonical enum;
 * generic token-shaped строки наружу не проходят.
 */
export function sanitizePublicProductAnalyticsDetail(detail: unknown): SanitizedPublicProductAnalyticsEvent | null {
  if (!isRecord(detail)) return null;
  const name = detail.name;
  if (typeof name !== 'string' || !PUBLIC_PRODUCT_ANALYTICS_EVENT_SET.has(name)) return null;

  const properties: PublicProductAnalyticsProperties = {};
  for (const [key, value] of Object.entries(detail)) {
    if (key === 'name') continue;
    const sanitized = sanitizeProperty(key, value);
    if (sanitized !== undefined) properties[key] = sanitized;
  }

  return { name, properties };
}

/** Идентификатор существует только в sessionStorage одной вкладки и не является user identity. */
export function isEphemeralPublicAnalyticsId(value: unknown): value is string {
  return typeof value === 'string' && EPHEMERAL_PUBLIC_ANALYTICS_ID.test(value);
}

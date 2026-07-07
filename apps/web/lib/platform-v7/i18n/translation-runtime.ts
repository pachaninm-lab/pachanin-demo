import embeddedPayload from '@/public/platform-v7/i18n/dictionaries.json';
import { LOCALE_COOKIE } from '@/i18n/locale';

/**
 * Единый рантайм перевода platform-v7.
 *
 * Один источник правды для:
 *  - хранимого языка (localStorage + событие в текущей вкладке + storage между вкладками);
 *  - словарей (встроенный словарь = статический импорт served-файла, поверх — обновления с сервера);
 *  - применения перевода к DOM (текстовые узлы, атрибуты, document.title, html[lang]).
 *
 * Ключевое отличие от прежних реализаций: для каждого узла хранится пара
 * { source, applied }. Если текущее значение узла не совпадает с applied,
 * значит текст изменило приложение (React, копи-нормализаторы) — источник
 * перезахватывается. Это исключает «замораживание» динамического текста и
 * циклические войны нескольких DOM-перезаписчиков.
 */

export type LanguageCode = 'ru' | 'en' | 'zh';
export type TranslatedLanguageCode = Exclude<LanguageCode, 'ru'>;
export type TranslationDictionary = Record<string, string>;
export type DictionarySet = Record<TranslatedLanguageCode, TranslationDictionary>;

export type DictionaryState = {
  version: string;
  updatedAt?: string;
  dictionaries: Partial<DictionarySet>;
};

export const LANGUAGE_STORAGE_KEY = 'pc-v7-language';
export const LANGUAGE_CHANGE_EVENT = 'pc-v7-language-change';
export const DICTIONARY_CACHE_KEY = 'pc-v7-translation-dictionaries-v6';
export const DICTIONARY_UPDATE_URL = '/platform-v7/i18n/dictionaries.json';

const LEGACY_DICTIONARY_CACHE_KEYS = [
  'pc-v7-translation-dictionaries-v1',
  'pc-v7-translation-dictionaries-v2',
  'pc-v7-translation-dictionaries-v3',
  'pc-v7-translation-dictionaries-v4',
  'pc-v7-translation-dictionaries-v5',
] as const;

export const LANGUAGES: ReadonlyArray<{
  code: LanguageCode;
  label: string;
  native: string;
  short: string;
  htmlLang: string;
}> = [
  { code: 'ru', label: 'Русский', native: 'Русский', short: 'RU', htmlLang: 'ru' },
  { code: 'en', label: 'Английский', native: 'English', short: 'EN', htmlLang: 'en' },
  { code: 'zh', label: 'Китайский', native: '中文', short: 'ZH', htmlLang: 'zh-CN' },
];

export const TRANSLATABLE_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'] as const;
export type TranslatableAttribute = (typeof TRANSLATABLE_ATTRIBUTES)[number];

// Узлы внутри этих элементов не переводятся. Экраны с собственной
// локализацией (login, docs, demo, contact, register) помечены
// data-p7-no-translate на корне и исключаются здесь же.
// <option> переводится: текст опции — обычный текстовый узел, атрибут value
// не затрагивается, поэтому выпадающие списки безопасны для словарного слоя.
const SKIP_TEXT_SELECTOR =
  'script,style,noscript,svg,canvas,textarea,input,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]';
const SKIP_ATTRIBUTE_SELECTOR =
  'script,style,noscript,svg,canvas,.p7-translator-root,[data-p7-no-translate]';

const CYRILLIC_RE = /[А-Яа-яЁё]/;
const LATIN_RE = /[A-Za-z]/;
const MAX_FRAGMENT_SOURCE_LENGTH = 600;
const STRICT_FRAGMENT_FALLBACK = true;

// Короткие ключи, которым разрешена подстановка внутрь составных строк,
// даже если сами по себе они короче общего порога.
const SAFE_FRAGMENT_KEYS = new Set([
  'Главный риск сделки',
  'начинается после',
  'согласования цены',
  'Подключить организацию',
  'Демонстрационная сделка',
  'Направить обращение',
  'Под удержанием',
  'Следующее действие',
  'Ответственный',
  'Главный блокер',
  'Деньги под риском',
  'Прозрачная Цена',
]);

// Служебные слова-связки: единственные короткие (1–3 символа) ключи, которым
// разрешена пофрагментная подстановка. Их переводы заданы в словаре (с → with,
// а не «секунды»). Границы по кириллице исключают срабатывание внутри слов.
const FUNCTION_WORD_FRAGMENTS = new Set([
  'в', 'и', 'с', 'к', 'у', 'о', 'на', 'не', 'из', 'за', 'от', 'по', 'до', 'что', 'как', 'или', 'а', 'но', 'же', 'это', 'для',
]);

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function isLanguageCode(value: unknown): value is LanguageCode {
  return value === 'ru' || value === 'en' || value === 'zh';
}

export function getLanguageMeta(code: LanguageCode) {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function cleanDictionary(value: unknown): TranslationDictionary {
  if (!isRecord(value)) return {};
  const result: TranslationDictionary = {};
  Object.entries(value).forEach(([source, translated]) => {
    const key = normalizeText(source);
    if (!key || key.length > 500) return;
    if (typeof translated !== 'string') return;
    const next = translated.trim();
    if (!next || next.length > 1000) return;
    result[key] = next;
  });
  return result;
}

export function normalizePayload(value: unknown): DictionaryState | null {
  if (!isRecord(value) || !isRecord(value.dictionaries)) return null;
  const en = cleanDictionary(value.dictionaries.en);
  const zh = cleanDictionary(value.dictionaries.zh);
  if (!Object.keys(en).length && !Object.keys(zh).length) return null;
  return {
    version: typeof value.version === 'string' ? value.version : 'unversioned',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
    dictionaries: { en, zh },
  };
}

const EMBEDDED_STATE: DictionaryState = normalizePayload(embeddedPayload) ?? {
  version: 'embedded-empty',
  dictionaries: { en: {}, zh: {} },
};

export function getEmbeddedDictionaryState(): DictionaryState {
  return EMBEDDED_STATE;
}

export function buildDictionaries(remote: DictionaryState | null): DictionarySet {
  return {
    en: { ...(EMBEDDED_STATE.dictionaries.en ?? {}), ...(remote?.dictionaries.en ?? {}) },
    zh: { ...(EMBEDDED_STATE.dictionaries.zh ?? {}), ...(remote?.dictionaries.zh ?? {}) },
  };
}

// ---------------------------------------------------------------------------
// Хранимый язык
// ---------------------------------------------------------------------------

export function readStoredLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'ru';
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguageCode(stored) ? stored : 'ru';
  } catch {
    return 'ru';
  }
}

export function readLocaleCookie(): LanguageCode | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
    const value = match ? decodeURIComponent(match[1]) : null;
    return isLanguageCode(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLocaleCookie(language: LanguageCode): void {
  if (typeof document === 'undefined') return;
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${LOCALE_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  } catch {
  }
}

export function writeStoredLanguage(language: LanguageCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorage может быть недоступен (private mode) — язык проживёт сессию в памяти.
  }
  // SSR-локаль (next-intl, apps/web/i18n/request.ts) держится в синхроне с выбором.
  writeLocaleCookie(language);
  window.dispatchEvent(new CustomEvent<LanguageCode>(LANGUAGE_CHANGE_EVENT, { detail: language }));
}

export function subscribeToLanguageChanges(listener: (language: LanguageCode) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onLocalChange = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isLanguageCode(detail)) listener(detail);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === LANGUAGE_STORAGE_KEY) listener(readStoredLanguage());
  };
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onLocalChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onLocalChange);
    window.removeEventListener('storage', onStorage);
  };
}

// ---------------------------------------------------------------------------
// Кэш словарей
// ---------------------------------------------------------------------------

export function clearLegacyDictionaryCache(): void {
  if (typeof window === 'undefined') return;
  try {
    LEGACY_DICTIONARY_CACHE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
  }
}

export function readCachedDictionaryState(): DictionaryState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DICTIONARY_CACHE_KEY);
    return raw ? normalizePayload(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeCachedDictionaryState(state: DictionaryState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DICTIONARY_CACHE_KEY, JSON.stringify(state));
  } catch {
  }
}

export async function fetchRemoteDictionaryState(): Promise<DictionaryState | null> {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(DICTIONARY_UPDATE_URL, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload = normalizePayload(await response.json());
    if (!payload) return null;
    writeCachedDictionaryState(payload);
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Перевод значений
// ---------------------------------------------------------------------------

type FragmentEntry = readonly [string, string];
const fragmentEntryCache = new WeakMap<TranslationDictionary, FragmentEntry[]>();

function allowFragment(key: string): boolean {
  if (SAFE_FRAGMENT_KEYS.has(key)) return true;
  if (FUNCTION_WORD_FRAGMENTS.has(key)) return true;
  // Отдельные кириллические слова/аббревиатуры допустимы: замена идёт с
  // lookaround-границами по кириллице, поэтому подстрочные совпадения исключены.
  if (/^[А-Яа-яЁё-]+$/.test(key)) return key.length >= 2;
  if (key.length < 6) return false;
  return /[\s·→/—,:;«»()]/.test(key);
}

function getFragmentEntries(dictionary: TranslationDictionary): FragmentEntry[] {
  let entries = fragmentEntryCache.get(dictionary);
  if (!entries) {
    entries = Object.entries(dictionary)
      .filter(([key]) => allowFragment(key))
      .sort((a, b) => b[0].length - a[0].length);
    fragmentEntryCache.set(dictionary, entries);
  }
  return entries;
}

// Структурные правила для «данных»: даты, единицы измерения, числовые
// подписи. ВАЖНО: \b в JS не работает с кириллицей, поэтому границы задаются
// lookaround'ами по кириллическим буквам.
const STRUCTURED_TOKENS: ReadonlyArray<readonly [RegExp, string, string]> = [
  [/(?<![А-Яа-яЁё])янв\.?(?![А-Яа-яЁё])/gi, 'Jan', '1月'], [/(?<![А-Яа-яЁё])фев\.?(?![А-Яа-яЁё])/gi, 'Feb', '2月'],
  [/(?<![А-Яа-яЁё])мар\.(?![А-Яа-яЁё])/gi, 'Mar', '3月'], [/(?<![А-Яа-яЁё])апр\.?(?![А-Яа-яЁё])/gi, 'Apr', '4月'],
  [/(?<![А-Яа-яЁё])ма[йя](?![А-Яа-яЁё])/gi, 'May', '5月'], [/(?<![А-Яа-яЁё])июн\.?(?![А-Яа-яЁё])/gi, 'Jun', '6月'],
  [/(?<![А-Яа-яЁё])июл\.?(?![А-Яа-яЁё])/gi, 'Jul', '7月'], [/(?<![А-Яа-яЁё])авг\.?(?![А-Яа-яЁё])/gi, 'Aug', '8月'],
  [/(?<![А-Яа-яЁё])сен\.(?![А-Яа-яЁё])/gi, 'Sep', '9月'], [/(?<![А-Яа-яЁё])окт\.?(?![А-Яа-яЁё])/gi, 'Oct', '10月'],
  [/(?<![А-Яа-яЁё])ноя\.?(?![А-Яа-яЁё])/gi, 'Nov', '11月'], [/(?<![А-Яа-яЁё])дек\.(?![А-Яа-яЁё])/gi, 'Dec', '12月'],
  [/(?<![А-Яа-яЁё])млрд\.?(?![А-Яа-яЁё])/gi, 'bn', '十亿'], [/(?<![А-Яа-яЁё])млн\.?(?![А-Яа-яЁё])/gi, 'mln', '百万'],
  [/(?<![А-Яа-яЁё])тыс\.?(?![А-Яа-яЁё])/gi, 'K', '千'], [/(?<![А-Яа-яЁё])руб\.?(?![А-Яа-яЁё])/gi, '₽', '₽'],
  [/(?<![А-Яа-яЁё])коп\.?(?![А-Яа-яЁё])/gi, 'kop.', '戈比'],
  [/(?<![А-Яа-яЁё])т\/сут(?![А-Яа-яЁё])/gi, 't/day', '吨/日'], [/₽\/т(?![А-Яа-яЁё])/gi, '₽/t', '₽/吨'],
  [/(?<![А-Яа-яЁё])р\/т(?![А-Яа-яЁё])/gi, '₽/t', '₽/吨'],
  [/(?<![А-Яа-яЁё])км\/ч(?![А-Яа-яЁё])/gi, 'km/h', '公里/小时'],
  [/(?<![А-Яа-яЁё])га(?![А-Яа-яЁё])/g, 'ha', '公顷'], [/(?<![А-Яа-яЁё])км(?![А-Яа-яЁё])/gi, 'km', '公里'],
  [/(?<![А-Яа-яЁё])сек\.?(?![А-Яа-яЁё])/gi, 's', '秒'], [/(?<![А-Яа-яЁё])мин\.?(?![А-Яа-яЁё])/gi, 'min', '分钟'],
  [/(?<![А-Яа-яЁё])мес\.?(?![А-Яа-яЁё])/gi, 'mo', '个月'], [/(?<![А-Яа-яЁё])шт\.?(?![А-Яа-яЁё])/gi, 'pcs', '件'],
  [/(?<![А-Яа-яЁё])мс(?![А-Яа-яЁё])/g, 'ms', '毫秒'], [/(?<![А-Яа-яЁё])дн(?:\.|(?![А-Яа-яЁё]))/gi, 'd', '天'],
  [/(\d)\s*т(?![А-Яа-яЁё])/g, '$1 t', '$1 吨'], [/(\d)\s*ч(?![А-Яа-яЁё])/g, '$1 h', '$1 小时'],
  [/(?<![А-Яа-яЁё])п\.п(?:\.|(?![А-Яа-яЁё]))/gi, 'pp', '个百分点'], [/(?<![А-Яа-яЁё])кл(?![А-Яа-яЁё])/gi, 'cl', '等级'],
  [/(?<![А-Яа-яЁё])назад(?![А-Яа-яЁё])/gi, 'ago', '前'],
  // Дни недели (в метках графиков вида «Вс, Н1: 0 событий»).
  [/(?<![А-Яа-яЁё])Пн(?![А-Яа-яЁё])/g, 'Mon', '周一'], [/(?<![А-Яа-яЁё])Вт(?![А-Яа-яЁё])/g, 'Tue', '周二'],
  [/(?<![А-Яа-яЁё])Ср(?![А-Яа-яЁё])/g, 'Wed', '周三'], [/(?<![А-Яа-яЁё])Чт(?![А-Яа-яЁё])/g, 'Thu', '周四'],
  [/(?<![А-Яа-яЁё])Пт(?![А-Яа-яЁё])/g, 'Fri', '周五'], [/(?<![А-Яа-яЁё])Сб(?![А-Яа-яЁё])/g, 'Sat', '周六'],
  [/(?<![А-Яа-яЁё])Вс(?![А-Яа-яЁё])/g, 'Sun', '周日'],
  [/(?<![А-Яа-яЁё])событий(?![А-Яа-яЁё])/gi, 'events', '事件'],
  [/(?<![А-Яа-яЁё])события(?![А-Яа-яЁё])/gi, 'events', '事件'],
  [/(?<![А-Яа-яЁё])событие(?![А-Яа-яЁё])/gi, 'event', '事件'],
  [/(?<![А-Яа-яЁё])Н(?=\d)/g, 'W', '第'],
  // Аббревиатуры законов и регуляторов.
  [/(?<![А-Яа-яЁё])ФЗ(?![А-Яа-яЁё])/g, 'FZ', '联邦法'], [/(?<![А-Яа-яЁё])ЦБ РФ(?![А-Яа-яЁё])/g, 'CBR', '俄罗斯央行'],
  [/(?<![А-Яа-яЁё])РФ(?![А-Яа-яЁё])/g, 'RF', '俄罗斯'], [/(?<![А-Яа-яЁё])п\.(?=\d)/g, 'cl.', '第'],
  [/(?<![А-Яа-яЁё])г\/л(?![А-Яа-яЁё])/gi, 'g/l', '克/升'],
  [/(?<![А-Яа-яЁё])БВ(?![А-Яа-яЁё])/g, 'BV', 'BV'], [/(?<![А-Яа-яЁё])ГУ(?![А-Яа-яЁё])/g, 'GU', 'GU'],
  // Составные аббревиатуры — до одиночных, чтобы не разбить их пословно.
  [/(?<![А-Яа-яЁё])ТР ТС(?![А-Яа-яЁё])/g, 'TR CU', '海关联盟技术规程'], [/(?<![А-Яа-яЁё])ж\/д(?![А-Яа-яЁё])/gi, 'rail', '铁路'],
  // Проперноуны и единицы после числа. Одиночные буквы-предлоги (в/и/с/у/т)
  // токенами НЕ переводятся — иначе «с лотом» стало бы «секунды лотом».
  // Связочные слова покрываются словарём пофрагментно.
  [/(?<![А-Яа-яЁё])Яндекс(?![а-яё])/g, 'Yandex', 'Yandex'], [/(?<![А-Яа-яЁё])Фокус(?![а-яё])/g, 'Focus', 'Focus'],
  [/(?<![А-Яа-яЁё])отправк[иа](?![А-Яа-яЁё])/gi, 'shipments', '发运'], [/(?<![А-Яа-яЁё])отправок(?![А-Яа-яЁё])/gi, 'shipments', '发运'],
  [/(?<![А-Яа-яЁё])Телематика(?![а-яё])/g, 'Telematics', '车载定位'], [/(?<![А-Яа-яЁё])Карты(?![а-яё])/g, 'Maps', '地图'],
  // Секунды: «30 с» (после числа, НЕ перед кириллическим словом — иначе это
  // предлог «с» = with, обрабатываемый словарём).
  [/(\d)\s*с(?!\s*[А-Яа-яЁёA-Za-z])/g, '$1 s', '$1 秒'],
  // Единица «т» в шаблонных подписях («т · SDIZ:») и после слэша («$/т»).
  [/(?<![А-Яа-яЁё])т(?=\s*[·:])/g, 't', '吨'], [/(?<=[/$])т(?![А-Яа-яЁё])/g, 't', '吨'],
];

// Русские буквы, имеющие латинские начертания-двойники (для автономеров,
// маскированных кодов и идентификаторов вида «А234-ВС-68», «ТС А•••ВС•••»).
const PLATE_TRANSLIT: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X',
};
// Код-подобный токен: заглавные буквы/цифры/маски, где есть и латино-двойник, и
// цифра или символ маски. Реальные слова так не выглядят, поэтому транслитерация
// безопасна и не задевает словарные термины.
const CODE_TOKEN_RE = /(?<![А-Яа-яЁёA-Za-z])(?=[^\s]*[АВЕКМНОРСТУХ])(?=[^\s]*[\d•*])[АВЕКМНОРСТУХA-Z0-9•*.\-]{2,}(?![А-Яа-яЁёa-z])/g;

function transliterateCodes(value: string): string {
  return value.replace(CODE_TOKEN_RE, (token) =>
    token.replace(/[АВЕКМНОРСТУХ]/g, (ch) => PLATE_TRANSLIT[ch] ?? ch),
  );
}

function applyStructuredTokens(value: string, language: TranslatedLanguageCode): string {
  const column = language === 'en' ? 1 : 2;
  let next = value;
  // Токен-правила (дни/недели/единицы/аббревиатуры) — до транслитерации кодов,

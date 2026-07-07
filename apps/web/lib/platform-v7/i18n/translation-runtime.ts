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
export const DICTIONARY_CACHE_KEY = 'pc-v7-translation-dictionaries-v5';
export const DICTIONARY_UPDATE_URL = '/platform-v7/i18n/dictionaries.json';

const LEGACY_DICTIONARY_CACHE_KEYS = [
  'pc-v7-translation-dictionaries-v1',
  'pc-v7-translation-dictionaries-v2',
  'pc-v7-translation-dictionaries-v3',
  'pc-v7-translation-dictionaries-v4',
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

const SKIP_TEXT_SELECTOR =
  'script,style,noscript,svg,canvas,textarea,input,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]';
const SKIP_ATTRIBUTE_SELECTOR =
  'script,style,noscript,svg,canvas,.p7-translator-root,[data-p7-no-translate]';

const CYRILLIC_RE = /[А-Яа-яЁё]/;
const MAX_FRAGMENT_SOURCE_LENGTH = 600;

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
  }
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

function allowFragment(key: string): boolean {
  if (SAFE_FRAGMENT_KEYS.has(key)) return true;
  if (FUNCTION_WORD_FRAGMENTS.has(key)) return true;
  if (/^[А-Яа-яЁё-]+$/.test(key)) return key.length >= 2;
  if (key.length < 6) return false;
  return /[\s·→/—,:;«»()]/.test(key);
}

type FragmentEntry = readonly [string, string];
const fragmentEntryCache = new WeakMap<TranslationDictionary, FragmentEntry[]>();

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

const STRUCTURED_TOKENS: ReadonlyArray<readonly [RegExp, string, string]> = [];
const PLATE_TRANSLIT: Record<string, string> = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X' };
const CODE_TOKEN_RE = /(?<![А-Яа-яЁёA-Za-z])(?=[^\s]*[АВЕКМНОРСТУХ])(?=[^\s]*[\d•*])[АВЕКМНОРСТУХA-Z0-9•*.\-]{2,}(?![А-Яа-яЁёa-z])/g;

function transliterateCodes(value: string): string {
  return value.replace(CODE_TOKEN_RE, (token) => token.replace(/[АВЕКМНОРСТУХ]/g, (ch) => PLATE_TRANSLIT[ch] ?? ch));
}

function applyStructuredTokens(value: string, _language: TranslatedLanguageCode): string {
  return transliterateCodes(value);
}

const fragmentRegexCache = new Map<string, RegExp>();
function fragmentRegex(fragment: string): RegExp {
  let re = fragmentRegexCache.get(fragment);
  if (!re) {
    const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`(?<![А-Яа-яЁё])${escaped}(?![А-Яа-яЁё])`, 'g');
    fragmentRegexCache.set(fragment, re);
  }
  return re;
}

export function translateValue(source: string, language: LanguageCode, dictionaries: DictionarySet): string {
  if (language === 'ru') return source;
  const raw = source ?? '';
  const key = normalizeText(raw);
  if (!key) return raw;
  const dictionary = dictionaries[language];
  const exact = dictionary[key];
  if (exact) {
    const leading = raw.match(/^\s*/)?.[0] ?? '';
    const trailing = raw.length > leading.length ? raw.match(/\s*$/)?.[0] ?? '' : '';
    return `${leading}${exact}${trailing}`;
  }
  if (!CYRILLIC_RE.test(raw) || raw.length > MAX_FRAGMENT_SOURCE_LENGTH) return raw;
  const affix = key.match(/^([^А-Яа-яЁёA-Za-z0-9]*)([\s\S]*?)([^А-Яа-яЁёA-Za-z0-9]*)$/);
  if (affix && affix[2]) {
    const core = dictionary[affix[2]];
    if (core) return `${affix[1]}${core}${affix[3]}`;
  }
  let next = applyStructuredTokens(raw, language);
  if (!CYRILLIC_RE.test(next)) return next;
  for (const [from, to] of getFragmentEntries(dictionary)) {
    if (next.includes(from)) next = next.replace(fragmentRegex(from), to);
  }
  return next;
}

type NodeTranslationState = { source: string; applied: string };
const textStates = new WeakMap<Text, NodeTranslationState>();
const attributeStates = new WeakMap<Element, Partial<Record<TranslatableAttribute, NodeTranslationState>>>();
let titleState: NodeTranslationState | null = null;

function shouldSkipTextElement(element: Element): boolean { return Boolean(element.closest(SKIP_TEXT_SELECTOR)); }
function shouldSkipAttributeElement(element: Element): boolean { return Boolean(element.closest(SKIP_ATTRIBUTE_SELECTOR)); }

function collectTextNodes(root: ParentNode): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const element = node.parentElement;
      if (!element || shouldSkipTextElement(element)) return NodeFilter.FILTER_REJECT;
      if (!normalizeText(node.nodeValue ?? '')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function applyTextNodeTranslation(node: Text, language: LanguageCode, dictionaries: DictionarySet): void {
  const current = node.nodeValue ?? '';
  let state = textStates.get(node);
  if (!state || state.applied !== current) state = { source: current, applied: current };
  const next = translateValue(state.source, language, dictionaries);
  state.applied = next;
  textStates.set(node, state);
  if (current !== next) node.nodeValue = next;
}

function applyAttributeTranslation(element: Element, language: LanguageCode, dictionaries: DictionarySet): void {
  const states = attributeStates.get(element) ?? {};
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    if (!element.hasAttribute(attribute)) continue;
    const current = element.getAttribute(attribute) ?? '';
    if (!current) continue;
    let state = states[attribute];
    if (!state || state.applied !== current) state = { source: current, applied: current };
    const next = translateValue(state.source, language, dictionaries);
    state.applied = next;
    states[attribute] = state;
    if (current !== next) element.setAttribute(attribute, next);
  }
  attributeStates.set(element, states);
}

function applyTitleTranslation(language: LanguageCode, dictionaries: DictionarySet): void {
  const current = document.title;
  if (!current) return;
  if (!titleState || titleState.applied !== current) titleState = { source: current, applied: current };
  const next = translateValue(titleState.source, language, dictionaries);
  titleState.applied = next;
  if (current !== next) document.title = next;
}

export function applyTranslationToDom(language: LanguageCode, dictionaries: DictionarySet, root: ParentNode & Node = document.body): void {
  if (typeof document === 'undefined' || !root) return;
  const meta = getLanguageMeta(language);
  document.documentElement.lang = meta.htmlLang;
  document.documentElement.dataset.p7Language = language;
  document.documentElement.setAttribute('translate', 'no');
  document.body?.setAttribute('translate', 'no');
  document.documentElement.classList.add('notranslate');
  document.body?.classList.add('notranslate');
  applyTitleTranslation(language, dictionaries);
  collectTextNodes(root).forEach((node) => applyTextNodeTranslation(node, language, dictionaries));
  const attributeSelector = TRANSLATABLE_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(',');
  root.querySelectorAll(attributeSelector).forEach((element) => {
    if (shouldSkipAttributeElement(element)) return;
    applyAttributeTranslation(element, language, dictionaries);
  });
}

export function startTranslationObserver(getLanguage: () => LanguageCode, getDictionaries: () => DictionarySet): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  let frame = 0;
  const run = () => applyTranslationToDom(getLanguage(), getDictionaries());
  const schedule = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(run);
  };
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...TRANSLATABLE_ATTRIBUTES] });
  return () => {
    window.cancelAnimationFrame(frame);
    observer.disconnect();
  };
}

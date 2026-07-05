import embeddedPayload from '@/public/platform-v7/i18n/dictionaries.json';

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

// Узлы внутри этих элементов не переводятся. Экраны с собственной
// локализацией (login, docs, demo, contact, register) помечены
// data-p7-no-translate на корне и исключаются здесь же.
const SKIP_TEXT_SELECTOR =
  'script,style,noscript,svg,canvas,textarea,input,select,option,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]';
const SKIP_ATTRIBUTE_SELECTOR =
  'script,style,noscript,svg,canvas,.p7-translator-root,[data-p7-no-translate]';

const CYRILLIC_RE = /[А-Яа-яЁё]/;
const MAX_FRAGMENT_SOURCE_LENGTH = 600;

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

export function writeStoredLanguage(language: LanguageCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorage может быть недоступен (private mode) — язык проживёт сессию в памяти.
  }
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
  if (key.length < 8) return false;
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
  let next = raw;
  for (const [from, to] of getFragmentEntries(dictionary)) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Применение к DOM
// ---------------------------------------------------------------------------

type NodeTranslationState = { source: string; applied: string };

const textStates = new WeakMap<Text, NodeTranslationState>();
const attributeStates = new WeakMap<Element, Partial<Record<TranslatableAttribute, NodeTranslationState>>>();
let titleState: NodeTranslationState | null = null;

function shouldSkipTextElement(element: Element): boolean {
  return Boolean(element.closest(SKIP_TEXT_SELECTOR));
}

function shouldSkipAttributeElement(element: Element): boolean {
  return Boolean(element.closest(SKIP_ATTRIBUTE_SELECTOR));
}

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
  // Внешнее изменение (React, нормализаторы копий) — перезахватываем источник.
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

export function applyTranslationToDom(
  language: LanguageCode,
  dictionaries: DictionarySet,
  root: ParentNode & Node = document.body,
): void {
  if (typeof document === 'undefined' || !root) return;
  const meta = getLanguageMeta(language);
  document.documentElement.lang = meta.htmlLang;
  document.documentElement.dataset.p7Language = language;
  applyTitleTranslation(language, dictionaries);
  collectTextNodes(root).forEach((node) => applyTextNodeTranslation(node, language, dictionaries));
  const attributeSelector = TRANSLATABLE_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(',');
  const scope: ParentNode = root;
  scope.querySelectorAll(attributeSelector).forEach((element) => {
    if (shouldSkipAttributeElement(element)) return;
    applyAttributeTranslation(element, language, dictionaries);
  });
}

/**
 * Наблюдатель, поддерживающий перевод при изменениях DOM. Возвращает функцию
 * остановки. Собственные записи движка сходятся за один дополнительный проход:
 * повторное применение не меняет DOM (applied совпадает) и цикл затухает.
 */
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
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
  });
  return () => {
    window.cancelAnimationFrame(frame);
    observer.disconnect();
  };
}

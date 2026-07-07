import embeddedPayload from '@/public/platform-v7/i18n/dictionaries.json';

export type LanguageCode = 'ru' | 'en' | 'zh';
export type TranslatedLanguageCode = Exclude<LanguageCode, 'ru'>;
export type TranslationDictionary = Record<string, string>;
export type DictionarySet = Record<TranslatedLanguageCode, TranslationDictionary>;
export type DictionaryState = { version: string; updatedAt?: string; dictionaries: Partial<DictionarySet> };

export const LANGUAGE_STORAGE_KEY = 'pc-v7-language';
export const LANGUAGE_CHANGE_EVENT = 'pc-v7-language-change';
export const DICTIONARY_CACHE_KEY = 'pc-v7-translation-dictionaries-v6';
export const DICTIONARY_UPDATE_URL = '/platform-v7/i18n/dictionaries.json';
export const TRANSLATABLE_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'] as const;
export type TranslatableAttribute = (typeof TRANSLATABLE_ATTRIBUTES)[number];

export const LANGUAGES: ReadonlyArray<{ code: LanguageCode; label: string; native: string; short: string; htmlLang: string }> = [
  { code: 'ru', label: 'Русский', native: 'Русский', short: 'RU', htmlLang: 'ru' },
  { code: 'en', label: 'Английский', native: 'English', short: 'EN', htmlLang: 'en' },
  { code: 'zh', label: 'Китайский', native: '中文', short: 'ZH', htmlLang: 'zh-CN' },
];

function dict(value: unknown): TranslationDictionary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: TranslationDictionary = {};
  for (const [key, translated] of Object.entries(value as Record<string, unknown>)) {
    if (typeof translated === 'string' && key.trim() && translated.trim()) output[key.replace(/\s+/g, ' ').trim()] = translated.trim();
  }
  return output;
}

export function normalizeText(value: string): string { return value.replace(/\s+/g, ' ').trim(); }
export function isLanguageCode(value: unknown): value is LanguageCode { return value === 'ru' || value === 'en' || value === 'zh'; }
export function getLanguageMeta(code: LanguageCode) { return LANGUAGES.find((item) => item.code === code) ?? LANGUAGES[0]; }
export function cleanDictionary(value: unknown): TranslationDictionary { return dict(value); }
export function normalizePayload(value: unknown): DictionaryState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const root = value as { version?: unknown; updatedAt?: unknown; dictionaries?: unknown };
  if (!root.dictionaries || typeof root.dictionaries !== 'object' || Array.isArray(root.dictionaries)) return null;
  const dictionaries = root.dictionaries as { en?: unknown; zh?: unknown };
  const en = dict(dictionaries.en);
  const zh = dict(dictionaries.zh);
  if (!Object.keys(en).length && !Object.keys(zh).length) return null;
  return { version: typeof root.version === 'string' ? root.version : 'local', updatedAt: typeof root.updatedAt === 'string' ? root.updatedAt : undefined, dictionaries: { en, zh } };
}

const EMBEDDED_STATE: DictionaryState = normalizePayload(embeddedPayload) ?? { version: 'empty', dictionaries: { en: {}, zh: {} } };
export function getEmbeddedDictionaryState(): DictionaryState { return EMBEDDED_STATE; }
export function buildDictionaries(remote: DictionaryState | null): DictionarySet { return { en: { ...(EMBEDDED_STATE.dictionaries.en ?? {}), ...(remote?.dictionaries.en ?? {}) }, zh: { ...(EMBEDDED_STATE.dictionaries.zh ?? {}), ...(remote?.dictionaries.zh ?? {}) } }; }

export function readStoredLanguage(): LanguageCode { if (typeof window === 'undefined') return 'ru'; try { const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY); return isLanguageCode(stored) ? stored : 'ru'; } catch { return 'ru'; } }
export function readLocaleCookie(): LanguageCode | null { return null; }
export function writeLocaleCookie(_language: LanguageCode): void {}
export function writeStoredLanguage(language: LanguageCode): void { if (typeof window === 'undefined') return; try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch {} window.dispatchEvent(new CustomEvent<LanguageCode>(LANGUAGE_CHANGE_EVENT, { detail: language })); }
export function subscribeToLanguageChanges(listener: (language: LanguageCode) => void): () => void { if (typeof window === 'undefined') return () => {}; const onChange = (event: Event) => { const detail = (event as CustomEvent<unknown>).detail; if (isLanguageCode(detail)) listener(detail); }; window.addEventListener(LANGUAGE_CHANGE_EVENT, onChange); return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, onChange); }
export function clearLegacyDictionaryCache(): void { if (typeof window === 'undefined') return; ['pc-v7-translation-dictionaries-v1','pc-v7-translation-dictionaries-v2','pc-v7-translation-dictionaries-v3','pc-v7-translation-dictionaries-v4','pc-v7-translation-dictionaries-v5'].forEach((key) => { try { window.localStorage.removeItem(key); } catch {} }); }
export function readCachedDictionaryState(): DictionaryState | null { return null; }
export function writeCachedDictionaryState(_state: DictionaryState): void {}
export async function fetchRemoteDictionaryState(): Promise<DictionaryState | null> { return null; }

export function translateValue(source: string, language: LanguageCode, dictionaries: DictionarySet): string {
  if (language === 'ru') return source;
  const key = normalizeText(source ?? '');
  return dictionaries[language][key] ?? source;
}

export function applyTranslationToDom(language: LanguageCode, dictionaries: DictionarySet): void {
  if (typeof document === 'undefined') return;
  const meta = getLanguageMeta(language);
  document.documentElement.lang = meta.htmlLang;
  document.documentElement.dataset.p7Language = language;
  document.documentElement.setAttribute('translate', 'no');
  document.body?.setAttribute('translate', 'no');
  document.documentElement.classList.add('notranslate');
  document.body?.classList.add('notranslate');
  if (language === 'ru') return;
  document.querySelectorAll<HTMLElement>('[data-p7-i18n]').forEach((element) => {
    const source = element.dataset.p7I18n || element.textContent || '';
    const translated = translateValue(source, language, dictionaries);
    if (translated !== source) element.textContent = translated;
  });
}

export function startTranslationObserver(getLanguage: () => LanguageCode, getDictionaries: () => DictionarySet): () => void {
  if (typeof window === 'undefined') return () => {};
  let frame = 0;
  const run = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(() => applyTranslationToDom(getLanguage(), getDictionaries())); };
  run();
  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
}

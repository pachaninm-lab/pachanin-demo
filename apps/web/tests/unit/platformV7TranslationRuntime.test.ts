import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DICTIONARY_CACHE_KEY,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  applyTranslationToDom,
  buildDictionaries,
  cleanDictionary,
  clearLegacyDictionaryCache,
  getEmbeddedDictionaryState,
  isLanguageCode,
  normalizePayload,
  normalizeText,
  readStoredLanguage,
  subscribeToLanguageChanges,
  translateValue,
  writeStoredLanguage,
  type DictionarySet,
} from '@/lib/platform-v7/i18n/translation-runtime';

const dictionaries = buildDictionaries(null);

function resetDom() {
  document.body.innerHTML = '';
  document.title = '';
  document.documentElement.lang = 'ru';
  delete document.documentElement.dataset.p7Language;
}

beforeEach(() => {
  window.localStorage.clear();
  resetDom();
});

afterEach(() => {
  resetDom();
});

describe('embedded dictionaries', () => {
  it('load from the served dictionaries.json with en/zh parity', () => {
    const embedded = getEmbeddedDictionaryState();
    const en = embedded.dictionaries.en ?? {};
    const zh = embedded.dictionaries.zh ?? {};
    expect(Object.keys(en).length).toBeGreaterThan(300);
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  });

  it('cover the role-cockpit strings that previously lived in RoleCockpitI18nGuard', () => {
    for (const key of ['Кабинет продавца', 'Главный блокер', 'Что делать сейчас', 'Открыть сделку']) {
      expect(dictionaries.en[key], `en: ${key}`).toBeTruthy();
      expect(dictionaries.zh[key], `zh: ${key}`).toBeTruthy();
    }
  });

  it('cover the public landing strings from the screenshot flow', () => {
    expect(translateValue('Подключить организацию', 'en', dictionaries)).toBe('Connect an organisation');
    expect(translateValue('Зарегистрироваться', 'zh', dictionaries)).toBe('注册');
    expect(translateValue('Войти', 'en', dictionaries)).toBe('Sign in');
  });
});

describe('translateValue', () => {
  it('returns the source untouched for Russian', () => {
    expect(translateValue('Войти', 'ru', dictionaries)).toBe('Войти');
  });

  it('preserves leading and trailing whitespace on exact matches', () => {
    expect(translateValue('\n  Войти  ', 'en', dictionaries)).toBe('\n  Sign in  ');
  });

  it('matches multi-space sources against normalized keys', () => {
    expect(translateValue('Подключить   организацию', 'en', dictionaries)).toBe('Connect an organisation');
  });

  it('translates composite strings through fragment substitution', () => {
    const composite = 'Раздел: Подключить организацию и продолжить';
    const result = translateValue(composite, 'en', dictionaries);
    expect(result).toContain('Connect an organisation');
    expect(result).not.toContain('Подключить организацию');
  });

  it('keeps unknown non-Cyrillic text untouched', () => {
    expect(translateValue('Hello world', 'en', dictionaries)).toBe('Hello world');
    expect(translateValue('12 500 ₽', 'zh', dictionaries)).toBe('12 500 ₽');
  });

  it('translates data-shaped strings via structured token rules (no per-value dictionary entry)', () => {
    // Метки графика активности: день недели + номер недели + счётчик событий.
    expect(translateValue('Вс, Н1: 0 событий', 'en', dictionaries)).toBe('Sun, W1: 0 events');
    expect(translateValue('Пн, Н8: 12 событий', 'zh', dictionaries)).toBe('周一, 第8: 12 事件');
    // Единицы и даты.
    expect(translateValue('12 мар., 09:01', 'en', dictionaries)).toBe('12 Mar, 09:01');
    expect(translateValue('598,8 т', 'zh', dictionaries)).toBe('598,8 吨');
  });

  it('transliterates plate numbers and masked codes without touching real words', () => {
    expect(translateValue('А234-ВС-68', 'en', dictionaries)).toBe('A234-BC-68');
    expect(translateValue('В123КК52', 'zh', dictionaries)).toBe('B123KK52');
    // Обычное кириллическое слово транслитерации НЕ подвергается.
    expect(translateValue('Водитель', 'en', dictionaries)).toBe('Driver');
  });

  it('handles law and regulator abbreviations', () => {
    expect(translateValue('152-ФЗ', 'en', dictionaries)).toBe('152-FZ');
    expect(translateValue('ЦБ РФ', 'zh', dictionaries)).toBe('俄罗斯央行');
  });
});

describe('applyTranslationToDom', () => {
  function mountSample() {
    document.body.innerHTML = `
      <div id="page">
        <h1>Главный риск сделки</h1>
        <button id="cta" aria-label="Войти" title="Войти">Войти</button>
        <input id="field" placeholder="Логин" />
        <p id="counter">Осталось 5 сек</p>
        <div data-p7-no-translate="true"><span id="locked">Войти</span></div>
      </div>`;
  }

  it('translates text nodes and attributes, then fully restores Russian', () => {
    mountSample();
    applyTranslationToDom('en', dictionaries);
    expect(document.querySelector('h1')?.textContent).toBe('The main transaction risk');
    expect(document.querySelector('#cta')?.textContent).toBe('Sign in');
    expect(document.querySelector('#cta')?.getAttribute('aria-label')).toBe('Sign in');
    expect(document.querySelector('#cta')?.getAttribute('title')).toBe('Sign in');
    expect(document.querySelector('#field')?.getAttribute('placeholder')).toBe('Login');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dataset.p7Language).toBe('en');

    applyTranslationToDom('zh', dictionaries);
    expect(document.querySelector('#cta')?.textContent).toBe('登录');
    expect(document.documentElement.lang).toBe('zh-CN');

    applyTranslationToDom('ru', dictionaries);
    expect(document.querySelector('h1')?.textContent).toBe('Главный риск сделки');
    expect(document.querySelector('#cta')?.textContent).toBe('Войти');
    expect(document.querySelector('#cta')?.getAttribute('aria-label')).toBe('Войти');
    expect(document.querySelector('#field')?.getAttribute('placeholder')).toBe('Логин');
    expect(document.documentElement.lang).toBe('ru');
  });

  it('never touches nodes inside data-p7-no-translate', () => {
    mountSample();
    applyTranslationToDom('en', dictionaries);
    expect(document.querySelector('#locked')?.textContent).toBe('Войти');
  });

  it('re-captures text changed by the app instead of freezing it (dynamic text bug)', () => {
    mountSample();
    const counter = document.querySelector('#counter') as HTMLElement;

    applyTranslationToDom('ru', dictionaries);
    // Приложение (React) обновляет текст напрямую в том же текстовом узле.
    counter.firstChild!.nodeValue = 'Осталось 4 сек';
    applyTranslationToDom('ru', dictionaries);
    expect(counter.textContent).toBe('Осталось 4 сек');
  });

  it('re-captures app updates while a translation is active and restores the NEW source on ru', () => {
    document.body.innerHTML = '<span id="status">Войти</span>';
    const node = document.querySelector('#status')!.firstChild as Text;

    applyTranslationToDom('en', dictionaries);
    expect(node.nodeValue).toBe('Sign in');

    // Приложение меняет строку на другую русскую строку.
    node.nodeValue = 'Зарегистрироваться';
    applyTranslationToDom('en', dictionaries);
    expect(node.nodeValue).toBe('Register');

    applyTranslationToDom('ru', dictionaries);
    expect(node.nodeValue).toBe('Зарегистрироваться');
  });

  it('does not fight external writers: a foreign translation is left in place, not reverted to Russian', () => {
    document.body.innerHTML = '<span id="x">Некоторый нелокализованный текст без словаря</span>';
    const node = document.querySelector('#x')!.firstChild as Text;

    applyTranslationToDom('en', dictionaries);
    const afterFirstPass = node.nodeValue;
    // Другой перезаписчик (копи-нормализатор) кладёт свой текст.
    node.nodeValue = 'External writer text';
    applyTranslationToDom('en', dictionaries);
    expect(node.nodeValue).toBe('External writer text');
    expect(node.nodeValue).not.toBe(afterFirstPass === 'External writer text' ? '' : afterFirstPass);
  });

  it('translates document.title including the brand fragment', () => {
    document.body.innerHTML = '<p>x</p>';
    document.title = 'Сделки · Прозрачная Цена';
    applyTranslationToDom('en', dictionaries);
    expect(document.title).toContain('Transparent Price');
    applyTranslationToDom('ru', dictionaries);
    expect(document.title).toBe('Сделки · Прозрачная Цена');
  });
});

describe('language storage and sync', () => {
  it('falls back to ru on missing or garbage values', () => {
    expect(readStoredLanguage()).toBe('ru');
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    expect(readStoredLanguage()).toBe('ru');
  });

  it('persists the language and notifies same-tab subscribers', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeToLanguageChanges((language) => seen.push(language));
    writeStoredLanguage('zh');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh');
    expect(seen).toEqual(['zh']);
    unsubscribe();
    writeStoredLanguage('en');
    expect(seen).toEqual(['zh']);
  });

  it('exposes the change event contract used by other platform widgets', () => {
    expect(LANGUAGE_CHANGE_EVENT).toBe('pc-v7-language-change');
    expect(isLanguageCode('en')).toBe(true);
    expect(isLanguageCode('xx')).toBe(false);
  });

  it('clears legacy dictionary caches without touching the current one', () => {
    window.localStorage.setItem('pc-v7-translation-dictionaries-v4', '{}');
    window.localStorage.setItem(DICTIONARY_CACHE_KEY, '{"a":1}');
    clearLegacyDictionaryCache();
    expect(window.localStorage.getItem('pc-v7-translation-dictionaries-v4')).toBeNull();
    expect(window.localStorage.getItem(DICTIONARY_CACHE_KEY)).toBe('{"a":1}');
  });
});

describe('dictionary payload validation', () => {
  it('normalizes keys and drops invalid entries', () => {
    const cleaned = cleanDictionary({
      '  Войти  ': 'Sign in',
      'Пусто': '   ',
      'Число': 42,
      '': 'nothing',
    });
    expect(cleaned).toEqual({ 'Войти': 'Sign in' });
  });

  it('rejects payloads without dictionaries', () => {
    expect(normalizePayload(null)).toBeNull();
    expect(normalizePayload({})).toBeNull();
    expect(normalizePayload({ dictionaries: { en: {}, zh: {} } })).toBeNull();
  });

  it('accepts a valid payload and merges it over the embedded dictionary', () => {
    const payload = normalizePayload({
      version: 'test-1',
      dictionaries: { en: { 'Войти': 'Enter (updated)' }, zh: {} },
    });
    expect(payload?.version).toBe('test-1');
    const merged: DictionarySet = buildDictionaries(payload);
    expect(merged.en['Войти']).toBe('Enter (updated)');
    expect(merged.zh['Войти']).toBe(dictionaries.zh['Войти']);
    expect(normalizeText('  a   b  ')).toBe('a b');
  });
});

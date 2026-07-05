'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Languages, RefreshCw, X } from 'lucide-react';

type LanguageCode = 'ru' | 'en' | 'zh';
type TranslatedLanguageCode = Exclude<LanguageCode, 'ru'>;
type TranslationDictionary = Record<string, string>;
type DictionarySet = Record<TranslatedLanguageCode, TranslationDictionary>;
type SourceTextNode = Text & { __p7SourceText?: string };

type DictionaryPayload = {
  version?: string;
  updatedAt?: string;
  dictionaries?: Partial<DictionarySet>;
};

type DictionaryState = {
  version: string;
  updatedAt?: string;
  dictionaries: Partial<DictionarySet>;
};

const STORAGE_KEY = 'pc-v7-language';
const CACHE_KEY = 'pc-v7-translation-dictionaries-v4';
const UPDATE_URL = '/platform-v7/i18n/dictionaries.json';

const HEADER_TARGETS = [
  '.entry-header-actions',
  '.login-header',
  '.login-top',
  '.p7-demo-header-actions',
  '.p7-contact-nav',
  '.p7-contact-fixed-actions',
  '.p7-register-actions',
  '.pc-v4-actions',
] as const;

const LANGUAGES: ReadonlyArray<{ code: LanguageCode; label: string; native: string; short: string; htmlLang: string }> = [
  { code: 'ru', label: 'Русский', native: 'Русский', short: 'RU', htmlLang: 'ru-RU' },
  { code: 'en', label: 'Английский', native: 'English', short: 'EN', htmlLang: 'en' },
  { code: 'zh', label: 'Китайский', native: '中文', short: 'ZH', htmlLang: 'zh-CN' },
];

const UI_COPY: Record<LanguageCode, { button: string; title: string; close: string; current: string; refresh: string }> = {
  ru: { button: 'Перевод', title: 'Переводчик', close: 'Закрыть переводчик', current: 'Текущий язык', refresh: 'Обновить словарь' },
  en: { button: 'Translate', title: 'Translator', close: 'Close translator', current: 'Current language', refresh: 'Update dictionary' },
  zh: { button: '翻译', title: '翻译器', close: '关闭翻译器', current: '当前语言', refresh: '更新词典' },
};

const EMBEDDED_DICTIONARIES: DictionarySet = {
  en: {
    'Прозрачная Цена': 'Transparent Price',
    'Контур исполнения сделки': 'Deal execution circuit',
    'Единый вход в контур исполнения': 'Single entry to the execution circuit',
    'Главный риск сделки': 'The main transaction risk',
    'начинается после': 'starts after',
    'согласования цены': 'the price is agreed',
    'Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.': 'Transparent Price is a digital execution circuit for a grain transaction: trip, acceptance, quality, documents, money, dispute, and evidence in one process.',
    'Подключить организацию': 'Connect an organisation',
    'Разобрать контур сделки': 'Review the deal circuit',
    'Зарегистрироваться': 'Register',
    'Войти': 'Sign in',
    'Назад': 'Back',
    'Задать вопрос': 'Ask a question',
    'Что контролирует платформа': 'What the platform controls',
    'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': 'After price agreement, the key execution points remain under control: trip, acceptance, documents, quality, and payment basis.',
    'Деньги': 'Money',
    'Документы': 'Documents',
    'Логистика': 'Logistics',
    'Качество': 'Quality',
    'Основание для расчёта видно до выпуска оплаты.': 'The settlement basis is visible before payment release.',
    'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ, EDI, transport documents, and acts are linked to deal events.',
    'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': 'Trip, driver, route, and checkpoints are in one circuit.',
    'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': 'Acceptance and laboratory indicators are considered before final settlement.',
    'Как проходит сделка': 'How the deal works',
    'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': 'At each stage it is clear what is confirmed, what requires action, and who owns the next step.',
    'Цена': 'Price',
    'Сделка': 'Deal',
    'Рейс': 'Trip',
    'Приёмка': 'Acceptance',
    'Расчёт': 'Settlement',
    'Спор': 'Dispute',
    'Оператор': 'Operator',
    'Покупатель': 'Buyer',
    'Продавец': 'Seller',
    'Водитель': 'Driver',
    'Элеватор': 'Elevator',
    'Лаборатория': 'Laboratory',
    'Сюрвейер': 'Surveyor',
    'Банк': 'Bank',
    'Комплаенс': 'Compliance',
    'Арбитр': 'Arbitrator',
    'Руководитель': 'Executive',
  },
  zh: {
    'Прозрачная Цена': '透明价格',
    'Контур исполнения сделки': '交易执行闭环',
    'Единый вход в контур исполнения': '进入执行闭环的统一入口',
    'Главный риск сделки': '交易的主要风险',
    'начинается после': '开始于',
    'согласования цены': '价格确认之后',
    'Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.': '透明价格是粮食交易的数字执行闭环：运输、验收、质量、文件、资金、争议和证据都在同一流程中。',
    'Подключить организацию': '接入组织',
    'Разобрать контур сделки': '查看交易闭环',
    'Зарегистрироваться': '注册',
    'Войти': '登录',
    'Назад': '返回',
    'Задать вопрос': '提问',
    'Что контролирует платформа': '平台控制什么',
    'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': '价格确认后，关键事项仍在控制中：运输、验收、文件、质量和付款依据。',
    'Деньги': '资金',
    'Документы': '文件',
    'Логистика': '物流',
    'Качество': '质量',
    'Основание для расчёта видно до выпуска оплаты.': '付款释放前可以看到结算依据。',
    'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ、电子文件流、运输文件和单据与交易事件相连。',
    'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': '运输、司机、路线和检查点处于同一闭环中。',
    'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': '验收和实验室指标在最终结算前被纳入考虑。',
    'Как проходит сделка': '交易流程',
    'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': '每个阶段都能看到已确认事项、待处理事项以及下一步负责人。',
    'Цена': '价格',
    'Сделка': '交易',
    'Рейс': '运输',
    'Приёмка': '验收',
    'Расчёт': '结算',
    'Спор': '争议',
    'Оператор': '运营方',
    'Покупатель': '买方',
    'Продавец': '卖方',
    'Водитель': '司机',
    'Элеватор': '粮仓',
    'Лаборатория': '实验室',
    'Сюрвейер': '检验员',
    'Банк': '银行',
    'Комплаенс': '合规',
    'Арбитр': '仲裁员',
    'Руководитель': '管理层',
  },
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLanguageCode(value: string | null): value is LanguageCode {
  return value === 'ru' || value === 'en' || value === 'zh';
}

function cleanDictionary(value: unknown): TranslationDictionary {
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

function normalizePayload(value: unknown): DictionaryState | null {
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

function readCachedDictionary(): DictionaryState | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? normalizePayload(JSON.parse(raw) as DictionaryPayload) : null;
  } catch {
    return null;
  }
}

function getStoredLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'ru';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLanguageCode(stored) ? stored : 'ru';
}

function getLanguageMeta(code: LanguageCode) {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}

function mergeDictionaries(remote: DictionaryState | null): DictionarySet {
  return {
    en: { ...EMBEDDED_DICTIONARIES.en, ...(remote?.dictionaries.en ?? {}) },
    zh: { ...EMBEDDED_DICTIONARIES.zh, ...(remote?.dictionaries.zh ?? {}) },
  };
}

function translateValue(source: string, language: LanguageCode, dictionaries: DictionarySet) {
  if (language === 'ru') return source;
  const normalized = normalizeText(source);
  return dictionaries[language][normalized] ?? source;
}

function shouldSkipTextElement(element: HTMLElement) {
  return Boolean(
    element.closest(
      'script,style,noscript,svg,canvas,textarea,input,select,option,code,pre,.pc-v7-login-single,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]',
    ),
  );
}

function shouldSkipAttributeElement(element: HTMLElement) {
  return Boolean(element.closest('script,style,noscript,svg,canvas,.pc-v7-login-single,.p7-translator-root,[data-p7-no-translate]'));
}

function collectTextNodes(root: ParentNode) {
  const nodes: SourceTextNode[] = [];
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
    nodes.push(current as SourceTextNode);
    current = walker.nextNode();
  }
  return nodes;
}

function sourceDatasetKey(attribute: 'aria-label' | 'title' | 'placeholder') {
  if (attribute === 'aria-label') return 'p7SourceAriaLabel';
  if (attribute === 'placeholder') return 'p7SourcePlaceholder';
  return 'p7SourceTitle';
}

function applyAttributes(language: LanguageCode, dictionaries: DictionarySet) {
  document.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (shouldSkipAttributeElement(element)) return;
    (['aria-label', 'title', 'placeholder'] as const).forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const key = sourceDatasetKey(attribute);
      const source = element.dataset[key] || element.getAttribute(attribute) || '';
      if (!source) return;
      element.dataset[key] = source;
      const next = translateValue(source, language, dictionaries);
      if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
    });
  });
}

function applyPageTranslation(language: LanguageCode, dictionaries: DictionarySet) {
  const meta = getLanguageMeta(language);
  document.documentElement.lang = meta.htmlLang;
  document.documentElement.dataset.p7Language = language;
  collectTextNodes(document.body).forEach((node) => {
    const source = node.__p7SourceText || node.nodeValue || '';
    node.__p7SourceText = source;
    const next = translateValue(source, language, dictionaries);
    if (node.nodeValue !== next) node.nodeValue = next;
  });
  applyAttributes(language, dictionaries);
}

function findHeaderTarget() {
  for (const selector of HEADER_TARGETS) {
    const target = document.querySelector<Element>(selector);
    if (target) return target;
  }
  return null;
}

export function PlatformTranslator() {
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('ru');
  const [remoteDictionary, setRemoteDictionary] = useState<DictionaryState | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const dictionaries = useMemo(() => mergeDictionaries(remoteDictionary), [remoteDictionary]);
  const activeLanguage = useMemo(() => getLanguageMeta(language), [language]);
  const copy = UI_COPY[language];

  const refreshDictionary = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      setRefreshing(true);
      const url = new URL(UPDATE_URL, window.location.origin);
      if (url.origin !== window.location.origin) return;
      const response = await fetch(url.toString(), {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;
      const payload = normalizePayload(await response.json());
      if (!payload) return;
      setRemoteDictionary(payload);
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    setLanguage(getStoredLanguage());
    const cached = readCachedDictionary();
    if (cached) setRemoteDictionary(cached);
    void refreshDictionary();
  }, [refreshDictionary]);

  useEffect(() => {
    if (!mounted) return;
    const syncTarget = () => setTarget(findHeaderTarget());
    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', syncTarget);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncTarget);
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(STORAGE_KEY, language);
    let scheduled = 0;
    const schedule = () => {
      window.cancelAnimationFrame(scheduled);
      scheduled = window.requestAnimationFrame(() => applyPageTranslation(language, dictionaries));
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      window.cancelAnimationFrame(scheduled);
      observer.disconnect();
    };
  }, [language, dictionaries, mounted]);

  if (!mounted) return null;

  const button = (
    <span className='p7-translator-root p7-translator-slot' data-p7-no-translate='true'>
      <style>{css}</style>
      <button type='button' className='p7-translator-button' onClick={() => setOpen((value) => !value)} aria-label={copy.title} title={copy.title} data-open={open ? 'true' : 'false'}>
        <Languages size={17} strokeWidth={2.45} />
        <span>{copy.button}</span>
        <b>{activeLanguage.short}</b>
      </button>
    </span>
  );

  const panel = open
    ? createPortal(
        <div className='p7-translator-root p7-translator-panel' role='dialog' aria-label={copy.title} data-p7-no-translate='true'>
          <div className='p7-translator-panel-head'>
            <strong>{copy.title}</strong>
            <button type='button' onClick={() => setOpen(false)} aria-label={copy.close} title={copy.close}><X size={16} /></button>
          </div>
          <div className='p7-translator-current'>
            <span>{copy.current}: <b>{activeLanguage.native}</b></span>
            <button type='button' onClick={() => void refreshDictionary()} disabled={refreshing} aria-label={copy.refresh} title={copy.refresh}>
              <RefreshCw size={14} className={refreshing ? 'p7-translator-spin' : undefined} />
            </button>
          </div>
          <div className='p7-translator-list'>
            {LANGUAGES.map((item) => (
              <button key={item.code} type='button' onClick={() => { setLanguage(item.code); setOpen(false); }} data-active={item.code === language ? 'true' : 'false'}>
                <span><strong>{item.native}</strong><small>{item.label}</small></span>
                {item.code === language ? <Check size={16} /> : <em>{item.short}</em>}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {target ? createPortal(button, target) : <div className='p7-translator-root p7-translator-fallback' data-p7-no-translate='true'>{button}</div>}
      {panel}
    </>
  );
}

const css = `
.p7-translator-slot{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;order:60}.p7-translator-button{height:42px;min-width:42px;padding:0 11px;border-radius:14px;border:1px solid rgba(8,122,59,.18);background:rgba(8,122,59,.075);color:#087a3b;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12.5px;font-weight:950;letter-spacing:-.02em;white-space:nowrap;cursor:pointer;box-shadow:0 8px 20px rgba(7,22,17,.045)}.p7-translator-button:hover{border-color:rgba(8,122,59,.28);background:rgba(8,122,59,.11)}.p7-translator-button b{min-width:25px;height:24px;padding:0 5px;border-radius:999px;background:rgba(255,255,255,.76);display:inline-flex;align-items:center;justify-content:center;color:#075f32;font-size:10.5px;font-weight:950}.pc-v4-actions .p7-translator-button{height:44px;min-width:44px;border-radius:14px;background:var(--pc-bg-card);border-color:var(--pc-border);color:var(--pc-text-secondary);box-shadow:var(--pc-shadow-sm)}.pc-v4-actions .p7-translator-button:hover{color:var(--pc-text-primary);border-color:var(--pc-border-light)}.pc-v4-actions .p7-translator-button span{display:none}.pc-v4-actions .p7-translator-button b{background:var(--pc-accent-bg);color:var(--pc-accent-strong)}.login-top .p7-translator-slot{margin-left:auto}.login-top .p7-translator-button{height:42px}.p7-register-actions .p7-translator-button,.p7-contact-fixed-actions .p7-translator-button,.entry-header-actions .p7-translator-button,.login-header .p7-translator-button,.p7-demo-header-actions .p7-translator-button,.p7-contact-nav .p7-translator-button{height:42px}.p7-translator-fallback{position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 12px);z-index:3600}.p7-translator-panel{position:fixed;right:14px;top:calc(env(safe-area-inset-top) + 72px);z-index:3700;width:min(370px,calc(100vw - 28px));padding:14px;border-radius:22px;border:1px solid rgba(7,22,17,.12);background:rgba(255,255,255,.98);box-shadow:0 22px 70px rgba(7,22,17,.16);backdrop-filter:blur(18px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#071611;display:grid;gap:12px}.p7-translator-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.p7-translator-panel-head strong{font-size:16px;font-weight:950;letter-spacing:-.03em}.p7-translator-panel-head button,.p7-translator-current button{width:36px;height:36px;border-radius:13px;border:1px solid rgba(7,22,17,.1);background:#fff;color:#071611;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.p7-translator-current{padding:10px 11px;border-radius:15px;background:rgba(8,122,59,.07);border:1px solid rgba(8,122,59,.14);font-size:12.5px;color:#526173;display:flex;align-items:center;justify-content:space-between;gap:10px}.p7-translator-current b{color:#087a3b}.p7-translator-current button:disabled{opacity:.55;cursor:wait}.p7-translator-list{display:grid;gap:7px}.p7-translator-list button{min-height:48px;padding:8px 10px;border-radius:15px;border:1px solid rgba(7,22,17,.09);background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#071611;cursor:pointer;text-align:left}.p7-translator-list button[data-active='true']{border-color:rgba(8,122,59,.28);background:rgba(8,122,59,.075)}.p7-translator-list button span{display:grid;gap:2px}.p7-translator-list button strong{font-size:13.5px;font-weight:930}.p7-translator-list button small{font-size:11.5px;color:#66758a}.p7-translator-list button em{font-style:normal;font-size:11px;font-weight:950;color:#66758a}.p7-translator-list button svg{color:#087a3b}.p7-translator-root *{box-sizing:border-box}.p7-translator-spin{animation:p7-translator-spin .8s linear infinite}@keyframes p7-translator-spin{to{transform:rotate(360deg)}}@media(max-width:640px){.p7-translator-button{height:40px;min-width:40px;padding:0 9px;border-radius:13px}.p7-translator-button span{display:none}.p7-translator-button b{min-width:23px;height:22px;font-size:10px}.pc-v4-actions .p7-translator-button{height:38px;min-width:38px;padding:0 7px}.pc-v4-actions .p7-translator-button b{display:none}.entry-header-actions .p7-translator-button,.login-header .p7-translator-button,.p7-demo-header-actions .p7-translator-button,.p7-contact-nav .p7-translator-button,.p7-register-actions .p7-translator-button,.p7-contact-fixed-actions .p7-translator-button{width:40px;padding:0}.entry-header-actions .p7-translator-button b,.login-header .p7-translator-button b,.p7-demo-header-actions .p7-translator-button b,.p7-contact-nav .p7-translator-button b,.p7-register-actions .p7-translator-button b,.p7-contact-fixed-actions .p7-translator-button b{display:none}.p7-translator-panel{left:10px;right:10px;top:calc(env(safe-area-inset-top) + 64px);width:auto;border-radius:20px}}@media(max-width:374px){.pc-v4-actions .p7-translator-button{height:34px;min-width:34px;border-radius:12px}.pc-v4-actions .p7-translator-button svg{width:15px;height:15px}}
`;

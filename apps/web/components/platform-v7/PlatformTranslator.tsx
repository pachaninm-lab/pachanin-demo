'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Languages, X } from 'lucide-react';

type LanguageCode = 'ru' | 'en' | 'tr' | 'kk' | 'uz' | 'zh';
type TranslationDictionary = Record<string, string>;
type SourceTextNode = Text & { __p7SourceText?: string };

const STORAGE_KEY = 'pc-v7-language';
const HEADER_TARGETS = [
  '.p7-contact-fixed-actions',
  '.p7-register-actions',
  '.pc-v4-actions',
  '.entry-header-actions',
  '.login-top',
] as const;

const LANGUAGES: ReadonlyArray<{ code: LanguageCode; label: string; native: string; short: string; htmlLang: string }> = [
  { code: 'ru', label: 'Русский', native: 'Русский', short: 'RU', htmlLang: 'ru-RU' },
  { code: 'en', label: 'Английский', native: 'English', short: 'EN', htmlLang: 'en' },
  { code: 'tr', label: 'Турецкий', native: 'Türkçe', short: 'TR', htmlLang: 'tr' },
  { code: 'kk', label: 'Казахский', native: 'Қазақша', short: 'KZ', htmlLang: 'kk' },
  { code: 'uz', label: 'Узбекский', native: 'O‘zbekcha', short: 'UZ', htmlLang: 'uz' },
  { code: 'zh', label: 'Китайский', native: '中文', short: 'ZH', htmlLang: 'zh-CN' },
];

const UI_COPY: Record<LanguageCode, { button: string; title: string; subtitle: string; legal: string; close: string; current: string }> = {
  ru: {
    button: 'Перевод',
    title: 'Переводчик',
    subtitle: 'Язык интерфейса и сделочных терминов',
    legal: 'Справочный перевод. Оригинал остаётся юридическим источником.',
    close: 'Закрыть переводчик',
    current: 'Текущий язык',
  },
  en: {
    button: 'Translate',
    title: 'Translator',
    subtitle: 'Interface and transaction terms',
    legal: 'Reference translation. The original remains the legal source.',
    close: 'Close translator',
    current: 'Current language',
  },
  tr: {
    button: 'Çeviri',
    title: 'Çevirmen',
    subtitle: 'Arayüz ve işlem terimleri',
    legal: 'Referans çeviri. Hukuki kaynak orijinal metindir.',
    close: 'Çevirmeni kapat',
    current: 'Geçerli dil',
  },
  kk: {
    button: 'Аударма',
    title: 'Аудармашы',
    subtitle: 'Интерфейс және мәміле терминдері',
    legal: 'Анықтамалық аударма. Заңды дереккөз — түпнұсқа.',
    close: 'Аудармашыны жабу',
    current: 'Ағымдағы тіл',
  },
  uz: {
    button: 'Tarjima',
    title: 'Tarjimon',
    subtitle: 'Interfeys va bitim atamalari',
    legal: 'Maʼlumot uchun tarjima. Yuridik manba asl matn hisoblanadi.',
    close: 'Tarjimonni yopish',
    current: 'Joriy til',
  },
  zh: {
    button: '翻译',
    title: '翻译器',
    subtitle: '界面和交易术语',
    legal: '参考翻译。原文仍为法律依据。',
    close: '关闭翻译器',
    current: '当前语言',
  },
};

const DICTIONARIES: Record<Exclude<LanguageCode, 'ru'>, TranslationDictionary> = {
  en: {
    'Прозрачная Цена': 'Transparent Price',
    'Контур исполнения сделки': 'Transaction execution circuit',
    'Сделка · логистика · документы · деньги': 'Deal · logistics · documents · money',
    'Мой кабинет': 'My workspace',
    'Открыть меню': 'Open menu',
    'Закрыть меню': 'Close menu',
    'Открыть поиск': 'Open search',
    'Поиск': 'Search',
    'Открыть уведомления': 'Open notifications',
    'Уведомления': 'Notifications',
    'Войти': 'Sign in',
    'Регистрация': 'Registration',
    'Выход': 'Exit',
    'Назад': 'Back',
    'Справка': 'Help',
    'Вопрос': 'Question',
    'Документы': 'Documents',
    'Как проходит': 'How it works',
    'Контроль': 'Control',
    'Роли': 'Roles',
    'Разбор сделки': 'Deal review',
    'Оператор': 'Operator',
    'Покупатель': 'Buyer',
    'Продавец': 'Seller',
    'Логистика': 'Logistics',
    'Водитель': 'Driver',
    'Сюрвейер': 'Surveyor',
    'Элеватор': 'Elevator',
    'Лаборатория': 'Laboratory',
    'Банк': 'Bank',
    'Арбитр': 'Arbitrator',
    'Комплаенс': 'Compliance',
    'Руководитель': 'Executive',
    'Рабочий контур': 'Operating circuit',
    'Контур проверки': 'Review circuit',
    'Полевой режим': 'Field mode',
    'Главный риск сделки': 'The main transaction risk',
    'начинается после': 'starts after',
    'согласования цены': 'the price is agreed',
    'Подключить организацию': 'Connect an organisation',
    'Задать вопрос': 'Ask a question',
    'Цена': 'Price',
    'Рейс': 'Trip',
    'Приёмка': 'Acceptance',
    'Расчёт': 'Settlement',
    'Деньги': 'Money',
    'Качество': 'Quality',
    'Спор': 'Dispute',
    'Участник': 'Participant',
    'Реквизиты и ответственный': 'Requisites and responsible person',
    'Согласия': 'Consents',
    'ФГИС': 'FGIS',
  },
  tr: {
    'Прозрачная Цена': 'Şeffaf Fiyat',
    'Контур исполнения сделки': 'İşlem yürütme konturu',
    'Войти': 'Giriş',
    'Регистрация': 'Kayıt',
    'Выход': 'Çıkış',
    'Назад': 'Geri',
    'Справка': 'Yardım',
    'Документы': 'Belgeler',
    'Контроль': 'Kontrol',
    'Роли': 'Roller',
    'Оператор': 'Operatör',
    'Покупатель': 'Alıcı',
    'Продавец': 'Satıcı',
    'Логистика': 'Lojistik',
    'Водитель': 'Sürücü',
    'Элеватор': 'Tahıl elevatörü',
    'Банк': 'Banka',
    'Главный риск сделки': 'İşlemin ana riski',
    'Подключить организацию': 'Kuruluşu bağla',
    'Задать вопрос': 'Soru sor',
    'Цена': 'Fiyat',
    'Рейс': 'Sefer',
    'Приёмка': 'Kabul',
    'Расчёт': 'Ödeme',
    'Деньги': 'Para',
    'Качество': 'Kalite',
    'Спор': 'Uyuşmazlık',
    'ФГИС': 'FGIS',
  },
  kk: {
    'Прозрачная Цена': 'Ашық баға',
    'Контур исполнения сделки': 'Мәмілені орындау контуры',
    'Войти': 'Кіру',
    'Регистрация': 'Тіркелу',
    'Выход': 'Шығу',
    'Назад': 'Артқа',
    'Справка': 'Анықтама',
    'Документы': 'Құжаттар',
    'Контроль': 'Бақылау',
    'Роли': 'Рөлдер',
    'Покупатель': 'Сатып алушы',
    'Продавец': 'Сатушы',
    'Водитель': 'Жүргізуші',
    'Главный риск сделки': 'Мәміленің негізгі тәуекелі',
    'Подключить организацию': 'Ұйымды қосу',
    'Задать вопрос': 'Сұрақ қою',
    'Цена': 'Баға',
    'Приёмка': 'Қабылдау',
    'Расчёт': 'Есеп айырысу',
    'Деньги': 'Ақша',
    'Качество': 'Сапа',
    'Спор': 'Дау',
    'ФГИС': 'FGIS',
  },
  uz: {
    'Прозрачная Цена': 'Shaffof narx',
    'Контур исполнения сделки': 'Bitim ijrosi konturi',
    'Войти': 'Kirish',
    'Регистрация': 'Ro‘yxatdan o‘tish',
    'Выход': 'Chiqish',
    'Назад': 'Orqaga',
    'Справка': 'Yordam',
    'Документы': 'Hujjatlar',
    'Контроль': 'Nazorat',
    'Роли': 'Rollar',
    'Покупатель': 'Xaridor',
    'Продавец': 'Sotuvchi',
    'Водитель': 'Haydovchi',
    'Главный риск сделки': 'Bitimning asosiy xavfi',
    'Подключить организацию': 'Tashkilotni ulash',
    'Задать вопрос': 'Savol berish',
    'Цена': 'Narx',
    'Приёмка': 'Qabul qilish',
    'Расчёт': 'Hisob-kitob',
    'Деньги': 'Pul',
    'Качество': 'Sifat',
    'Спор': 'Nizo',
    'ФГИС': 'FGIS',
  },
  zh: {
    'Прозрачная Цена': '透明价格',
    'Контур исполнения сделки': '交易执行闭环',
    'Войти': '登录',
    'Регистрация': '注册',
    'Выход': '退出',
    'Назад': '返回',
    'Справка': '帮助',
    'Документы': '文件',
    'Контроль': '控制',
    'Роли': '角色',
    'Покупатель': '买方',
    'Продавец': '卖方',
    'Водитель': '司机',
    'Главный риск сделки': '交易的主要风险',
    'Подключить организацию': '接入组织',
    'Задать вопрос': '提问',
    'Цена': '价格',
    'Приёмка': '验收',
    'Расчёт': '结算',
    'Деньги': '资金',
    'Качество': '质量',
    'Спор': '争议',
    'ФГИС': 'FGIS',
  },
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function isLanguageCode(value: string | null): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

function getStoredLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'ru';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLanguageCode(stored) ? stored : 'ru';
}

function getLanguageMeta(code: LanguageCode) {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}

function translateValue(source: string, language: LanguageCode) {
  if (language === 'ru') return source;
  const dictionary = DICTIONARIES[language];
  const normalized = normalizeText(source);
  return dictionary[normalized] ?? source;
}

function shouldSkipElement(element: HTMLElement) {
  return Boolean(
    element.closest(
      'script,style,noscript,svg,canvas,textarea,input,select,option,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]',
    ),
  );
}

function collectTextNodes(root: ParentNode) {
  const nodes: SourceTextNode[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const element = node.parentElement;
      if (!element || shouldSkipElement(element)) return NodeFilter.FILTER_REJECT;
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

function applyAttributes(language: LanguageCode) {
  document.querySelectorAll<HTMLElement>('[aria-label],[title]').forEach((element) => {
    if (shouldSkipElement(element)) return;
    (['aria-label', 'title'] as const).forEach((attribute) => {
      const sourceKey = attribute === 'aria-label' ? 'p7SourceAriaLabel' : 'p7SourceTitle';
      const source = element.dataset[sourceKey] || element.getAttribute(attribute) || '';
      if (!source) return;
      element.dataset[sourceKey] = source;
      const next = language === 'ru' ? source : translateValue(source, language);
      if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
    });
  });
}

function applyPageTranslation(language: LanguageCode) {
  const meta = getLanguageMeta(language);
  document.documentElement.lang = meta.htmlLang;
  document.documentElement.dataset.p7Language = language;

  collectTextNodes(document.body).forEach((node) => {
    const source = node.__p7SourceText || node.nodeValue || '';
    node.__p7SourceText = source;
    const next = language === 'ru' ? source : translateValue(source, language);
    if (node.nodeValue !== next) node.nodeValue = next;
  });

  applyAttributes(language);
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

  const activeLanguage = useMemo(() => getLanguageMeta(language), [language]);
  const copy = UI_COPY[language];

  useEffect(() => {
    setMounted(true);
    setLanguage(getStoredLanguage());
  }, []);

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
      scheduled = window.requestAnimationFrame(() => applyPageTranslation(language));
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      window.cancelAnimationFrame(scheduled);
      observer.disconnect();
    };
  }, [language, mounted]);

  if (!mounted) return null;

  const button = (
    <span className='p7-translator-root p7-translator-slot' data-p7-no-translate='true'>
      <style>{css}</style>
      <button
        type='button'
        className='p7-translator-button'
        onClick={() => setOpen((value) => !value)}
        aria-label={copy.title}
        title={copy.title}
        data-open={open ? 'true' : 'false'}
      >
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
            <span>
              <strong>{copy.title}</strong>
              <small>{copy.subtitle}</small>
            </span>
            <button type='button' onClick={() => setOpen(false)} aria-label={copy.close} title={copy.close}>
              <X size={16} />
            </button>
          </div>
          <div className='p7-translator-current'>{copy.current}: <b>{activeLanguage.native}</b></div>
          <div className='p7-translator-list'>
            {LANGUAGES.map((item) => (
              <button
                key={item.code}
                type='button'
                onClick={() => {
                  setLanguage(item.code);
                  setOpen(false);
                }}
                data-active={item.code === language ? 'true' : 'false'}
              >
                <span><strong>{item.native}</strong><small>{item.label}</small></span>
                {item.code === language ? <Check size={16} /> : <em>{item.short}</em>}
              </button>
            ))}
          </div>
          <p>{copy.legal}</p>
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
.p7-translator-slot{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;order:60}.p7-translator-button{height:42px;min-width:42px;padding:0 11px;border-radius:14px;border:1px solid rgba(8,122,59,.18);background:rgba(8,122,59,.075);color:#087a3b;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12.5px;font-weight:950;letter-spacing:-.02em;white-space:nowrap;cursor:pointer;box-shadow:0 8px 20px rgba(7,22,17,.045)}.p7-translator-button:hover{border-color:rgba(8,122,59,.28);background:rgba(8,122,59,.11)}.p7-translator-button b{min-width:25px;height:24px;padding:0 5px;border-radius:999px;background:rgba(255,255,255,.76);display:inline-flex;align-items:center;justify-content:center;color:#075f32;font-size:10.5px;font-weight:950}.pc-v4-actions .p7-translator-button{height:44px;min-width:44px;border-radius:14px;background:var(--pc-bg-card);border-color:var(--pc-border);color:var(--pc-text-secondary);box-shadow:var(--pc-shadow-sm)}.pc-v4-actions .p7-translator-button:hover{color:var(--pc-text-primary);border-color:var(--pc-border-light)}.pc-v4-actions .p7-translator-button span{display:none}.pc-v4-actions .p7-translator-button b{background:var(--pc-accent-bg);color:var(--pc-accent-strong)}.login-top .p7-translator-slot{margin-left:auto}.login-top .p7-translator-button{height:42px}.p7-register-actions .p7-translator-button,.p7-contact-fixed-actions .p7-translator-button,.entry-header-actions .p7-translator-button{height:42px}.p7-translator-fallback{position:fixed;right:12px;top:calc(env(safe-area-inset-top) + 12px);z-index:3600}.p7-translator-panel{position:fixed;right:14px;top:calc(env(safe-area-inset-top) + 72px);z-index:3700;width:min(360px,calc(100vw - 28px));padding:14px;border-radius:22px;border:1px solid rgba(7,22,17,.12);background:rgba(255,255,255,.98);box-shadow:0 22px 70px rgba(7,22,17,.16);backdrop-filter:blur(18px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#071611;display:grid;gap:12px}.p7-translator-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.p7-translator-panel-head span{display:grid;gap:3px}.p7-translator-panel-head strong{font-size:16px;font-weight:950;letter-spacing:-.03em}.p7-translator-panel-head small{font-size:12px;color:#66758a;line-height:1.35}.p7-translator-panel-head button{width:36px;height:36px;border-radius:13px;border:1px solid rgba(7,22,17,.1);background:#fff;color:#071611;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.p7-translator-current{padding:10px 11px;border-radius:15px;background:rgba(8,122,59,.07);border:1px solid rgba(8,122,59,.14);font-size:12.5px;color:#526173}.p7-translator-current b{color:#087a3b}.p7-translator-list{display:grid;gap:7px}.p7-translator-list button{min-height:48px;padding:8px 10px;border-radius:15px;border:1px solid rgba(7,22,17,.09);background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#071611;cursor:pointer;text-align:left}.p7-translator-list button[data-active='true']{border-color:rgba(8,122,59,.28);background:rgba(8,122,59,.075)}.p7-translator-list button span{display:grid;gap:2px}.p7-translator-list button strong{font-size:13.5px;font-weight:930}.p7-translator-list button small{font-size:11.5px;color:#66758a}.p7-translator-list button em{font-style:normal;font-size:11px;font-weight:950;color:#66758a}.p7-translator-list button svg{color:#087a3b}.p7-translator-panel p{margin:0;padding-top:2px;color:#66758a;font-size:11.5px;line-height:1.45}.p7-translator-root *{box-sizing:border-box}@media(max-width:640px){.p7-translator-button{height:40px;min-width:40px;padding:0 9px;border-radius:13px}.p7-translator-button span{display:none}.p7-translator-button b{min-width:23px;height:22px;font-size:10px}.pc-v4-actions .p7-translator-button{height:38px;min-width:38px;padding:0 7px}.pc-v4-actions .p7-translator-button b{display:none}.entry-header-actions .p7-translator-button,.p7-register-actions .p7-translator-button,.p7-contact-fixed-actions .p7-translator-button{width:40px;padding:0}.entry-header-actions .p7-translator-button b,.p7-register-actions .p7-translator-button b,.p7-contact-fixed-actions .p7-translator-button b{display:none}.p7-translator-panel{left:10px;right:10px;top:calc(env(safe-area-inset-top) + 64px);width:auto;border-radius:20px}}@media(max-width:374px){.pc-v4-actions .p7-translator-button{height:34px;min-width:34px;border-radius:12px}.pc-v4-actions .p7-translator-button svg{width:15px;height:15px}}
`;

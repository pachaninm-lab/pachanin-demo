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

const EN: TranslationDictionary = {
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
  'Включить светлую тему': 'Enable light theme',
  'Включить тёмную тему': 'Enable dark theme',
  'Рабочий контур': 'Operating circuit',
  'Контур проверки': 'Review circuit',
  'Полевой режим': 'Field mode',
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
  'Центр управления': 'Control tower',
  'Сделки': 'Deals',
  'Лоты': 'Lots',
  'Создание': 'Create',
  'Поле и приёмка': 'Field and acceptance',
  'Споры': 'Disputes',
  'Сводка': 'Summary',
  'Закупки': 'Procurement',
  'Подключения': 'Connections',
  'Инвестор': 'Investor',
  'Сценарий сделки': 'Deal scenario',
  'Лоты и запросы': 'Lots and requests',
  'Карта исполнения': 'Execution map',
  'AI-помощник': 'AI assistant',
  'Назад': 'Back',
  'Справка': 'Help',
  'Вопрос': 'Question',
  'Документы': 'Documents',
  'Войти': 'Sign in',
  'Регистрация': 'Registration',
  'Выход': 'Exit',
  'Как проходит': 'How it works',
  'Контроль': 'Control',
  'Роли': 'Roles',
  'Разбор сделки': 'Deal review',
  'Единый вход в контур исполнения': 'Single entry to the execution circuit',
  'Главный риск сделки': 'The main transaction risk',
  'начинается после': 'starts after',
  'согласования цены': 'the price is agreed',
  'Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.': 'Transparent Price is a digital execution circuit for a grain transaction: trip, acceptance, quality, documents, money, dispute and evidence in one process.',
  'Подключить организацию': 'Connect an organisation',
  'Разобрать контур сделки': 'Review the deal circuit',
  'Задать вопрос': 'Ask a question',
  'Контур сделки': 'Deal circuit',
  'исполнение под контролем': 'execution under control',
  'Цена': 'Price',
  'согласована': 'agreed',
  'Рейс': 'Trip',
  'в работе': 'in progress',
  'Приёмка': 'Acceptance',
  'ожидает факт': 'awaiting fact',
  'на сверке': 'under reconciliation',
  'Расчёт': 'Settlement',
  'после оснований': 'after grounds are confirmed',
  'Что контролирует платформа': 'What the platform controls',
  'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': 'After the price is agreed, the key items remain under control: trip, acceptance, documents, quality and payment grounds.',
  'Деньги': 'Money',
  'Основание для расчёта видно до выпуска оплаты.': 'The payment basis is visible before payment release.',
  'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ, EDI, transport documents and acts are linked to deal events.',
  'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': 'Trip, driver, route and checkpoints are in one circuit.',
  'Качество': 'Quality',
  'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': 'Acceptance and laboratory indicators are considered before final settlement.',
  'Как проходит сделка': 'How the deal works',
  'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': 'At each stage it is clear what is confirmed, what requires action and who owns the next step.',
  'Стороны, партия и условия исполнения сведены в единый контур.': 'Parties, lot and execution terms are consolidated in one circuit.',
  'Документы сверяются с событиями исполнения.': 'Documents are reconciled with execution events.',
  'Оплата проводится после подтверждения оснований.': 'Payment is made after the grounds are confirmed.',
  'Спор': 'Dispute',
  'Разбор ведётся по зафиксированным данным.': 'Review is based on recorded data.',
  'Выберите свою роль в сделке': 'Select your role in the deal',
  'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': 'First select the participant role. Then sign in using login, password and organisation.',
  'Статус без догадок': 'Status without guessing',
  'Единая картина по этапам и участникам.': 'One view of stages and participants.',
  'Юридически значимый след': 'Legally relevant trail',
  'События и документы связаны с исполнением сделки.': 'Events and documents are tied to deal execution.',
  'Контроль документов': 'Document control',
  'Комплектность, версии, сроки и ответственные под контролем.': 'Completeness, versions, deadlines and owners are controlled.',
  'Основа для расчётов': 'Settlement basis',
  'Расчёт опирается на подтверждённые события.': 'Settlement relies on confirmed events.',
  'Регистрация участника': 'Participant registration',
  'Подключение компании к': 'Company connection to',
  'контуру сделки': 'the deal circuit',
  'Профиль, реквизиты, ответственный и согласия. После отправки заявка проходит проверку. Доступ в кабинет открывается после статуса «Допущен».': 'Profile, requisites, responsible person and consents. After submission, the application is reviewed. Workspace access opens after the “Approved” status.',
  'Заявка → проверка → допуск': 'Application → review → approval',
  'Участник': 'Participant',
  'Тип участника': 'Participant type',
  'Название организации': 'Organisation name',
  'Регион': 'Region',
  'Реквизиты и ответственный': 'Requisites and responsible person',
  'ФИО ответственного': 'Responsible person full name',
  'Должность': 'Position',
  'Телефон': 'Phone',
  'Пароль': 'Password',
  'Роль участника': 'Participant role',
  'Заявляемая роль': 'Declared role',
  'Согласия': 'Consents',
  'Согласен с правилами платформы': 'I agree with the platform rules',
  'Согласен на обработку персональных данных': 'I consent to personal data processing',
  'Статусы проверки заявки': 'Application review statuses',
  'Заявка создана': 'Application created',
  'Ожидает проверки': 'Awaiting review',
  'Требуется уточнение': 'Clarification required',
  'Допущен': 'Approved',
  'Отклонён': 'Declined',
  'Заблокирован': 'Blocked',
  'Отправить заявку на проверку': 'Send application for review',
  'Уже есть доступ — войти': 'Already have access — sign in',
  'Внешние контуры требуют договоров, доступов и подтверждений. Экран показывает основания, документы, статус, удержание и причину остановки.': 'External circuits require contracts, access credentials and confirmations. The screen shows grounds, documents, status, hold and stop reason.',
  'ФГИС': 'FGIS',
  'контур проверки': 'review circuit',
  'требует проверки': 'requires review',
  'ожидает подтверждение': 'awaiting confirmation',
  'ручная проверка': 'manual review',
  'без критического стопа': 'no critical stop',
};

const TR: TranslationDictionary = {
  'Прозрачная Цена': 'Şeffaf Fiyat',
  'Контур исполнения сделки': 'İşlem yürütme konturu',
  'Сделка · логистика · документы · деньги': 'İşlem · lojistik · belgeler · para',
  'Мой кабинет': 'Çalışma alanım',
  'Поиск': 'Arama',
  'Уведомления': 'Bildirimler',
  'Рабочий контур': 'Çalışma konturu',
  'Контур проверки': 'Kontrol konturu',
  'Полевой режим': 'Saha modu',
  'Оператор': 'Operatör',
  'Покупатель': 'Alıcı',
  'Продавец': 'Satıcı',
  'Логистика': 'Lojistik',
  'Водитель': 'Sürücü',
  'Сюрвейер': 'Sörveyör',
  'Элеватор': 'Tahıl elevatörü',
  'Лаборатория': 'Laboratuvar',
  'Банк': 'Banka',
  'Арбитр': 'Hakem',
  'Комплаенс': 'Uyum',
  'Руководитель': 'Yönetici',
  'Назад': 'Geri',
  'Справка': 'Yardım',
  'Вопрос': 'Soru',
  'Документы': 'Belgeler',
  'Войти': 'Giriş',
  'Регистрация': 'Kayıt',
  'Выход': 'Çıkış',
  'Как проходит': 'Nasıl işler',
  'Контроль': 'Kontrol',
  'Роли': 'Roller',
  'Разбор сделки': 'İşlem analizi',
  'Единый вход в контур исполнения': 'Yürütme konturuna tek giriş',
  'Главный риск сделки': 'İşlemin ana riski',
  'начинается после': 'sonra başlar',
  'согласования цены': 'fiyat anlaşıldığında',
  'Подключить организацию': 'Kuruluşu bağla',
  'Задать вопрос': 'Soru sor',
  'Контур сделки': 'İşlem konturu',
  'Цена': 'Fiyat',
  'Рейс': 'Sefer',
  'Приёмка': 'Kabul',
  'Документы': 'Belgeler',
  'Расчёт': 'Ödeme',
  'Деньги': 'Para',
  'Качество': 'Kalite',
  'Спор': 'Uyuşmazlık',
  'Как проходит сделка': 'İşlem nasıl ilerler',
  'Выберите свою роль в сделке': 'İşlemdeki rolünüzü seçin',
  'Регистрация участника': 'Katılımcı kaydı',
  'Участник': 'Katılımcı',
  'Тип участника': 'Katılımcı türü',
  'Название организации': 'Kuruluş adı',
  'Регион': 'Bölge',
  'Реквизиты и ответственный': 'Bilgiler ve sorumlu kişi',
  'Должность': 'Pozisyon',
  'Телефон': 'Telefon',
  'Пароль': 'Şifre',
  'Роль участника': 'Katılımcı rolü',
  'Согласия': 'Onaylar',
  'ФГИС': 'FGIS',
};

const KK: TranslationDictionary = {
  'Прозрачная Цена': 'Ашық баға',
  'Контур исполнения сделки': 'Мәмілені орындау контуры',
  'Сделка · логистика · документы · деньги': 'Мәміле · логистика · құжаттар · ақша',
  'Мой кабинет': 'Менің кабинетім',
  'Поиск': 'Іздеу',
  'Уведомления': 'Хабарламалар',
  'Оператор': 'Оператор',
  'Покупатель': 'Сатып алушы',
  'Продавец': 'Сатушы',
  'Логистика': 'Логистика',
  'Водитель': 'Жүргізуші',
  'Сюрвейер': 'Сюрвейер',
  'Элеватор': 'Элеватор',
  'Лаборатория': 'Зертхана',
  'Банк': 'Банк',
  'Арбитр': 'Төреші',
  'Комплаенс': 'Комплаенс',
  'Руководитель': 'Басшы',
  'Назад': 'Артқа',
  'Справка': 'Анықтама',
  'Документы': 'Құжаттар',
  'Войти': 'Кіру',
  'Регистрация': 'Тіркелу',
  'Выход': 'Шығу',
  'Контроль': 'Бақылау',
  'Роли': 'Рөлдер',
  'Главный риск сделки': 'Мәміленің негізгі тәуекелі',
  'начинается после': 'кейін басталады',
  'согласования цены': 'баға келісілген соң',
  'Подключить организацию': 'Ұйымды қосу',
  'Задать вопрос': 'Сұрақ қою',
  'Цена': 'Баға',
  'Рейс': 'Рейс',
  'Приёмка': 'Қабылдау',
  'Расчёт': 'Есеп айырысу',
  'Деньги': 'Ақша',
  'Качество': 'Сапа',
  'Спор': 'Дау',
  'Участник': 'Қатысушы',
  'Регион': 'Өңір',
  'Телефон': 'Телефон',
  'Пароль': 'Құпиясөз',
  'ФГИС': 'FGIS',
};

const UZ: TranslationDictionary = {
  'Прозрачная Цена': 'Shaffof narx',
  'Контур исполнения сделки': 'Bitim ijrosi konturi',
  'Сделка · логистика · документы · деньги': 'Bitim · logistika · hujjatlar · pul',
  'Мой кабинет': 'Mening kabinetim',
  'Поиск': 'Qidiruv',
  'Уведомления': 'Bildirishnomalar',
  'Оператор': 'Operator',
  'Покупатель': 'Xaridor',
  'Продавец': 'Sotuvchi',
  'Логистика': 'Logistika',
  'Водитель': 'Haydovchi',
  'Сюрвейер': 'Surveyor',
  'Элеватор': 'Elevator',
  'Лаборатория': 'Laboratoriya',
  'Банк': 'Bank',
  'Арбитр': 'Arbitr',
  'Комплаенс': 'Komplayens',
  'Руководитель': 'Rahbar',
  'Назад': 'Orqaga',
  'Справка': 'Yordam',
  'Документы': 'Hujjatlar',
  'Войти': 'Kirish',
  'Регистрация': 'Ro‘yxatdan o‘tish',
  'Выход': 'Chiqish',
  'Контроль': 'Nazorat',
  'Роли': 'Rollar',
  'Главный риск сделки': 'Bitimning asosiy xavfi',
  'начинается после': 'keyin boshlanadi',
  'согласования цены': 'narx kelishilgach',
  'Подключить организацию': 'Tashkilotni ulash',
  'Задать вопрос': 'Savol berish',
  'Цена': 'Narx',
  'Рейс': 'Reys',
  'Приёмка': 'Qabul qilish',
  'Расчёт': 'Hisob-kitob',
  'Деньги': 'Pul',
  'Качество': 'Sifat',
  'Спор': 'Nizo',
  'Участник': 'Ishtirokchi',
  'Регион': 'Hudud',
  'Телефон': 'Telefon',
  'Пароль': 'Parol',
  'ФГИС': 'FGIS',
};

const ZH: TranslationDictionary = {
  'Прозрачная Цена': '透明价格',
  'Контур исполнения сделки': '交易执行闭环',
  'Сделка · логистика · документы · деньги': '交易 · 物流 · 文件 · 资金',
  'Мой кабинет': '我的工作区',
  'Поиск': '搜索',
  'Уведомления': '通知',
  'Оператор': '运营方',
  'Покупатель': '买方',
  'Продавец': '卖方',
  'Логистика': '物流',
  'Водитель': '司机',
  'Сюрвейер': '检验员',
  'Элеватор': '粮仓',
  'Лаборатория': '实验室',
  'Банк': '银行',
  'Арбитр': '仲裁员',
  'Комплаенс': '合规',
  'Руководитель': '管理层',
  'Назад': '返回',
  'Справка': '帮助',
  'Документы': '文件',
  'Войти': '登录',
  'Регистрация': '注册',
  'Выход': '退出',
  'Контроль': '控制',
  'Роли': '角色',
  'Главный риск сделки': '交易的主要风险',
  'начинается после': '开始于',
  'согласования цены': '价格确认之后',
  'Подключить организацию': '接入组织',
  'Задать вопрос': '提问',
  'Цена': '价格',
  'Рейс': '运输',
  'Приёмка': '验收',
  'Расчёт': '结算',
  'Деньги': '资金',
  'Качество': '质量',
  'Спор': '争议',
  'Участник': '参与方',
  'Регион': '地区',
  'Телефон': '电话',
  'Пароль': '密码',
  'ФГИС': 'FGIS',
};

const DICTIONARIES: Record<Exclude<LanguageCode, 'ru'>, TranslationDictionary> = {
  en: EN,
  tr: TR,
  kk: KK,
  uz: UZ,
  zh: ZH,
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
  const translateAttribute = (element: HTMLElement, attribute: 'aria-label' | 'title' | 'placeholder') => {
    const sourceKey = `p7Source${attribute.replace('-', '')}`;
    const source = element.dataset[sourceKey] || element.getAttribute(attribute) || '';
    if (!source) return;
    element.dataset[sourceKey] = source;
    const next = language === 'ru' ? source : translateValue(source, language);
    if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
  };

  document.querySelectorAll<HTMLElement>('[aria-label]').forEach((element) => {
    if (!shouldSkipElement(element)) translateAttribute(element, 'aria-label');
  });
  document.querySelectorAll<HTMLElement>('[title]').forEach((element) => {
    if (!shouldSkipElement(element)) translateAttribute(element, 'title');
  });
  document.querySelectorAll<HTMLElement>('input[placeholder], textarea[placeholder]').forEach((element) => {
    if (!shouldSkipElement(element)) translateAttribute(element, 'placeholder');
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
    const run = () => applyPageTranslation(language);
    const schedule = () => {
      window.cancelAnimationFrame(scheduled);
      scheduled = window.requestAnimationFrame(run);
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

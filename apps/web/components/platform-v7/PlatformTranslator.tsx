'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Languages, X } from 'lucide-react';

type LanguageCode = 'ru' | 'en' | 'zh';
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
  { code: 'zh', label: 'Китайский', native: '中文', short: 'ZH', htmlLang: 'zh-CN' },
];

const UI_COPY: Record<LanguageCode, { button: string; title: string; subtitle: string; legal: string; close: string; current: string }> = {
  ru: {
    button: 'Перевод',
    title: 'Переводчик',
    subtitle: 'Офлайн-перевод интерфейса и сделочных терминов',
    legal: 'Офлайн-словарь платформы. Оригинал остаётся юридическим источником.',
    close: 'Закрыть переводчик',
    current: 'Текущий язык',
  },
  en: {
    button: 'Translate',
    title: 'Translator',
    subtitle: 'Offline interface and transaction terms',
    legal: 'Offline platform dictionary. The original remains the legal source.',
    close: 'Close translator',
    current: 'Current language',
  },
  zh: {
    button: '翻译',
    title: '翻译器',
    subtitle: '离线界面和交易术语翻译',
    legal: '平台离线词典。原文仍为法律依据。',
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
    'Включить светлую тему': 'Enable light theme',
    'Включить тёмную тему': 'Enable dark theme',
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
    'Цена, объём, базис и допуски качества зафиксированы до рейса.': 'Price, volume, basis and quality tolerances are fixed before the trip.',
    'Сделка': 'Deal',
    'Стороны, партия и условия исполнения сведены в единый контур.': 'Parties, lot and execution terms are consolidated in one circuit.',
    'Маршрут, водитель, транспорт и контрольные точки назначены.': 'Route, driver, vehicle and checkpoints are assigned.',
    'Вес, факт поставки и расхождения фиксируются на элеваторе.': 'Weight, delivery fact and discrepancies are recorded at the elevator.',
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
    'ИНН': 'TIN',
    'КПП': 'KPP',
    'ОГРН / ОГРНИП': 'OGRN / OGRNIP',
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
  },
  zh: {
    'Прозрачная Цена': '透明价格',
    'Контур исполнения сделки': '交易执行闭环',
    'Сделка · логистика · документы · деньги': '交易 · 物流 · 文件 · 资金',
    'Мой кабинет': '我的工作区',
    'Открыть меню': '打开菜单',
    'Закрыть меню': '关闭菜单',
    'Открыть поиск': '打开搜索',
    'Поиск': '搜索',
    'Открыть уведомления': '打开通知',
    'Уведомления': '通知',
    'Включить светлую тему': '启用浅色主题',
    'Включить тёмную тему': '启用深色主题',
    'Войти': '登录',
    'Регистрация': '注册',
    'Выход': '退出',
    'Назад': '返回',
    'Справка': '帮助',
    'Вопрос': '问题',
    'Документы': '文件',
    'Как проходит': '流程',
    'Контроль': '控制',
    'Роли': '角色',
    'Разбор сделки': '交易复盘',
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
    'Рабочий контур': '工作闭环',
    'Контур проверки': '审核闭环',
    'Полевой режим': '现场模式',
    'Центр управления': '控制中心',
    'Сделки': '交易',
    'Лоты': '批次',
    'Создание': '创建',
    'Поле и приёмка': '现场和验收',
    'Споры': '争议',
    'Сводка': '总览',
    'Закупки': '采购',
    'Подключения': '连接',
    'Инвестор': '投资者',
    'Сценарий сделки': '交易场景',
    'Лоты и запросы': '批次和请求',
    'Карта исполнения': '执行地图',
    'AI-помощник': 'AI助手',
    'Единый вход в контур исполнения': '进入执行闭环的统一入口',
    'Главный риск сделки': '交易的主要风险',
    'начинается после': '开始于',
    'согласования цены': '价格确认之后',
    'Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.': '透明价格是粮食交易的数字执行闭环：运输、验收、质量、文件、资金、争议和证据在一个流程中管理。',
    'Подключить организацию': '接入组织',
    'Разобрать контур сделки': '查看交易闭环',
    'Задать вопрос': '提问',
    'Контур сделки': '交易闭环',
    'исполнение под контролем': '执行受控',
    'Цена': '价格',
    'согласована': '已确认',
    'Рейс': '运输',
    'в работе': '进行中',
    'Приёмка': '验收',
    'ожидает факт': '等待确认',
    'на сверке': '核对中',
    'Расчёт': '结算',
    'после оснований': '依据确认后',
    'Что контролирует платформа': '平台控制什么',
    'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': '价格确认后，关键事项仍在控制中：运输、验收、文件、质量和付款依据。',
    'Деньги': '资金',
    'Основание для расчёта видно до выпуска оплаты.': '付款释放前可以看到结算依据。',
    'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ、电子文件流、运输文件和验收文件与交易事件关联。',
    'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': '运输、司机、路线和检查点都在一个闭环中。',
    'Качество': '质量',
    'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': '最终结算前会考虑验收和实验室指标。',
    'Как проходит сделка': '交易如何进行',
    'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': '每个阶段都能看到已确认事项、待处理事项以及下一步负责人。',
    'Цена, объём, базис и допуски качества зафиксированы до рейса.': '价格、数量、基准和质量容差在运输前固定。',
    'Сделка': '交易',
    'Стороны, партия и условия исполнения сведены в единый контур.': '各方、批次和执行条件被整合到一个闭环。',
    'Маршрут, водитель, транспорт и контрольные точки назначены.': '路线、司机、车辆和检查点已分配。',
    'Вес, факт поставки и расхождения фиксируются на элеваторе.': '重量、交付事实和差异在粮仓记录。',
    'Документы сверяются с событиями исполнения.': '文件与执行事件核对。',
    'Оплата проводится после подтверждения оснований.': '付款在依据确认后执行。',
    'Спор': '争议',
    'Разбор ведётся по зафиксированным данным.': '复盘基于已记录数据。',
    'Выберите свою роль в сделке': '选择你在交易中的角色',
    'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': '先选择交易参与方角色，然后使用登录名、密码和组织进入。',
    'Статус без догадок': '状态无需猜测',
    'Единая картина по этапам и участникам.': '按阶段和参与方形成统一视图。',
    'Юридически значимый след': '具有法律意义的轨迹',
    'События и документы связаны с исполнением сделки.': '事件和文件与交易执行关联。',
    'Контроль документов': '文件控制',
    'Комплектность, версии, сроки и ответственные под контролем.': '完整性、版本、期限和负责人受控。',
    'Основа для расчётов': '结算依据',
    'Расчёт опирается на подтверждённые события.': '结算基于已确认事件。',
    'Регистрация участника': '参与方注册',
    'Подключение компании к': '公司接入',
    'контуру сделки': '交易闭环',
    'Профиль, реквизиты, ответственный и согласия. После отправки заявка проходит проверку. Доступ в кабинет открывается после статуса «Допущен».': '资料、账户信息、负责人和同意项。提交后申请进入审核。状态为“已准入”后开放工作区访问。',
    'Заявка → проверка → допуск': '申请 → 审核 → 准入',
    'Участник': '参与方',
    'Тип участника': '参与方类型',
    'Название организации': '组织名称',
    'Регион': '地区',
    'Реквизиты и ответственный': '账户信息和负责人',
    'ИНН': '税号',
    'КПП': 'KPP',
    'ОГРН / ОГРНИП': 'OGRN / OGRNIP',
    'ФИО ответственного': '负责人全名',
    'Должность': '职位',
    'Телефон': '电话',
    'Пароль': '密码',
    'Роль участника': '参与方角色',
    'Заявляемая роль': '申报角色',
    'Согласия': '同意项',
    'Согласен с правилами платформы': '我同意平台规则',
    'Согласен на обработку персональных данных': '我同意个人数据处理',
    'Статусы проверки заявки': '申请审核状态',
    'Заявка создана': '申请已创建',
    'Ожидает проверки': '等待审核',
    'Требуется уточнение': '需要补充说明',
    'Допущен': '已准入',
    'Отклонён': '已拒绝',
    'Заблокирован': '已封锁',
    'Отправить заявку на проверку': '提交审核申请',
    'Уже есть доступ — войти': '已有访问权限 — 登录',
    'Внешние контуры требуют договоров, доступов и подтверждений. Экран показывает основания, документы, статус, удержание и причину остановки.': '外部闭环需要合同、访问权限和确认。页面显示依据、文件、状态、冻结和停止原因。',
    'ФГИС': 'FGIS',
    'контур проверки': '审核闭环',
    'требует проверки': '需要审核',
    'ожидает подтверждение': '等待确认',
    'ручная проверка': '人工审核',
    'без критического стопа': '无关键阻断',
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

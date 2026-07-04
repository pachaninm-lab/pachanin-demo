'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type Dict = Record<string, string>;
type Dicts = Record<'en' | 'zh', Dict>;
type SourceText = Text & { __p7SourceText?: string; __pcCopySource?: string };

const LANGUAGE_KEY = 'pc-v7-language';
const SCOPES = ['.pc-v7-public-entry', '.pc-v7-login-single', '.p7-contact-page', '.pc-shell-root-v4', '.seller-cockpit'] as const;

const HOME = {
  ru: {
    brand: 'Прозрачная Цена', login: 'Войти', process: 'Порядок сделки', demoNav: 'Демонстрация', contactNav: 'Обращение',
    kicker: 'Единый вход в контур исполнения', h1: ['Главный риск сделки', 'начинается после', 'согласования цены'],
    lead: 'Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.',
    primary: 'Подключить организацию', demo: 'Демонстрационная сделка', contact: 'Направить обращение',
  },
  en: {
    brand: 'Transparent Price', login: 'Sign in', process: 'Deal flow', demoNav: 'Demo', contactNav: 'Request',
    kicker: 'Single entry to the execution circuit', h1: ['The main transaction risk', 'starts after', 'the price is agreed'],
    lead: 'Transparent Price is a digital execution circuit for a grain transaction: trip, acceptance, quality, documents, money, dispute, and evidence in one process.',
    primary: 'Connect an organisation', demo: 'Demo deal', contact: 'Send request',
  },
  zh: {
    brand: '透明价格', login: '登录', process: '交易流程', demoNav: '演示', contactNav: '请求',
    kicker: '进入执行闭环的统一入口', h1: ['交易的主要风险', '开始于', '价格确认之后'],
    lead: '透明价格是粮食交易的数字执行闭环：运输、验收、质量、文件、资金、争议和证据在一个流程中管理。',
    primary: '接入组织', demo: '演示交易', contact: '发送请求',
  },
} as const;

const DICTS: Dicts = {
  en: {
    'Прозрачная Цена': 'Transparent Price', 'Войти': 'Sign in', 'Регистрация': 'Registration', 'Выход': 'Exit', 'Назад': 'Back', 'Справка': 'Help', 'Открыть': 'Open',
    'Статус': 'Status', 'Следующее действие': 'Next action', 'Ответственный': 'Owner', 'Деньги': 'Money', 'Документы': 'Documents', 'Логистика': 'Logistics', 'Качество': 'Quality',
    'Сделка': 'Deal', 'Рейс': 'Trip', 'Приёмка': 'Acceptance', 'Расчёт': 'Settlement', 'Спор': 'Dispute', 'Блокер': 'Blocker', 'Оператор': 'Operator',
    'Покупатель': 'Buyer', 'Продавец': 'Seller', 'Водитель': 'Driver', 'Элеватор': 'Elevator', 'Лаборатория': 'Laboratory', 'Сюрвейер': 'Surveyor', 'Банк': 'Bank',
    'Комплаенс': 'Compliance', 'Арбитр': 'Arbitrator', 'Руководитель': 'Executive', 'Главный риск сделки': 'The main transaction risk', 'начинается после': 'starts after', 'согласования цены': 'the price is agreed',
    'Подключить организацию': 'Connect an organisation', 'Демонстрационная сделка': 'Demo deal', 'Направить обращение': 'Send request', 'Что контролирует платформа': 'What the platform controls',
    'Как проходит сделка': 'How the deal works', 'Выберите свою роль в сделке': 'Select your role in the deal', 'Подать заявку на роль': 'Apply for role',
    'Главный блокер': 'Main blocker', 'Сделок в работе': 'Deals in progress', 'Открытых споров': 'Open disputes', 'Деньги под риском': 'Money at risk', 'Журнал событий': 'Event journal',
    'Рабочие действия и передача': 'Work actions and handoff', 'Деньги и банковская проверка': 'Money and bank review', 'Документы для проверки': 'Documents for review', 'Что мешает выплате': 'What blocks payout',
    'Калькулятор комиссии': 'Commission calculator', 'Факторинг': 'Factoring', 'Экспортный калькулятор': 'Export calculator', 'ФТС · Таможенные декларации': 'FTS · Customs declarations', 'ЭДО · Электронный документооборот': 'EDI · Electronic document flow',

    'Кабинет покупателя · запрос → резерв → логистика': 'Buyer workspace · request → reserve → logistics', 'Подтвердить резерв,': 'Confirm the reserve,', 'чтобы сделка пошла в исполнение': 'so the deal can move into execution',
    'Покупатель видит не доску партий, а контур закупки: запрос, выбранную партию, ставку, резерв, удержание, документы и причину, почему сделка ещё не перешла к логистике.': 'The buyer sees not a lot board, but a procurement circuit: request, selected lot, bid, reserve, hold, documents, and the reason the deal has not moved to logistics yet.',
    'Ключевые показатели закупки': 'Key procurement metrics', 'Резерв · ждёт банк': 'Reserve · awaiting bank', 'Под удержанием · вес': 'Held · weight', 'Уверенность к поставке': 'Delivery confidence', 'Деньги и резерв': 'Money and reserve',
    'Обзор закупки': 'Procurement overview', 'Деньги, резерв и удержание': 'Money, reserve, and hold', 'Документы и СДИЗ покупателя': 'Buyer documents and SDIZ', 'Блокеры и путь разблокировки': 'Blockers and unblock path',
    'Закупки, партии и маршруты покупателя': 'Buyer procurement, lots, and routes', 'Кредитное бюро · Скоринг контрагентов': 'Credit bureau · Counterparty scoring', 'Избранные лоты и поставщики': 'Favourite lots and suppliers',

    'ПРОДАВЕЦ · КАБИНЕТ СДЕЛКИ': 'SELLER · DEAL WORKSPACE', 'Главный рабочий статус продавца': 'Seller main operating status', 'остановлено · ждёт ЭТрН': 'stopped · awaiting E-TTN', 'СДИЗ и ЭТрН не закрыты': 'SDIZ and E-TTN are not closed',
    'Закрыть документы, чтобы передать основание банку': 'Close documents to transfer the basis to the bank', 'Резерв виден, но банк не получает основание для проверки выплаты.': 'The reserve is visible, but the bank does not receive the basis to review payout.',
    'На проверку банку': 'For bank review', 'банковская проверка выплаты остановлена до подтверждения документного пакета': 'bank payout review is stopped until the document package is confirmed', 'Кабинет продавца · сделка → документы → деньги': 'Seller workspace · deal → documents → money',
    'Закройте документы': 'Close the documents', 'для банка': 'for the bank', 'Первый экран показывает статус сделки, блокер, деньги под риском, ответственного и следующий безопасный шаг.': 'The first screen shows deal status, blocker, money at risk, owner, and the next safe step.',
    'Подготовить документы': 'Prepare documents', 'Партии и лоты': 'Lots and listings', 'Что важно продавцу сейчас': 'What matters to the seller now', 'Состояние сделки продавца': 'Seller deal status', 'Партии, лоты и маршруты продавца': 'Seller lots, listings, and routes',

    'BANK · Проверка выплаты': 'BANK · Payout review', 'Кабинет банка': 'Bank workspace', 'Сначала основание, потом банковская проверка': 'Basis first, then bank review',
    'Деньги выпускаются только после условий сделки и подтверждения банка. Экран показывает только то, что важно для решения: сумма, стоп, причина, ответственный и следующее действие.': 'Funds are released only after deal conditions and bank confirmation. The screen shows only what matters for the decision: amount, stop, reason, owner, and next action.',
    'Проверка выплаты': 'Payout review', 'Карточка сделки': 'Deal card', '5 секунд для банка': '5 seconds for the bank', 'Деньги не двигаются, пока нет основания': 'Money does not move until there is a basis',
    'Передача основания банку — результат закрытых документов, приёмки, качества, спора и банковского решения.': 'Sending the basis to the bank is the result of closed documents, acceptance, quality, dispute, and bank decision.',
    'передано': 'transferred', 'Платформа деньги не передаёт без банка': 'The platform does not transfer money without the bank', 'Деньги под контролем банка': 'Money under bank control', 'В резерве': 'In reserve', 'К передаче банку сейчас': 'For bank transfer now',
    'Под удержанием': 'Held', 'Требуют проверки': 'Require review', 'Основание для банковской проверки выплаты не сформировано — документы не закрыты': 'The basis for bank payout review has not been formed — documents are not closed',
    'СДИЗ не закрыт — основание для банка не сформировано': 'SDIZ is not closed — the bank basis has not been formed', 'Спор по DL-9102 · 624 тыс. ₽ под удержанием': 'Dispute on DL-9102 · ₽624k held', 'основание банку': 'basis to the bank',
    'ЭТрН не подписана': 'E-TTN is not signed', 'ручная проверка': 'manual review', 'Закрыть СДИЗ': 'Close SDIZ', 'Подписать ЭТрН': 'Sign E-TTN', 'Закрыть акт приёмки': 'Close acceptance act',
    'Выплата требует подтверждения банка. Платформа формирует основание при закрытых условиях.': 'Payout requires bank confirmation. The platform forms the basis when conditions are closed.', 'Денежная очередь': 'Money queue', 'Резерв': 'Reserve', 'Удержано': 'Held',
    'Документы и основания': 'Documents and grounds', 'Внешние контуры': 'External circuits', 'Условия банковской проверки выплаты': 'Bank payout review conditions', 'Рекомендации и доказательства': 'Recommendations and evidence', 'Передача между ролями и журнал': 'Role handoff and journal',
    'Ledger · Двойная запись': 'Ledger · Double entry', 'Жизненный цикл денег · RESERVE → RELEASE → COMMISSION': 'Money lifecycle · RESERVE → RELEASE → COMMISSION',
  },
  zh: {
    'Прозрачная Цена': '透明价格', 'Войти': '登录', 'Регистрация': '注册', 'Выход': '退出', 'Назад': '返回', 'Справка': '帮助', 'Открыть': '打开',
    'Статус': '状态', 'Следующее действие': '下一步动作', 'Ответственный': '负责人', 'Деньги': '资金', 'Документы': '文件', 'Логистика': '物流', 'Качество': '质量',
    'Сделка': '交易', 'Рейс': '运输', 'Приёмка': '验收', 'Расчёт': '结算', 'Спор': '争议', 'Блокер': '阻断项', 'Оператор': '运营方',
    'Покупатель': '买方', 'Продавец': '卖方', 'Водитель': '司机', 'Элеватор': '粮仓', 'Лаборатория': '实验室', 'Сюрвейер': '检验员', 'Банк': '银行',
    'Комплаенс': '合规', 'Арбитр': '仲裁员', 'Руководитель': '管理层', 'Главный риск сделки': '交易的主要风险', 'начинается после': '开始于', 'согласования цены': '价格确认之后',
    'Подключить организацию': '接入组织', 'Демонстрационная сделка': '演示交易', 'Направить обращение': '发送请求', 'Что контролирует платформа': '平台控制什么', 'Как проходит сделка': '交易流程', 'Выберите свою роль в сделке': '选择你在交易中的角色', 'Подать заявку на роль': '申请角色',
    'Главный блокер': '主要阻断项', 'Сделок в работе': '进行中的交易', 'Открытых споров': '未结争议', 'Деньги под риском': '风险资金', 'Журнал событий': '事件日志', 'Рабочие действия и передача': '工作动作和交接', 'Деньги и банковская проверка': '资金和银行审核', 'Документы для проверки': '审核文件', 'Что мешает выплате': '阻碍付款的事项',
    'Калькулятор комиссии': '佣金计算器', 'Факторинг': '保理', 'Экспортный калькулятор': '出口计算器', 'ФТС · Таможенные декларации': '联邦海关 · 报关单', 'ЭДО · Электронный документооборот': 'EDI · 电子文件流',

    'Кабинет покупателя · запрос → резерв → логистика': '买方工作区 · 请求 → 预留 → 物流', 'Подтвердить резерв,': '确认预留资金，', 'чтобы сделка пошла в исполнение': '使交易进入执行', 'Ключевые показатели закупки': '采购关键指标', 'Резерв · ждёт банк': '预留 · 等待银行', 'Под удержанием · вес': '冻结 · 重量', 'Уверенность к поставке': '交付信心', 'Деньги и резерв': '资金和预留', 'Обзор закупки': '采购概览', 'Деньги, резерв и удержание': '资金、预留和冻结', 'Документы и СДИЗ покупателя': '买方文件和SDIZ', 'Блокеры и путь разблокировки': '阻断项和解锁路径', 'Закупки, партии и маршруты покупателя': '买方采购、批次和路线',

    'ПРОДАВЕЦ · КАБИНЕТ СДЕЛКИ': '卖方 · 交易工作区', 'Главный рабочий статус продавца': '卖方主要工作状态', 'остановлено · ждёт ЭТрН': '已停止 · 等待E-TTN', 'СДИЗ и ЭТрН не закрыты': 'SDIZ和E-TTN未关闭', 'Закрыть документы, чтобы передать основание банку': '关闭文件以将依据提交给银行', 'На проверку банку': '提交银行审核', 'Кабинет продавца · сделка → документы → деньги': '卖方工作区 · 交易 → 文件 → 资金', 'Закройте документы': '关闭文件', 'для банка': '用于银行', 'Подготовить документы': '准备文件', 'Партии и лоты': '批次和挂牌', 'Что важно продавцу сейчас': '卖方现在需要关注什么', 'Состояние сделки продавца': '卖方交易状态', 'Партии, лоты и маршруты продавца': '卖方批次、挂牌和路线',

    'BANK · Проверка выплаты': '银行 · 付款审核', 'Кабинет банка': '银行工作区', 'Сначала основание, потом банковская проверка': '先形成依据，再进行银行审核', 'Проверка выплаты': '付款审核', 'Карточка сделки': '交易卡片', '5 секунд для банка': '银行5秒视图', 'Деньги не двигаются, пока нет основания': '没有依据，资金不流转', 'передано': '已传递', 'Платформа деньги не передаёт без банка': '没有银行，平台不转移资金', 'Деньги под контролем банка': '银行控制下的资金', 'В резерве': '预留中', 'К передаче банку сейчас': '当前提交银行', 'Под удержанием': '冻结中', 'Требуют проверки': '需要审核', 'Денежная очередь': '资金队列', 'Резерв': '预留', 'Удержано': '已冻结', 'Документы и основания': '文件和依据', 'Внешние контуры': '外部闭环', 'Условия банковской проверки выплаты': '银行付款审核条件', 'Рекомендации и доказательства': '建议和证据', 'Передача между ролями и журнал': '角色交接和日志', 'Ledger · Двойная запись': '账本 · 双重记账', 'Жизненный цикл денег · RESERVE → RELEASE → COMMISSION': '资金生命周期 · RESERVE → RELEASE → COMMISSION',
  },
};

function currentLang(): Lang {
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  return stored === 'en' || stored === 'zh' ? stored : 'ru';
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function translate(source: string, lang: Lang) {
  if (lang === 'ru') return source;
  const raw = source || '';
  const key = normalize(raw);
  if (!key) return raw;
  const dict = DICTS[lang];
  const exact = dict[key];
  if (exact) return exact;
  let next = raw;
  for (const [from, to] of Object.entries(dict).sort((a, b) => b[0].length - a[0].length)) {
    if (from.length < 4 || !next.includes(from)) continue;
    next = next.split(from).join(to);
  }
  return next;
}

function setText(target: Element | null, value: string) {
  if (target && target.textContent !== value) target.textContent = value;
}

function setLastText(link: HTMLElement | null, value: string) {
  if (!link) return;
  const node = Array.from(link.childNodes).reverse().find((item) => item.nodeType === Node.TEXT_NODE);
  if (node) {
    node.textContent = value;
    return;
  }
  link.append(document.createTextNode(value));
}

function applyHome(lang: Lang) {
  const home = HOME[lang];
  setText(document.querySelector('.pc-v7-public-entry .entry-brand strong'), home.brand);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-login'), home.login);
  document.querySelectorAll<HTMLAnchorElement>('.pc-v7-public-entry .entry-nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href === '#process') link.textContent = home.process;
    if (href === '/platform-v7/demo') link.textContent = home.demoNav;
    if (href === '/platform-v7/contact') link.textContent = home.contactNav;
  });
  setText(document.querySelector('.pc-v7-public-entry .entry-kicker'), home.kicker);
  document.querySelectorAll('.pc-v7-public-entry #entry-hero-title span').forEach((node, index) => setText(node, home.h1[index] || ''));
  setText(document.querySelector('.pc-v7-public-entry .entry-hero-copy p'), home.lead);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-primary-cta'), home.primary);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-secondary-cta'), home.demo);
  const contact = document.querySelector<HTMLAnchorElement>('.pc-v7-public-entry .entry-register-cta');
  if (contact) {
    contact.setAttribute('href', '/platform-v7/contact');
    setLastText(contact, home.contact);
  }
}

function skipElement(element: HTMLElement) {
  return Boolean(element.closest('script,style,noscript,svg,canvas,textarea,input,select,option,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]'));
}

function applyText(root: ParentNode, lang: Lang) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const element = node.parentElement;
      if (!element || skipElement(element)) return NodeFilter.FILTER_REJECT;
      if (!normalize(node.nodeValue || '')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode() as SourceText | null;
  while (node) {
    const source = node.__p7SourceText || node.__pcCopySource || node.nodeValue || '';
    node.__pcCopySource = source;
    const next = translate(source, lang);
    if (node.nodeValue !== next) node.nodeValue = next;
    node = walker.nextNode() as SourceText | null;
  }
}

function applyAll() {
  const lang = currentLang();
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en' : 'ru-RU';
  document.documentElement.dataset.p7Language = lang;
  applyHome(lang);
  SCOPES.forEach((selector) => document.querySelectorAll(selector).forEach((root) => applyText(root, lang)));
}

export function PublicHeroCopyNormalizer() {
  React.useEffect(() => {
    applyAll();
    const schedule = () => window.requestAnimationFrame(applyAll);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timers = [80, 220, 600, 1200, 2400].map((delay) => window.setTimeout(applyAll, delay));
    const interval = window.setInterval(applyAll, 900);
    window.addEventListener('resize', applyAll);
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(interval);
      window.removeEventListener('resize', applyAll);
    };
  }, []);

  return null;
}

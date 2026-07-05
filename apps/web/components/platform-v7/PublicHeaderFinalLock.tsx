'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type Dict = Record<string, string>;
type SourceOption = HTMLOptionElement & { __pcLockOption?: string };
type SourceText = Text & { __pcFloatingCopy?: string; __pcExactCopy?: string };

const LANGUAGE_KEY = 'pc-v7-language';
const DICTIONARY_URL = '/platform-v7/i18n/dictionaries.json';
const FLOATING_SCOPES = '[role="dialog"], .p7-support-chat-panel, .pc-v4-command-palette, .pc-v4-notification-panel, .pc-v4-popover, .pc-v4-drawer';
const EXACT_SCOPES = '.pc-v7-public-entry, .p7-contact-page';

const BASE: Record<'en' | 'zh', Dict> = {
  en: {
    'Войти': 'Sign in',
    'Назад': 'Back',
    'Справка': 'Help',
    'Выход': 'Exit',
    'Открыть': 'Open',
    'Закрыть': 'Close',
    'Открыть меню': 'Open menu',
    'Закрыть меню': 'Close menu',
    'Открыть поиск': 'Open search',
    'Открыть уведомления': 'Open notifications',
    'Закрыть уведомления': 'Close notifications',
    'Открыть поддержку': 'Open support',
    'Закрыть поддержку': 'Close support',
    'Введите пароль': 'Enter password',
    'Компания / ИНН': 'Company / TIN',
    'Телефон или email': 'Phone or email',
    'Участник': 'Participant',
    'Покупатель': 'Buyer',
    'Продавец': 'Seller',
    'Логистика': 'Logistics',
    'Водитель': 'Driver',
    'Элеватор': 'Elevator',
    'Лаборатория': 'Laboratory',
    'Банк': 'Bank',
    'Комплаенс': 'Compliance',
    'Арбитр': 'Arbitrator',
    'Руководитель': 'Executive',
    'Оператор': 'Operator',
    'Юр. лицо / ИП / КФХ': 'Legal entity / sole proprietor / farm',
    'Требуется уточнение': 'Clarification required',
    'Ожидает проверки': 'Awaiting review',
    'Допущен': 'Approved',
    'Отклонён': 'Declined',
    'Заблокирован': 'Blocked',
    'Уведомления': 'Notifications',
    'Поиск': 'Search',
    'Отправить': 'Send',
    'Отправляем…': 'Sending…',
    'Отмена': 'Cancel',
    'Сохранить': 'Save',
    'Поддержка Прозрачной Цены': 'Transparent Price Support',
    'Тема': 'Topic',
    'Платформа': 'Platform',
    'Пилот': 'Pilot',
    'Банк / партнёр': 'Bank / partner',
    'Регион': 'Region',
    'Технический вопрос': 'Technical question',
    'Другое': 'Other',
    'Имя': 'Name',
    'Вопрос': 'Question',
    'Коротко опишите вопрос по платформе, пилоту, доступу, документам или техническому подключению.': 'Briefly describe your question about the platform, pilot, access, documents, or technical connection.',
    'Я даю согласие на обработку персональных данных для ответа на обращение и принимаю условия': 'I consent to personal data processing for a response to my request and accept the terms of the',
    'политики конфиденциальности': 'Privacy Policy',
    'Обращение отправлено': 'Request sent',
    'Вопрос принят. Ответ придёт на указанный контакт после проверки сообщения.': 'Your question has been received. A response will be sent to the provided contact after review.',
    'Отправить ещё вопрос': 'Send another question',
    'Укажите имя.': 'Enter your name.',
    'Укажите телефон или email для ответа.': 'Enter a phone number or email for the response.',
    'Напишите вопрос.': 'Write your question.',
    'Подтвердите согласие на обработку данных.': 'Confirm consent to data processing.',
    'Контур сделки': 'Deal circuit',
    'Контур исполнения сделки': 'Deal execution circuit',
    'исполнение под контролем': 'execution under control',
    'согласована': 'agreed',
    'в работе': 'in progress',
    'ожидает факт': 'awaiting fact',
    'на сверке': 'under review',
    'после оснований': 'after grounds',
    'ожидает акт': 'awaiting act',
    'Разобрать контур сделки': 'Review the deal circuit',
    'Задать вопрос': 'Ask a question',
    'Публичная навигация': 'Public navigation',
    'Разделы главной страницы': 'Home page sections',
    'Доверие и контроль': 'Trust and control',
    'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': 'First select the participant role. Then sign in using login, password, and organisation.',
    'Единый вход в контур исполнения': 'Single entry to the execution circuit',
    'Главный риск сделки': 'The main transaction risk',
    'начинается после': 'starts after',
    'согласования цены': 'the price is agreed',
    'Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.': 'Transparent Price is a digital execution circuit for a grain transaction: trip, acceptance, quality, documents, money, dispute, and evidence in one process.',
    'Что контролирует платформа': 'What the platform controls',
    'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': 'After price agreement, the key execution points remain under control: trip, acceptance, documents, quality, and payment basis.',
    'Как проходит сделка': 'How the deal works',
    'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': 'At each stage it is clear what is confirmed, what requires action, and who owns the next step.',
    'Выберите свою роль в сделке': 'Select your role in the deal',
    'Основание для расчёта видно до выпуска оплаты.': 'The settlement basis is visible before payment release.',
    'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ, EDI, transport documents, and acts are linked to deal events.',
    'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': 'Trip, driver, route, and checkpoints are in one circuit.',
    'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': 'Acceptance and laboratory indicators are considered before final settlement.',
    'Цена, объём, базис и допуски качества зафиксированы до рейса.': 'Price, volume, basis, and quality tolerances are fixed before the trip.',
    'Стороны, партия и условия исполнения сведены в единый контур.': 'Parties, lot, and execution terms are brought into one circuit.',
    'Маршрут, водитель, транспорт и контрольные точки назначены.': 'Route, driver, vehicle, and checkpoints are assigned.',
    'Вес, факт поставки и расхождения фиксируются на элеваторе.': 'Weight, delivery fact, and discrepancies are recorded at the elevator.',
    'Документы сверяются с событиями исполнения.': 'Documents are reconciled with execution events.',
    'Оплата проводится после подтверждения оснований.': 'Payment is made after the grounds are confirmed.',
    'Разбор ведётся по зафиксированным данным.': 'Review is based on recorded data.',
    'Сделки, блокеры, SLA и контрольные действия.': 'Deals, blockers, SLA, and control actions.',
    'Поставка, качество, документы и риски оплаты.': 'Delivery, quality, documents, and payment risks.',
    'Партия, рейс, приёмка и основание для оплаты.': 'Lot, trip, acceptance, and payment basis.',
    'Рейсы, водители, движение и отклонения по маршруту.': 'Trips, drivers, movement, and route deviations.',
    'Маршрут, точки рейса, фото и офлайн-доказательства.': 'Route, trip points, photos, and offline evidence.',
    'Приёмка, хранение, вес и статусы партии.': 'Acceptance, storage, weight, and lot statuses.',
    'Анализы, показатели качества и связь с приёмкой.': 'Tests, quality indicators, and acceptance linkage.',
    'Осмотр, фиксация фактов и независимый доказательный слой.': 'Inspection, fact recording, and an independent evidence layer.',
    'Основания для финансирования и расчётов по подтверждённым событиям.': 'Grounds for financing and settlements based on confirmed events.',
    'Доступы, действия участников и контроль правил.': 'Access, participant actions, and rule control.',
    'Спор, расхождения, пакет доказательств и решение по фактам.': 'Dispute, discrepancies, evidence package, and fact-based decision.',
    'Расчёты, блокеры, роли, споры и ход исполнения.': 'Settlements, blockers, roles, disputes, and execution progress.',
    'Войти как оператор': 'Sign in as operator',
    'Войти как покупатель': 'Sign in as buyer',
    'Войти как продавец': 'Sign in as seller',
    'Войти как логистика': 'Sign in as logistics',
    'Войти как водитель': 'Sign in as driver',
    'Войти как элеватор': 'Sign in as elevator',
    'Войти как лаборатория': 'Sign in as laboratory',
    'Войти как сюрвейер': 'Sign in as surveyor',
    'Войти как банк': 'Sign in as bank',
    'Войти как комплаенс': 'Sign in as compliance',
    'Войти как арбитр': 'Sign in as arbitrator',
    'Войти как руководитель': 'Sign in as executive',
    'Статус без догадок': 'Status without guesswork',
    'Единая картина по этапам и участникам.': 'A single view across stages and participants.',
    'Юридически значимый след': 'Legally significant trail',
    'События и документы связаны с исполнением сделки.': 'Events and documents are linked to deal execution.',
    'Контроль документов': 'Document control',
    'Комплектность, версии, сроки и ответственные под контролем.': 'Completeness, versions, deadlines, and owners are under control.',
    'Основа для расчётов': 'Settlement basis',
    'Расчёт опирается на подтверждённые события.': 'Settlement relies on confirmed events.',
  },
  zh: {
    'Войти': '登录',
    'Назад': '返回',
    'Справка': '帮助',
    'Выход': '退出',
    'Открыть': '打开',
    'Закрыть': '关闭',
    'Открыть меню': '打开菜单',
    'Закрыть меню': '关闭菜单',
    'Открыть поиск': '打开搜索',
    'Открыть уведомления': '打开通知',
    'Закрыть уведомления': '关闭通知',
    'Открыть поддержку': '打开支持',
    'Закрыть поддержку': '关闭支持',
    'Введите пароль': '输入密码',
    'Компания / ИНН': '公司 / 税号',
    'Телефон или email': '电话或邮箱',
    'Участник': '参与方',
    'Покупатель': '买方',
    'Продавец': '卖方',
    'Логистика': '物流',
    'Водитель': '司机',
    'Элеватор': '粮仓',
    'Лаборатория': '实验室',
    'Банк': '银行',
    'Комплаенс': '合规',
    'Арбитр': '仲裁员',
    'Руководитель': '管理层',
    'Оператор': '运营方',
    'Юр. лицо / ИП / КФХ': '法人 / 个体工商户 / 农场',
    'Требуется уточнение': '需要补充说明',
    'Ожидает проверки': '等待审核',
    'Допущен': '已准入',
    'Отклонён': '已拒绝',
    'Заблокирован': '已封锁',
    'Уведомления': '通知',
    'Поиск': '搜索',
    'Отправить': '发送',
    'Отправляем…': '发送中…',
    'Отмена': '取消',
    'Сохранить': '保存',
    'Поддержка Прозрачной Цены': '透明价格支持',
    'Тема': '主题',
    'Платформа': '平台',
    'Пилот': '试点',
    'Банк / партнёр': '银行 / 合作伙伴',
    'Регион': '地区',
    'Технический вопрос': '技术问题',
    'Другое': '其他',
    'Имя': '姓名',
    'Вопрос': '问题',
    'Коротко опишите вопрос по платформе, пилоту, доступу, документам или техническому подключению.': '请简要描述关于平台、试点、访问、文件或技术连接的问题。',
    'Я даю согласие на обработку персональных данных для ответа на обращение и принимаю условия': '我同意为回复请求而处理个人数据，并接受',
    'политики конфиденциальности': '隐私政策',
    'Обращение отправлено': '请求已发送',
    'Вопрос принят. Ответ придёт на указанный контакт после проверки сообщения.': '问题已收到。审核后将通过所提供联系方式回复。',
    'Отправить ещё вопрос': '再发送一个问题',
    'Укажите имя.': '请输入姓名。',
    'Укажите телефон или email для ответа.': '请输入用于回复的电话或邮箱。',
    'Напишите вопрос.': '请填写问题。',
    'Подтвердите согласие на обработку данных.': '请确认同意数据处理。',
    'Контур сделки': '交易闭环',
    'Контур исполнения сделки': '交易执行闭环',
    'исполнение под контролем': '执行受控',
    'согласована': '已确认',
    'в работе': '进行中',
    'ожидает факт': '等待事实',
    'на сверке': '审核中',
    'после оснований': '依据确认后',
    'ожидает акт': '等待单据',
    'Разобрать контур сделки': '复盘交易闭环',
    'Задать вопрос': '提问',
    'Публичная навигация': '公共导航',
    'Разделы главной страницы': '首页栏目',
    'Доверие и контроль': '信任和控制',
    'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': '先选择交易参与方角色，然后使用登录名、密码和组织进入。',
    'Единый вход в контур исполнения': '进入执行闭环的统一入口',
    'Главный риск сделки': '交易的主要风险',
    'начинается после': '开始于',
    'согласования цены': '价格确认之后',
    'Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.': '透明价格是粮食交易的数字执行闭环：运输、验收、质量、文件、资金、争议和证据都在同一流程中。',
    'Что контролирует платформа': '平台控制什么',
    'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': '价格确认后，关键执行点仍在控制中：运输、验收、文件、质量和付款依据。',
    'Как проходит сделка': '交易如何执行',
    'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': '每个阶段都能看到已确认内容、需要处理的事项以及下一步负责人。',
    'Выберите свою роль в сделке': '选择你在交易中的角色',
    'Основание для расчёта видно до выпуска оплаты.': '付款释放前即可看到结算依据。',
    'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ、电子文件流、运输文件和单据与交易事件相连。',
    'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': '运输、司机、路线和检查点处于同一闭环中。',
    'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': '验收和实验室指标在最终结算前被纳入考虑。',
    'Цена, объём, базис и допуски качества зафиксированы до рейса.': '价格、数量、基准和质量容差在运输前固定。',
    'Стороны, партия и условия исполнения сведены в единый контур.': '交易各方、批次和执行条件统一到一个闭环中。',
    'Маршрут, водитель, транспорт и контрольные точки назначены.': '路线、司机、车辆和检查点已指定。',
    'Вес, факт поставки и расхождения фиксируются на элеваторе.': '重量、交付事实和差异在粮仓记录。',
    'Документы сверяются с событиями исполнения.': '文件与执行事件进行核对。',
    'Оплата проводится после подтверждения оснований.': '依据确认后进行付款。',
    'Разбор ведётся по зафиксированным данным.': '复盘基于已记录数据。',
    'Сделки, блокеры, SLA и контрольные действия.': '交易、阻断项、SLA和控制动作。',
    'Поставка, качество, документы и риски оплаты.': '交付、质量、文件和付款风险。',
    'Партия, рейс, приёмка и основание для оплаты.': '批次、运输、验收和付款依据。',
    'Рейсы, водители, движение и отклонения по маршруту.': '运输、司机、移动和路线偏差。',
    'Маршрут, точки рейса, фото и офлайн-доказательства.': '路线、运输节点、照片和离线证据。',
    'Приёмка, хранение, вес и статусы партии.': '验收、存储、重量和批次状态。',
    'Анализы, показатели качества и связь с приёмкой.': '检测、质量指标和验收关联。',
    'Осмотр, фиксация фактов и независимый доказательный слой.': '检查、事实记录和独立证据层。',
    'Основания для финансирования и расчётов по подтверждённым событиям.': '基于已确认事件的融资和结算依据。',
    'Доступы, действия участников и контроль правил.': '访问、参与方动作和规则控制。',
    'Спор, расхождения, пакет доказательств и решение по фактам.': '争议、差异、证据包和基于事实的决定。',
    'Расчёты, блокеры, роли, споры и ход исполнения.': '结算、阻断项、角色、争议和执行进度。',
    'Войти как оператор': '以运营方身份登录',
    'Войти как покупатель': '以买方身份登录',
    'Войти как продавец': '以卖方身份登录',
    'Войти как логистика': '以物流身份登录',
    'Войти как водитель': '以司机身份登录',
    'Войти как элеватор': '以粮仓身份登录',
    'Войти как лаборатория': '以实验室身份登录',
    'Войти как сюрвейер': '以检验员身份登录',
    'Войти как банк': '以银行身份登录',
    'Войти как комплаенс': '以合规身份登录',
    'Войти как арбитр': '以仲裁员身份登录',
    'Войти как руководитель': '以管理层身份登录',
    'Статус без догадок': '状态无需猜测',
    'Единая картина по этапам и участникам.': '按阶段和参与方形成统一视图。',
    'Юридически значимый след': '具有法律意义的轨迹',
    'События и документы связаны с исполнением сделки.': '事件和文件与交易执行相连。',
    'Контроль документов': '文件控制',
    'Комплектность, версии, сроки и ответственные под контролем.': '完整性、版本、期限和负责人均在控制中。',
    'Основа для расчётов': '结算基础',
    'Расчёт опирается на подтверждённые события.': '结算基于已确认事件。',
  },
};

function lang(): Lang {
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  return stored === 'en' || stored === 'zh' ? stored : 'ru';
}

function norm(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clean(value: unknown): Dict {
  if (!isRecord(value)) return {};
  const out: Dict = {};
  Object.entries(value).forEach(([key, raw]) => {
    const source = norm(key);
    if (!source || typeof raw !== 'string') return;
    const translated = raw.trim();
    if (translated) out[source] = translated;
  });
  return out;
}

function translate(source: string, selected: Lang, dictionary: Record<'en' | 'zh', Dict>) {
  if (selected === 'ru') return source;
  const key = norm(source);
  if (!key) return source;
  const dict = dictionary[selected];
  const exact = dict[key];
  if (exact) return exact;
  let next = source;
  for (const [from, to] of Object.entries(dict).sort((a, b) => b[0].length - a[0].length)) {
    if (from.length < 4 || !next.includes(from)) continue;
    next = next.split(from).join(to);
  }
  return next;
}

function keyFor(attribute: 'aria-label' | 'title' | 'placeholder') {
  if (attribute === 'aria-label') return 'pcLockAria';
  if (attribute === 'placeholder') return 'pcLockPlaceholder';
  return 'pcLockTitle';
}

function applyAttributeCopy(dictionary: Record<'en' | 'zh', Dict>) {
  const selected = lang();
  document.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    if (element.closest('script,style,noscript,svg,canvas,.pc-v7-login-single,.p7-translator-root,[data-p7-no-translate]')) return;
    (['aria-label', 'title', 'placeholder'] as const).forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;
      const key = keyFor(attribute);
      const source = element.dataset[key] || element.getAttribute(attribute) || '';
      if (!source) return;
      element.dataset[key] = source;
      const next = translate(source, selected, dictionary);
      if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
    });
  });
}

function applyOptionCopy(dictionary: Record<'en' | 'zh', Dict>) {
  const selected = lang();
  document.querySelectorAll<SourceOption>('select option').forEach((option) => {
    if (option.closest('.pc-v7-login-single,[data-p7-no-translate]')) return;
    const source = option.__pcLockOption || option.textContent || '';
    if (!norm(source)) return;
    option.__pcLockOption = source;
    const next = translate(source, selected, dictionary);
    if (option.textContent !== next) option.textContent = next;
  });
}

function skipText(element: HTMLElement) {
  return Boolean(element.closest('script,style,noscript,svg,canvas,textarea,input,select,option,code,pre,.pc-v7-login-single,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]'));
}

function applyExactText(dictionary: Record<'en' | 'zh', Dict>) {
  const selected = lang();
  if (selected === 'ru') return;
  document.querySelectorAll(EXACT_SCOPES).forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const element = node.parentElement;
        if (!element || skipText(element) || !norm(node.nodeValue || '')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = walker.nextNode() as SourceText | null;
    while (node) {
      const source = node.__pcExactCopy || node.nodeValue || '';
      node.__pcExactCopy = source;
      const exact = dictionary[selected][norm(source)];
      if (exact && node.nodeValue !== exact) node.nodeValue = exact;
      node = walker.nextNode() as SourceText | null;
    }
  });
}

function applyFloatingText(dictionary: Record<'en' | 'zh', Dict>) {
  const selected = lang();
  document.querySelectorAll(FLOATING_SCOPES).forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const element = node.parentElement;
        if (!element || skipText(element) || !norm(node.nodeValue || '')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = walker.nextNode() as SourceText | null;
    while (node) {
      const source = node.__pcFloatingCopy || node.nodeValue || '';
      node.__pcFloatingCopy = source;
      const next = translate(source, selected, dictionary);
      if (node.nodeValue !== next) node.nodeValue = next;
      node = walker.nextNode() as SourceText | null;
    }
  });
}

export function PublicHeaderFinalLock() {
  React.useEffect(() => {
    let dictionary = BASE;
    let frame = 0;
    const applyAll = () => {
      applyAttributeCopy(dictionary);
      applyOptionCopy(dictionary);
      applyExactText(dictionary);
      applyFloatingText(dictionary);
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(applyAll);
    };
    const load = async () => {
      try {
        const response = await fetch(DICTIONARY_URL, { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (!response.ok) return;
        const payload = await response.json();
        if (!isRecord(payload) || !isRecord(payload.dictionaries)) return;
        dictionary = { en: { ...BASE.en, ...clean(payload.dictionaries.en) }, zh: { ...BASE.zh, ...clean(payload.dictionaries.zh) } };
        schedule();
      } catch {
        schedule();
      }
    };
    schedule();
    void load();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
    const interval = window.setInterval(schedule, 1000);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <style>{`
      .entry-header-actions,
      .login-top,
      .p7-register-actions,
      .p7-contact-fixed-actions,
      .pc-v4-actions {
        display: flex !important;
        align-items: center !important;
      }

      .entry-header-actions .p7-translator-slot,
      .login-top .p7-translator-slot,
      .p7-register-actions .p7-translator-slot,
      .p7-contact-fixed-actions .p7-translator-slot,
      .pc-v4-actions .p7-translator-slot {
        display: inline-flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        flex: 0 0 auto !important;
        pointer-events: auto !important;
      }

      .entry-header-actions .p7-translator-button,
      .login-top .p7-translator-button,
      .p7-register-actions .p7-translator-button,
      .p7-contact-fixed-actions .p7-translator-button {
        width: 42px !important;
        min-width: 42px !important;
        height: 42px !important;
        padding: 0 !important;
      }

      .entry-header-actions .p7-translator-button span,
      .entry-header-actions .p7-translator-button b,
      .login-top .p7-translator-button span,
      .login-top .p7-translator-button b,
      .p7-register-actions .p7-translator-button span,
      .p7-register-actions .p7-translator-button b,
      .p7-contact-fixed-actions .p7-translator-button span,
      .p7-contact-fixed-actions .p7-translator-button b {
        display: none !important;
      }

      @media (max-width: 720px) {
        .entry-header {
          grid-template-columns: minmax(0, 1fr) auto !important;
        }

        .entry-header-actions {
          gap: 8px !important;
          min-width: max-content !important;
        }

        .entry-login {
          min-width: 84px !important;
          flex: 0 0 auto !important;
        }

        .entry-brand {
          max-width: calc(100dvw - 188px) !important;
          overflow: hidden !important;
        }
      }
    `}</style>
  );
}

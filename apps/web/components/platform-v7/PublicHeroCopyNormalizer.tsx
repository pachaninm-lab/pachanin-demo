'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type SourceText = Text & { __pcPublicSource?: string };

function currentLang(): Lang {
  const stored = window.localStorage.getItem('pc-v7-language');
  return stored === 'en' || stored === 'zh' ? stored : 'ru';
}

function setText(target: Element | null, value: string) {
  if (target && target.textContent !== value) target.textContent = value;
}

function setLastText(link: HTMLElement | null, value: string) {
  if (!link) return;
  const nodes = Array.from(link.childNodes);
  const textNode = nodes.reverse().find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode) {
    textNode.textContent = value;
    return;
  }
  link.append(document.createTextNode(value));
}

const copy = {
  ru: {
    brand: 'Прозрачная Цена',
    login: 'Войти',
    process: 'Порядок сделки',
    demoNav: 'Демонстрация',
    contactNav: 'Обращение',
    kicker: 'Единый вход в контур исполнения',
    h1: ['Главный риск сделки', 'начинается после', 'согласования цены'],
    lead: 'Прозрачная Цена — цифровой контур исполнения зерновой сделки: рейс, приёмка, качество, документы, деньги, спор и доказательства в одном процессе.',
    primary: 'Подключить организацию',
    demo: 'Демонстрационная сделка',
    contact: 'Направить обращение',
  },
  en: {
    brand: 'Transparent Price',
    login: 'Sign in',
    process: 'Deal flow',
    demoNav: 'Demo',
    contactNav: 'Request',
    kicker: 'Single entry to the execution circuit',
    h1: ['The main transaction risk', 'starts after', 'the price is agreed'],
    lead: 'Transparent Price is a digital execution circuit for a grain transaction: trip, acceptance, quality, documents, money, dispute, and evidence in one process.',
    primary: 'Connect an organisation',
    demo: 'Demo deal',
    contact: 'Send request',
  },
  zh: {
    brand: '透明价格',
    login: '登录',
    process: '交易流程',
    demoNav: '演示',
    contactNav: '请求',
    kicker: '进入执行闭环的统一入口',
    h1: ['交易的主要风险', '开始于', '价格确认之后'],
    lead: '透明价格是粮食交易的数字执行闭环：运输、验收、质量、文件、资金、争议和证据在一个流程中管理。',
    primary: '接入组织',
    demo: '演示交易',
    contact: '发送请求',
  },
} as const;

const publicText = {
  en: {
    'Что контролирует платформа': 'What the platform controls',
    'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': 'After the price is agreed, the key items remain under control: trip, acceptance, documents, quality, and payment grounds.',
    'Деньги': 'Money',
    'Основание для расчёта видно до выпуска оплаты.': 'The settlement basis is visible before payment release.',
    'Документы': 'Documents',
    'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ, EDI, transport documents, and acts are linked to deal events.',
    'Логистика': 'Logistics',
    'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': 'Trip, driver, route, and checkpoints are in one circuit.',
    'Качество': 'Quality',
    'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': 'Acceptance and laboratory indicators are considered before final settlement.',
    'Как проходит сделка': 'How the deal works',
    'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': 'At each stage it is clear what is confirmed, what requires action, and who owns the next step.',
    'Цена': 'Price',
    'Цена, объём, базис и допуски качества зафиксированы до рейса.': 'Price, volume, basis, and quality tolerances are fixed before the trip.',
    'Сделка': 'Deal',
    'Стороны, партия и условия исполнения сведены в единый контур.': 'Parties, lot, and execution terms are consolidated in one circuit.',
    'Рейс': 'Trip',
    'Маршрут, водитель, транспорт и контрольные точки назначены.': 'Route, driver, vehicle, and checkpoints are assigned.',
    'Приёмка': 'Acceptance',
    'Вес, факт поставки и расхождения фиксируются на элеваторе.': 'Weight, delivery fact, and discrepancies are recorded at the elevator.',
    'Расчёт': 'Settlement',
    'Оплата проводится после подтверждения оснований.': 'Payment is made after the grounds are confirmed.',
    'Спор': 'Dispute',
    'Разбор ведётся по зафиксированным данным.': 'Review is based on recorded data.',
    'Выберите свою роль в сделке': 'Select your role in the deal',
    'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': 'First select the participant role. Then sign in using login, password, and organisation.',
    'Подать заявку на роль': 'Apply for role',
  },
  zh: {
    'Что контролирует платформа': '平台控制什么',
    'После согласования цены под контролем остаётся главное: рейс, приёмка, документы, качество и основание для оплаты.': '价格确认后，关键事项仍在控制中：运输、验收、文件、质量和付款依据。',
    'Деньги': '资金',
    'Основание для расчёта видно до выпуска оплаты.': '付款释放前可以看到结算依据。',
    'Документы': '文件',
    'СДИЗ, ЭДО, транспортные документы и акты связаны с событиями сделки.': 'SDIZ、电子文件流、运输文件和验收文件与交易事件关联。',
    'Логистика': '物流',
    'Рейс, водитель, маршрут и контрольные точки находятся в одном контуре.': '运输、司机、路线和检查点都在一个闭环中。',
    'Качество': '质量',
    'Приёмка и лабораторные показатели учитываются до окончательного расчёта.': '最终结算前会考虑验收和实验室指标。',
    'Как проходит сделка': '交易流程',
    'На каждом этапе видно, что уже подтверждено, что требует действия и кто отвечает за следующий шаг.': '每个阶段都能看到已确认事项、待处理事项以及下一步负责人。',
    'Цена': '价格',
    'Цена, объём, базис и допуски качества зафиксированы до рейса.': '价格、数量、基准和质量容差在运输前固定。',
    'Сделка': '交易',
    'Стороны, партия и условия исполнения сведены в единый контур.': '各方、批次和执行条件被整合到一个闭环。',
    'Рейс': '运输',
    'Маршрут, водитель, транспорт и контрольные точки назначены.': '路线、司机、车辆和检查点已分配。',
    'Приёмка': '验收',
    'Вес, факт поставки и расхождения фиксируются на элеваторе.': '重量、交付事实和差异在粮仓记录。',
    'Расчёт': '结算',
    'Оплата проводится после подтверждения оснований.': '付款在依据确认后执行。',
    'Спор': '争议',
    'Разбор ведётся по зафиксированным данным.': '复盘基于已记录数据。',
    'Выберите свою роль в сделке': '选择你在交易中的角色',
    'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': '先选择交易参与方角色，然后使用登录名、密码和组织进入。',
    'Подать заявку на роль': '申请角色',
  },
} as const;

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizePublicText(selected: Lang) {
  if (selected === 'ru') return;
  const map = publicText[selected];
  const root = document.querySelector('.pc-v7-public-entry');
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!normalize(node.nodeValue || '')) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest('.p7-translator-root,[data-p7-no-translate],script,style,noscript')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode() as SourceText | null;
  while (node) {
    const source = node.__pcPublicSource || node.nodeValue || '';
    node.__pcPublicSource = source;
    const next = map[normalize(source) as keyof typeof map];
    if (next && node.nodeValue !== next) node.nodeValue = next;
    node = walker.nextNode() as SourceText | null;
  }
}

function applyCopy() {
  const selected = currentLang();
  const c = copy[selected];
  document.documentElement.lang = selected === 'zh' ? 'zh-CN' : selected === 'en' ? 'en' : 'ru-RU';

  setText(document.querySelector('.pc-v7-public-entry .entry-brand strong'), c.brand);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-login'), c.login);

  document.querySelectorAll<HTMLAnchorElement>('.pc-v7-public-entry .entry-nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href === '#process') link.textContent = c.process;
    if (href === '/platform-v7/demo') link.textContent = c.demoNav;
    if (href === '/platform-v7/contact') link.textContent = c.contactNav;
  });

  setText(document.querySelector('.pc-v7-public-entry .entry-kicker'), c.kicker);
  document.querySelectorAll('.pc-v7-public-entry #entry-hero-title span').forEach((node, index) => setText(node, c.h1[index] || ''));
  setText(document.querySelector('.pc-v7-public-entry .entry-hero-copy p'), c.lead);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-primary-cta'), c.primary);
  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-secondary-cta'), c.demo);

  const contact = document.querySelector<HTMLAnchorElement>('.pc-v7-public-entry .entry-register-cta');
  if (contact) {
    contact.setAttribute('href', '/platform-v7/contact');
    setLastText(contact, c.contact);
  }

  normalizePublicText(selected);
}

export function PublicHeroCopyNormalizer() {
  React.useEffect(() => {
    applyCopy();
    const timers = [80, 220, 600, 1200, 2400].map((delay) => window.setTimeout(applyCopy, delay));
    const interval = window.setInterval(applyCopy, 900);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(interval);
    };
  }, []);

  return null;
}

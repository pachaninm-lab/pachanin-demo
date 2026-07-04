'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';

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

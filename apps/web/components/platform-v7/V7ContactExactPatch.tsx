'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type Dict = Record<string, string>;
type SourceText = Text & { __pcContactPatchSource?: string };

const KEY = 'pc-v7-language';
const SCOPE = '.p7-contact-page';

const EN: Dict = {
  'Навигация формы обращения': 'Request form navigation',
  'На главную Прозрачная Цена': 'To Transparent Price home',
  'Действия': 'Actions',
  'Обратная связь': 'Feedback',
  'Направить обращение по платформе': 'Send a platform request',
  'Назначение формы': 'Form purpose',
  'Обращение без регистрации': 'Request without registration',
  'Можно задать вопрос без выбора роли и без входа в рабочий кабинет.': 'You can ask a question without selecting a role or signing in to a workspace.',
  'Только канал связи': 'Communication channel only',
  'Форма принимает обращение и контакт для ответа, но не открывает доступ к сделкам.': 'The form accepts a request and response contact, but does not open access to deals.',
  'Подключение отдельно': 'Onboarding is separate',
  'Заявка на подключение организации оформляется через отдельную форму регистрации.': 'An organisation onboarding request is submitted through a separate registration form.',
  'Обращение отправлено': 'Request sent',
  'Данные обращения приняты. Ответ будет направлен по указанному контакту при условии его корректности.': 'The request data has been accepted. A response will be sent to the provided contact if it is valid.',
  'Вернуться к разбору сделки': 'Return to deal review',
  'Задать вопрос': 'Ask a question',
  'Тип вопроса': 'Question type',
  'По платформе': 'About the platform',
  'По пилоту': 'About the pilot',
  'Для банка / партнёра': 'For a bank / partner',
  'Для региона': 'For a region',
  'Технический вопрос': 'Technical question',
  'Другое': 'Other',
  'Имя': 'Name',
  'Организация': 'Organisation',
  'Телефон или email': 'Phone or email',
  'Сообщение': 'Message',
  'Фамилия и имя': 'Full name',
  'При наличии': 'If available',
  '+7... или email организации': '+7... or organisation email',
  'Согласен на обработку указанных данных для рассмотрения обращения.': 'I agree to processing the provided data to review the request.',
  'Отправить обращение': 'Send request',
};

const ZH: Dict = {
  'Навигация формы обращения': '请求表单导航',
  'На главную Прозрачная Цена': '返回透明价格首页',
  'Действия': '操作',
  'Обратная связь': '反馈',
  'Направить обращение по платформе': '发送平台请求',
  'Назначение формы': '表单用途',
  'Обращение без регистрации': '无需注册即可请求',
  'Можно задать вопрос без выбора роли и без входа в рабочий кабинет.': '无需选择角色或登录工作区即可提问。',
  'Только канал связи': '仅作为沟通渠道',
  'Форма принимает обращение и контакт для ответа, но не открывает доступ к сделкам.': '表单接收请求和回复联系方式，但不会开放交易访问。',
  'Подключение отдельно': '接入需单独办理',
  'Заявка на подключение организации оформляется через отдельную форму регистрации.': '组织接入申请通过单独注册表单提交。',
  'Обращение отправлено': '请求已发送',
  'Данные обращения приняты. Ответ будет направлен по указанному контакту при условии его корректности.': '请求数据已接收。如联系方式有效，将发送回复。',
  'Вернуться к разбору сделки': '返回交易复盘',
  'Задать вопрос': '提问',
  'Тип вопроса': '问题类型',
  'По платформе': '关于平台',
  'По пилоту': '关于试点',
  'Для банка / партнёра': '面向银行 / 合作伙伴',
  'Для региона': '面向地区',
  'Технический вопрос': '技术问题',
  'Другое': '其他',
  'Имя': '姓名',
  'Организация': '组织',
  'Телефон или email': '电话或邮箱',
  'Сообщение': '消息',
  'Фамилия и имя': '姓名',
  'При наличии': '如有',
  '+7... или email организации': '+7... 或组织邮箱',
  'Согласен на обработку указанных данных для рассмотрения обращения.': '我同意处理所提供的数据以审查请求。',
  'Отправить обращение': '发送请求',
};

function lang(): Lang {
  const value = window.localStorage.getItem(KEY);
  return value === 'en' || value === 'zh' ? value : 'ru';
}
function norm(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
function activeDict(selected: Lang) {
  return selected === 'en' ? EN : selected === 'zh' ? ZH : null;
}
function skip(element: HTMLElement) {
  return Boolean(element.closest('script,style,noscript,svg,canvas,textarea,input,select,option,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]'));
}
function run() {
  const selected = lang();
  const dict = activeDict(selected);
  if (!dict) return;
  document.querySelectorAll(SCOPE).forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const element = node.parentElement;
        if (!element || skip(element) || !norm(node.nodeValue || '')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = walker.nextNode() as SourceText | null;
    while (node) {
      const source = node.__pcContactPatchSource || node.nodeValue || '';
      node.__pcContactPatchSource = source;
      const next = dict[norm(source)];
      if (next && node.nodeValue !== next) node.nodeValue = next;
      node = walker.nextNode() as SourceText | null;
    }
  });
}

export function V7ContactExactPatch() {
  React.useEffect(() => {
    run();
    const schedule = () => window.requestAnimationFrame(run);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(run, 1200);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);
  return null;
}

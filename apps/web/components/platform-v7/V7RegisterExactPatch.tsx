'use client';

import * as React from 'react';
import { LANGUAGE_CHANGE_EVENT, LANGUAGE_STORAGE_KEY } from '@/lib/platform-v7/i18n/translation-runtime';

type Lang = 'ru' | 'en' | 'zh';
type Dict = Record<string, string>;
type SourceText = Text & { __pcRegisterPatchSource?: string };

type Field = 'aria-label' | 'title' | 'placeholder';

const SCOPE = '.p7-register-page';

const EN: Dict = {
  'Навигация регистрации участника': 'Participant registration navigation',
  'На главную Прозрачная Цена': 'To Transparent Price home',
  'Действия регистрации': 'Registration actions',
  'Прозрачная Цена': 'Transparent Price',
  'Войти': 'Sign in',
  'Выход': 'Exit',
  'Регистрация участника': 'Participant registration',
  'Подключение компании к': 'Connect a company to the',
  'контуру сделки': 'deal circuit',
  'Профиль, реквизиты, ответственный и согласия. После отправки заявка проходит проверку. Доступ в кабинет открывается после статуса «Допущен».': 'Profile, details, responsible person, and confirmations. After submission, the request is reviewed. Workspace access opens after the Approved status.',
  'Заявка → проверка → допуск': 'Request → review → approval',
  'Роль участника': 'Participant role',
  'Заявляемая роль': 'Requested role',
  'Роль указывается в заявке. Выбор роли здесь не обходит role-lock — доступ в рабочий кабинет открывается только после проверки и допуска участника.': 'The role is stated in the request. Selecting a role here does not bypass the role lock — workspace access opens only after participant review and approval.',
  'Продавец': 'Seller',
  'Покупатель': 'Buyer',
  'Логистика': 'Logistics',
  'Элеватор': 'Elevator',
  'Лаборатория': 'Laboratory',
  'Сюрвейер': 'Surveyor',
  'Банк': 'Bank',
  'Арбитр': 'Arbitrator',
  'Оператор': 'Operator',
  'Участник': 'Participant',
  'Тип участника': 'Participant type',
  'Юр. лицо / ИП / КФХ': 'Legal entity / sole proprietor / farm',
  'Название организации': 'Organisation name',
  'ООО «АгроГрейн»': 'AgroGrain LLC',
  'Регион': 'Region',
  'Тамбовская область': 'Tambov region',
  'Реквизиты и ответственный': 'Details and responsible person',
  'ИНН': 'TIN',
  '10 или 12 цифр': '10 or 12 digits',
  'КПП': 'Tax registration reason code',
  '9 цифр (для юр. лица)': '9 digits for a legal entity',
  'ОГРН / ОГРНИП': 'OGRN / OGRNIP',
  '13 или 15 цифр': '13 or 15 digits',
  'ФИО ответственного': 'Responsible person full name',
  'Иванов Иван Иванович': 'Ivan Ivanov',
  'Должность': 'Position',
  'Директор / Уполномоченный': 'Director / authorised person',
  'Телефон': 'Phone',
  'Email': 'Email',
  'Пароль': 'Password',
  'Согласия': 'Confirmations',
  'Согласен с правилами платформы': 'I accept the platform rules',
  'Согласен на обработку персональных данных': 'I consent to personal data processing',
  'Статусы проверки заявки': 'Request review statuses',
  'Заявка создана': 'Request created',
  'Ожидает проверки': 'Awaiting review',
  'Требуется уточнение': 'Clarification required',
  'Допущен': 'Approved',
  'Отклонён': 'Declined',
  'Заблокирован': 'Blocked',
  'Текущий статус заявки и причина уточнения видны участнику после отправки. Проверка участника — часть допуска к рабочему контуру; внешние подтверждения подключаются отдельно.': 'The current request status and clarification reason are visible to the participant after submission. Participant review is part of access admission to the work circuit; external confirmations are connected separately.',
  'Отправить заявку на проверку': 'Submit request for review',
  'Уже есть доступ — войти': 'Already have access — sign in',
};

const ZH: Dict = {
  'Навигация регистрации участника': '参与方注册导航',
  'На главную Прозрачная Цена': '返回透明价格首页',
  'Действия регистрации': '注册操作',
  'Прозрачная Цена': '透明价格',
  'Войти': '登录',
  'Выход': '退出',
  'Регистрация участника': '参与方注册',
  'Подключение компании к': '将公司接入',
  'контуру сделки': '交易闭环',
  'Профиль, реквизиты, ответственный и согласия. После отправки заявка проходит проверку. Доступ в кабинет открывается после статуса «Допущен».': '资料、信息、负责人和确认。提交后申请进入审核。状态为“已准入”后开放工作区访问。',
  'Заявка → проверка → допуск': '申请 → 审核 → 准入',
  'Роль участника': '参与方角色',
  'Заявляемая роль': '申请角色',
  'Роль указывается в заявке. Выбор роли здесь не обходит role-lock — доступ в рабочий кабинет открывается только после проверки и допуска участника.': '角色在申请中声明。此处选择角色不会绕过角色锁定；只有参与方审核和准入后才开放工作区访问。',
  'Продавец': '卖方',
  'Покупатель': '买方',
  'Логистика': '物流',
  'Элеватор': '粮库',
  'Лаборатория': '实验室',
  'Сюрвейер': '检验员',
  'Банк': '银行',
  'Арбитр': '仲裁员',
  'Оператор': '运营方',
  'Участник': '参与方',
  'Тип участника': '参与方类型',
  'Юр. лицо / ИП / КФХ': '法人 / 个体工商户 / 农场',
  'Название организации': '组织名称',
  'ООО «АгроГрейн»': 'AgroGrain LLC',
  'Регион': '地区',
  'Тамбовская область': '坦波夫州',
  'Реквизиты и ответственный': '信息和负责人',
  'ИНН': '税号',
  '10 или 12 цифр': '10或12位数字',
  'КПП': '税务登记原因代码',
  '9 цифр (для юр. лица)': '法人为9位数字',
  'ОГРН / ОГРНИП': 'OGRN / OGRNIP',
  '13 или 15 цифр': '13或15位数字',
  'ФИО ответственного': '负责人姓名',
  'Иванов Иван Иванович': 'Ivan Ivanov',
  'Должность': '职位',
  'Директор / Уполномоченный': '董事 / 授权人',
  'Телефон': '电话',
  'Email': '邮箱',
  'Пароль': '密码',
  'Согласия': '确认',
  'Согласен с правилами платформы': '我接受平台规则',
  'Согласен на обработку персональных данных': '我同意处理个人数据',
  'Статусы проверки заявки': '申请审核状态',
  'Заявка создана': '申请已创建',
  'Ожидает проверки': '等待审核',
  'Требуется уточнение': '需要补充说明',
  'Допущен': '已准入',
  'Отклонён': '已拒绝',
  'Заблокирован': '已锁定',
  'Текущий статус заявки и причина уточнения видны участнику после отправки. Проверка участника — часть допуска к рабочему контуру; внешние подтверждения подключаются отдельно.': '提交后，参与方可看到当前申请状态和补充说明原因。参与方审核是进入工作闭环准入的一部分；外部确认将单独接入。',
  'Отправить заявку на проверку': '提交审核申请',
  'Уже есть доступ — войти': '已有访问权限 — 登录',
};

function lang(): Lang {
  const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return value === 'en' || value === 'zh' ? value : 'ru';
}
function norm(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
function active(selected: Lang) {
  return selected === 'en' ? EN : selected === 'zh' ? ZH : null;
}
function skip(element: HTMLElement) {
  return Boolean(element.closest('script,style,noscript,svg,canvas,textarea,input,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]'));
}
function attrKey(attribute: Field) {
  if (attribute === 'aria-label') return 'pcRegisterAria';
  if (attribute === 'placeholder') return 'pcRegisterPlaceholder';
  return 'pcRegisterTitle';
}
function run() {
  const selected = lang();
  const dict = active(selected);
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
      const source = node.__pcRegisterPatchSource || node.nodeValue || '';
      node.__pcRegisterPatchSource = source;
      const next = dict?.[norm(source)] ?? source;
      if (node.nodeValue !== next) node.nodeValue = next;
      node = walker.nextNode() as SourceText | null;
    }
    (root as Element).querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
      (['aria-label', 'title', 'placeholder'] as const).forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const key = attrKey(attribute);
        const source = element.dataset[key] || element.getAttribute(attribute) || '';
        element.dataset[key] = source;
        const next = dict?.[norm(source)] ?? source;
        if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
      });
    });
  });
}

export function V7RegisterExactPatch() {
  React.useEffect(() => {
    run();
    const schedule = () => window.requestAnimationFrame(run);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder'] });
    window.addEventListener(LANGUAGE_CHANGE_EVENT, schedule);
    window.addEventListener('storage', schedule);
    const interval = window.setInterval(run, 800);
    return () => {
      observer.disconnect();
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, schedule);
      window.removeEventListener('storage', schedule);
      window.clearInterval(interval);
    };
  }, []);
  return null;
}

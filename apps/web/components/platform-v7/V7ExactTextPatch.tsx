'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type Dict = Record<string, string>;
type SourceText = Text & { __pcExactPatchSource?: string };

const KEY = 'pc-v7-language';
const SCOPES = '.pc-v7-public-entry, .pc-v7-login-single, .p7-contact-page, .p7-support-chat-panel, [role="dialog"], .pc-shell-root-v4, .seller-cockpit';

const EN: Dict = {
  'единый вход в контур исполнения сделки': 'single entry to the deal execution circuit',
  'Форма входа': 'Sign-in form',
  'Рабочее место': 'Workspace',
  'Контур доступа': 'Access circuit',
  'Корпоративный доступ': 'Corporate access',
  'рабочее место фиксируется при входе': 'the workspace is fixed at sign-in',
  'права доступа применяются по профилю': 'access rights are applied by profile',
  'операции доступны только в рамках роли': 'operations are available only within the role',
  'регистрация оформляется отдельной заявкой': 'registration is handled by a separate request',
  'Выберите рабочее место.': 'Select a workspace.',
  'Заполни логин, пароль и организацию. Кабинет открывается только после формы входа.': 'Fill in login, password, and organisation. The workspace opens only after the sign-in form.',
  'имя@компания.рф': 'name@company.com',
  'Поддержка Прозрачной Цены': 'Transparent Price Support',
  'Тема': 'Topic',
  'Платформа': 'Platform',
  'Имя': 'Name',
  'Вопрос': 'Question',
  'Отправить': 'Send',
  'Коротко опишите вопрос по платформе, пилоту, доступу, документам или техническому подключению.': 'Briefly describe your question about the platform, pilot, access, documents, or technical connection.',
  'Я даю согласие на обработку персональных данных для ответа на обращение и принимаю условия': 'I consent to personal data processing for a response to my request and accept the terms of the',
  'политики конфиденциальности': 'Privacy Policy',
  'Контур сделки': 'Deal circuit',
  'исполнение под контролем': 'execution under control',
  'согласована': 'agreed',
  'в работе': 'in progress',
  'ожидает факт': 'awaiting fact',
  'на сверке': 'under review',
  'после оснований': 'after grounds are confirmed',
  'ожидает акт': 'awaiting act',
  'Разобрать контур сделки': 'Review the deal circuit',
  'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': 'First select the participant role. Then sign in using login, password, and organisation.',
  'Мой резерв': 'My reserve',
  'Под удержанием': 'Held',
  'ожидает банковского подтверждения': 'awaits bank confirmation',
  'спорная часть по весу и качеству': 'disputed part by weight and quality',
  'Денежный резерв': 'Money reserve',
  'ожидает банк': 'awaiting bank',
  'КОРОТКИЙ ФАКТ': 'SHORT FACT',
  'Сделка не переходит к логистике до банковского статуса': 'The deal does not move to logistics before bank status',
  'БЛОКЕР / ПРИЧИНА': 'BLOCKER / REASON',
  'Резерв ещё не подтверждён банком': 'The reserve has not yet been confirmed by the bank',
  'ОСНОВАНИЕ': 'BASIS',
  'Платформа показывает запрос и причину ожидания; банк подтверждает статус': 'The platform shows the request and waiting reason; the bank confirms the status',
  'СЛЕДУЮЩИЙ ШАГ': 'NEXT STEP',
  'Запросить подтверждение резерва': 'Request reserve confirmation',
  'Деньги, резерв и удержание': 'Money, reserve, and hold',
  'Документы и СДИЗ покупателя': 'Buyer documents and SDIZ',
  'Блокеры и путь разблокировки': 'Blockers and unblock path',
  'Рабочие действия и передача': 'Work actions and handoff',
  'Журнал событий': 'Event journal',
};

const ZH: Dict = {
  'единый вход в контур исполнения сделки': '进入交易执行闭环的统一入口',
  'Форма входа': '登录表单',
  'Рабочее место': '工作区',
  'Контур доступа': '访问闭环',
  'Корпоративный доступ': '企业访问',
  'рабочее место фиксируется при входе': '登录时固定工作区',
  'права доступа применяются по профилю': '按用户资料应用访问权限',
  'операции доступны только в рамках роли': '操作仅在角色范围内可用',
  'регистрация оформляется отдельной заявкой': '注册通过单独申请处理',
  'Выберите рабочее место.': '请选择工作区。',
  'Заполни логин, пароль и организацию. Кабинет открывается только после формы входа.': '请填写登录名、密码和组织。工作区仅在提交登录表单后打开。',
  'имя@компания.рф': 'name@company.com',
  'Поддержка Прозрачной Цены': '透明价格支持',
  'Тема': '主题',
  'Платформа': '平台',
  'Имя': '姓名',
  'Вопрос': '问题',
  'Отправить': '发送',
  'Коротко опишите вопрос по платформе, пилоту, доступу, документам или техническому подключению.': '请简要描述关于平台、试点、访问、文件或技术连接的问题。',
  'Я даю согласие на обработку персональных данных для ответа на обращение и принимаю условия': '我同意为回复请求而处理个人数据，并接受',
  'политики конфиденциальности': '隐私政策',
  'Контур сделки': '交易闭环',
  'исполнение под контролем': '执行受控',
  'согласована': '已确认',
  'в работе': '进行中',
  'ожидает факт': '等待事实',
  'на сверке': '审核中',
  'после оснований': '依据确认后',
  'ожидает акт': '等待单据',
  'Разобрать контур сделки': '复盘交易闭环',
  'Сначала выберите роль участника сделки. После этого вход выполняется по логину, паролю и организации.': '先选择交易参与方角色，然后使用登录名、密码和组织进入。',
  'Мой резерв': '我的预留',
  'Под удержанием': '冻结中',
  'ожидает банковского подтверждения': '等待银行确认',
  'спорная часть по весу и качеству': '重量和质量争议部分',
  'Денежный резерв': '资金预留',
  'ожидает банк': '等待银行',
  'КОРОТКИЙ ФАКТ': '简要事实',
  'Сделка не переходит к логистике до банковского статуса': '银行状态确认前，交易不进入物流',
  'БЛОКЕР / ПРИЧИНА': '阻断项 / 原因',
  'Резерв ещё не подтверждён банком': '预留尚未由银行确认',
  'ОСНОВАНИЕ': '依据',
  'Платформа показывает запрос и причину ожидания; банк подтверждает статус': '平台显示请求和等待原因；银行确认状态',
  'СЛЕДУЮЩИЙ ШАГ': '下一步',
  'Запросить подтверждение резерва': '请求确认预留',
  'Деньги, резерв и удержание': '资金、预留和冻结',
  'Документы и СДИЗ покупателя': '买方文件和SDIZ',
  'Блокеры и путь разблокировки': '阻断项和解锁路径',
  'Рабочие действия и передача': '工作动作和交接',
  'Журнал событий': '事件日志',
};

function lang(): Lang {
  const value = window.localStorage.getItem(KEY);
  return value === 'en' || value === 'zh' ? value : 'ru';
}
function norm(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
function dict(selected: Lang) {
  return selected === 'en' ? EN : selected === 'zh' ? ZH : null;
}
function skip(element: HTMLElement) {
  return Boolean(element.closest('script,style,noscript,svg,canvas,textarea,input,select,option,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]'));
}
function run() {
  const selected = lang();
  const active = dict(selected);
  if (!active) return;
  document.querySelectorAll(SCOPES).forEach((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const element = node.parentElement;
        if (!element || skip(element) || !norm(node.nodeValue || '')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = walker.nextNode() as SourceText | null;
    while (node) {
      const source = node.__pcExactPatchSource || node.nodeValue || '';
      node.__pcExactPatchSource = source;
      const next = active[norm(source)];
      if (next && node.nodeValue !== next) node.nodeValue = next;
      node = walker.nextNode() as SourceText | null;
    }
  });
}

export function V7ExactTextPatch() {
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

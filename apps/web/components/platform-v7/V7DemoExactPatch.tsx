'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type Dict = Record<string, string>;
type SourceText = Text & { __pcDemoPatchSource?: string };

type Field = 'aria-label' | 'title';

const KEY = 'pc-v7-language';
const SCOPE = '.p7-demo-page';

const EN: Dict = {
  'Навигация демонстрационной страницы': 'Demo page navigation',
  'Прозрачная Цена — на главную': 'Transparent Price — home',
  'Контур исполнения сделки': 'Deal execution circuit',
  'Действия демонстрационной страницы': 'Demo page actions',
  'Назад на главную': 'Back to home',
  'Задать вопрос': 'Ask a question',
  'Демонстрационный режим · без регистрации': 'Demo mode · no registration',
  'Как платформа контролирует исполнение зерновой сделки': 'How the platform controls grain deal execution',
  'На условном примере показан путь сделки после согласования цены: рейс, приёмка, качество, документы, расчёт и доказательная база. Рабочие кабинеты и реальные данные не открываются.': 'A sample case shows the deal path after price agreement: trip, acceptance, quality, documents, settlement, and evidence base. Workspaces and real data are not opened.',
  'Перейти к примеру': 'Go to example',
  'Текущий статус демонстрационной сделки': 'Current demo deal status',
  'Текущий статус': 'Current status',
  'Ожидается подтверждение качества и комплекта документов': 'Quality and document package confirmation is pending',
  'Расчёт не выполняется до подтверждения оснований. Это демонстрационный сценарий на условных данных.': 'Settlement is not performed until the grounds are confirmed. This is a demo scenario with sample data.',
  'Параметры демонстрационной сделки': 'Demo deal parameters',
  'Сделка': 'Deal',
  'Пшеница 4 класс': 'Class 4 wheat',
  'Сумма': 'Amount',
  'Действия с деньгами недоступны в демо.': 'Money actions are unavailable in the demo.',
  'Маршрут': 'Route',
  'Хозяйство → элеватор → покупатель': 'Farm → elevator → buyer',
  'Контроль ведётся по событиям исполнения.': 'Control is based on execution events.',
  'Карта исполнения сделки': 'Deal execution map',
  'Каждый этап показывает статус, ответственного участника и основание перехода к следующему действию.': 'Each stage shows status, responsible participant, and the basis for moving to the next action.',
  'Условия сделки': 'Deal terms',
  'Продавец · покупатель': 'Seller · buyer',
  'Выполнено': 'Done',
  'Цена, объём, базис поставки и допустимые показатели качества зафиксированы до рейса.': 'Price, volume, delivery basis, and quality tolerances are fixed before the trip.',
  'Рейс': 'Trip',
  'Логистика': 'Logistics',
  'Назначены маршрут, транспорт, водитель и контрольные точки исполнения.': 'Route, vehicle, driver, and execution checkpoints are assigned.',
  'Приёмка': 'Acceptance',
  'Элеватор': 'Elevator',
  'Фиксируются факт поставки, вес, расхождения и связь партии с документами.': 'Delivery fact, weight, discrepancies, and lot-document linkage are recorded.',
  'Качество': 'Quality',
  'Лаборатория': 'Laboratory',
  'На проверке': 'Under review',
  'Показатели качества проверяются до формирования окончательного основания для расчёта.': 'Quality indicators are reviewed before the final settlement basis is formed.',
  'Документы': 'Documents',
  'Стороны сделки': 'Deal parties',
  'Ожидает': 'Pending',
  'СДИЗ, ЭДО, транспортные документы и акты должны соответствовать событиям сделки.': 'SDIZ, EDI, transport documents, and acts must match deal events.',
  'Расчёт': 'Settlement',
  'Банк': 'Bank',
  'Основание для оплаты формируется после подтверждения приёмки, качества и документов.': 'Payment grounds are formed after acceptance, quality, and documents are confirmed.',
  'Основание для расчёта': 'Settlement basis',
  'Оплата зависит от подтверждённых событий': 'Payment depends on confirmed events',
  'Платформа показывает, какие условия уже закрыты и какие документы или данные требуются до расчёта. В демонстрационном режиме финансовые действия заблокированы.': 'The platform shows which conditions are closed and what documents or data are required before settlement. Financial actions are blocked in demo mode.',
  'Финансовые действия недоступны в демо': 'Financial actions are unavailable in demo',
  'Ролевые слои сделки': 'Deal role layers',
  'Участник получает только тот объём информации, который относится к его зоне ответственности.': 'Each participant receives only the information related to their responsibility area.',
  'Продавец': 'Seller',
  'Покупатель': 'Buyer',
  'Арбитр': 'Arbitrator',
  'Доказательная база': 'Evidence base',
  'Спор разбирается по следу сделки': 'A dispute is reviewed through the deal trail',
  'Если возникают расхождения, участники видят не переписку вразнобой, а связанный пакет фактов.': 'If discrepancies arise, participants see a linked fact package, not scattered messages.',
  'На главную': 'Home'
};

const ZH: Dict = {
  'Контур исполнения сделки': '交易执行闭环',
  'Назад на главную': '返回首页',
  'Задать вопрос': '提问',
  'Демонстрационный режим · без регистрации': '演示模式 · 无需注册',
  'Как платформа контролирует исполнение зерновой сделки': '平台如何控制粮食交易执行',
  'Перейти к примеру': '查看示例',
  'Текущий статус': '当前状态',
  'Ожидается подтверждение качества и комплекта документов': '等待质量和文件包确认',
  'Сделка': '交易',
  'Пшеница 4 класс': '四级小麦',
  'Сумма': '金额',
  'Маршрут': '路线',
  'Хозяйство → элеватор → покупатель': '农场 → 粮仓 → 买方',
  'Карта исполнения сделки': '交易执行地图',
  'Условия сделки': '交易条件',
  'Выполнено': '已完成',
  'Рейс': '运输',
  'Логистика': '物流',
  'Приёмка': '验收',
  'Элеватор': '粮仓',
  'Качество': '质量',
  'Лаборатория': '实验室',
  'На проверке': '审核中',
  'Документы': '文件',
  'Ожидает': '等待',
  'Расчёт': '结算',
  'Банк': '银行',
  'Основание для расчёта': '结算依据',
  'Оплата зависит от подтверждённых событий': '付款取决于已确认事件',
  'Финансовые действия недоступны в демо': '演示中财务操作不可用',
  'Ролевые слои сделки': '交易角色层',
  'Продавец': '卖方',
  'Покупатель': '买方',
  'Арбитр': '仲裁员',
  'Доказательная база': '证据基础',
  'Спор разбирается по следу сделки': '争议根据交易轨迹复盘',
  'На главную': '首页'
};

function lang(): Lang { const value = window.localStorage.getItem(KEY); return value === 'en' || value === 'zh' ? value : 'ru'; }
function norm(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function active(selected: Lang) { return selected === 'en' ? EN : selected === 'zh' ? ZH : null; }
function skip(element: HTMLElement) { return Boolean(element.closest('script,style,noscript,svg,canvas,textarea,input,select,option,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]')); }
function keyFor(field: Field) { return field === 'aria-label' ? 'pcDemoAria' : 'pcDemoTitle'; }
function run() {
  const selected = lang();
  const dict = active(selected);
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
      const source = node.__pcDemoPatchSource || node.nodeValue || '';
      node.__pcDemoPatchSource = source;
      const next = dict[norm(source)];
      if (next && node.nodeValue !== next) node.nodeValue = next;
      node = walker.nextNode() as SourceText | null;
    }
    (root as Element).querySelectorAll<HTMLElement>('[aria-label],[title]').forEach((element) => {
      (['aria-label', 'title'] as const).forEach((field) => {
        if (!element.hasAttribute(field)) return;
        const dataKey = keyFor(field);
        const source = element.dataset[dataKey] || element.getAttribute(field) || '';
        element.dataset[dataKey] = source;
        const next = dict[norm(source)];
        if (next && element.getAttribute(field) !== next) element.setAttribute(field, next);
      });
    });
  });
}

export function V7DemoExactPatch() {
  React.useEffect(() => {
    run();
    const schedule = () => window.requestAnimationFrame(run);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title'] });
    const interval = window.setInterval(run, 1200);
    return () => { observer.disconnect(); window.clearInterval(interval); };
  }, []);
  return null;
}

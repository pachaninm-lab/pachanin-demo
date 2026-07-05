'use client';

import * as React from 'react';

type Lang = 'ru' | 'en' | 'zh';
type Dict = Record<string, string>;
type SourceText = Text & { __pcDemoPatchSource?: string };

const KEY = 'pc-v7-language';
const SCOPE = '.p7-demo-page';

const EN: Dict = {
  'Контур исполнения сделки': 'Deal execution circuit',
  'Назад на главную': 'Back to home',
  'Задать вопрос': 'Ask a question',
  'Демонстрационный режим · без регистрации': 'Demo mode · no registration',
  'Как платформа контролирует исполнение зерновой сделки': 'How the platform controls grain deal execution',
  'Перейти к примеру': 'Go to example',
  'Текущий статус': 'Current status',
  'Ожидается подтверждение качества и комплекта документов': 'Quality and document package confirmation is pending',
  'Сделка': 'Deal',
  'Сумма': 'Amount',
  'Маршрут': 'Route',
  'Карта исполнения сделки': 'Deal execution map',
  'Условия сделки': 'Deal terms',
  'Выполнено': 'Done',
  'Рейс': 'Trip',
  'Логистика': 'Logistics',
  'Приёмка': 'Acceptance',
  'Элеватор': 'Elevator',
  'Качество': 'Quality',
  'Лаборатория': 'Laboratory',
  'На проверке': 'Under review',
  'Документы': 'Documents',
  'Ожидает': 'Pending',
  'Расчёт': 'Settlement',
  'Банк': 'Bank',
  'Основание для расчёта': 'Settlement basis',
  'Оплата зависит от подтверждённых событий': 'Payment depends on confirmed events',
  'Финансовые действия недоступны в демо': 'Financial actions are unavailable in demo',
  'Ролевые слои сделки': 'Deal role layers',
  'Доказательная база': 'Evidence base',
  'Спор разбирается по следу сделки': 'A dispute is reviewed through the deal trail',
  'На главную': 'Home',
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
  'Сумма': '金额',
  'Маршрут': '路线',
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
  'Доказательная база': '证据基础',
  'Спор разбирается по следу сделки': '争议根据交易轨迹复盘',
  'На главную': '首页',
};

function lang(): Lang { const value = window.localStorage.getItem(KEY); return value === 'en' || value === 'zh' ? value : 'ru'; }
function norm(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function active(selected: Lang) { return selected === 'en' ? EN : selected === 'zh' ? ZH : null; }
function skip(element: HTMLElement) { return Boolean(element.closest('script,style,noscript,svg,canvas,textarea,input,select,option,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]')); }
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
  });
}

export function V7DemoExactPatch() {
  React.useEffect(() => {
    run();
    const schedule = () => window.requestAnimationFrame(run);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(run, 1200);
    return () => { observer.disconnect(); window.clearInterval(interval); };
  }, []);
  return null;
}

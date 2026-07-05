'use client';

import { useEffect } from 'react';

type Lang = 'ru' | 'en' | 'zh';
const KEY = 'pc-v7-language';
const MAP: Record<string, { en: string; zh: string }> = {
  'Кабинет покупателя': { en: 'Buyer workspace', zh: '买方工作区' },
  'Кабинет продавца': { en: 'Seller workspace', zh: '卖方工作区' },
  'Кабинет оператора': { en: 'Operator workspace', zh: '运营方工作区' },
  'Кабинет банка': { en: 'Bank workspace', zh: '银行工作区' },
  'Кабинет логистики': { en: 'Logistics workspace', zh: '物流工作区' },
  'Кабинет водителя': { en: 'Driver workspace', zh: '司机工作区' },
  'Кабинет элеватора': { en: 'Elevator workspace', zh: '粮仓工作区' },
  'Кабинет лаборатории': { en: 'Laboratory workspace', zh: '实验室工作区' },
  'Кабинет арбитра': { en: 'Arbitrator workspace', zh: '仲裁员工作区' },
  'Кабинет комплаенса': { en: 'Compliance workspace', zh: '合规工作区' },
  'ПРОДАВЕЦ · КАБИНЕТ СДЕЛКИ': { en: 'SELLER · DEAL WORKSPACE', zh: '卖方 · 交易工作区' },
  'Главный блокер': { en: 'Main blocker', zh: '主要阻断项' },
  'СДИЗ и ЭТрН не закрыты': { en: 'SDIZ and eTTN are not closed', zh: 'SDIZ和电子运输单未关闭' },
  'Закрыть документы, чтобы передать основание банку': { en: 'Close documents to pass the basis to the bank', zh: '关闭文件以向银行传递依据' },
  'На проверку банку': { en: 'For bank review', zh: '提交银行审核' },
  'закрыть документы': { en: 'close documents', zh: '关闭文件' },
  'Закройте документы': { en: 'Close the documents', zh: '关闭文件' },
  'для банка': { en: 'for the bank', zh: '给银行' },
  'Подготовить документы': { en: 'Prepare documents', zh: '准备文件' },
  'Партии и лоты': { en: 'Lots and batches', zh: '批次和挂单' },
  'Выплаты по месяцу': { en: 'Monthly payouts', zh: '月度付款' },
  'данные демо': { en: 'demo data', zh: '演示数据' },
  'Сделок в работе': { en: 'Deals in progress', zh: '进行中的交易' },
  'Открытых споров': { en: 'Open disputes', zh: '未结争议' },
  'Что делать сейчас': { en: 'What to do now', zh: '现在要做什么' },
  'Следующий шаг': { en: 'Next step', zh: '下一步' },
  'Что произошло': { en: 'What happened', zh: '发生了什么' },
  'Что блокирует': { en: 'What blocks progress', zh: '阻断项' },
  'Ответственный': { en: 'Responsible party', zh: '负责人' },
  'Деньги под риском': { en: 'Money at risk', zh: '风险资金' },
  'Деньги и резерв': { en: 'Money and reserve', zh: '资金和预留' },
  'Открыть сделку': { en: 'Open deal', zh: '打开交易' },
  'Документы': { en: 'Documents', zh: '文件' },
  'Логистика': { en: 'Logistics', zh: '物流' },
  'Приёмка': { en: 'Acceptance', zh: '验收' },
  'Качество': { en: 'Quality', zh: '质量' },
  'Расчёт': { en: 'Settlement', zh: '结算' },
  'Спор': { en: 'Dispute', zh: '争议' },
  'Резерв ждёт банковского подтверждения': { en: 'Reserve awaits bank confirmation', zh: '预留等待银行确认' },
  'резерв ждёт подтверждение банка': { en: 'reserve awaits bank confirmation', zh: '预留等待银行确认' },
  'главный блокер': { en: 'main blocker', zh: '主要阻断项' },
  'готовность': { en: 'readiness', zh: '准备度' },
  'Уверенность к поставке': { en: 'Delivery confidence', zh: '交付置信度' },
  'Данные статичные — API недоступен': { en: 'Static data — API unavailable', zh: '静态数据 — API不可用' },
  'удержаний нет': { en: 'no holds', zh: '无冻结' },
  'Контур исполнения · Внешние подключения требуют договоров': { en: 'Execution circuit · External connections require contracts', zh: '执行闭环 · 外部连接需要合同' },
};

function readLang(): Lang { const value = window.localStorage.getItem(KEY); return value === 'en' || value === 'zh' ? value : 'ru'; }
function normalize(value: string) { return value.replace(/\s+/g, ' ').trim(); }
function skip(node: Text) { return Boolean(node.parentElement?.closest('script,style,noscript,svg,canvas,input,textarea,select,option,code,pre,.p7-translator-root,[data-p7-no-translate],[contenteditable="true"]')); }
function apply() {
  const lang = readLang();
  const root = document.querySelector('.pc-shell-root-v4') ?? document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as (Text & { __p7RoleSource?: string }) | null;
  while (node) {
    if (!skip(node)) {
      const source = node.__p7RoleSource ?? node.nodeValue ?? '';
      node.__p7RoleSource = source;
      const next = lang === 'ru' ? source : MAP[normalize(source)]?.[lang];
      if (next && node.nodeValue !== next) node.nodeValue = next;
    }
    node = walker.nextNode() as (Text & { __p7RoleSource?: string }) | null;
  }
}

export function RoleCockpitI18nGuard() {
  useEffect(() => {
    let frame = 0;
    const run = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(apply); };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(run, 700);
    window.addEventListener('storage', run);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); window.clearInterval(timer); window.removeEventListener('storage', run); };
  }, []);
  return null;
}

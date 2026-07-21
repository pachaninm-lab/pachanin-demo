'use client';

import * as React from 'react';

type Locale = 'ru' | 'en' | 'zh';
type ContextKey = 'platform' | 'deal' | 'roles' | 'evidence' | 'government';

const COPY: Record<Locale, Record<ContextKey, readonly string[]>> = {
  ru: {
    platform: ['Как работает платформа?', 'Что контролирует TAI?', 'Что ИИ не может делать?'],
    deal: ['Что блокирует расчёт?', 'Какие документы отсутствуют?', 'Какие данные не совпадают?'],
    roles: ['Что видит покупатель?', 'Что должен сделать элеватор?', 'Какие действия доступны банку?'],
    evidence: ['На чём основан вывод?', 'Какое событие создало ограничение?', 'Кто подтвердил документ?'],
    government: ['Что проверяется во ФГИС «Зерно»?', 'Подлинный ли сертификат?', 'Когда обновлялись данные?', 'Какая система не подключена?'],
  },
  en: {
    platform: ['How does the platform work?', 'What does TAI control?', 'What is AI not allowed to do?'],
    deal: ['What blocks settlement?', 'Which documents are missing?', 'Which data does not match?'],
    roles: ['What can the buyer see?', 'What must the elevator do?', 'Which actions are available to the bank?'],
    evidence: ['What is the conclusion based on?', 'Which event created the restriction?', 'Who confirmed the document?'],
    government: ['What is checked in FGIS Grain?', 'Is the certificate authentic?', 'When was the data updated?', 'Which system is not connected?'],
  },
  zh: {
    platform: ['平台如何运作？', 'TAI 控制什么？', 'AI 不能做什么？'],
    deal: ['什么阻塞了结算？', '缺少哪些文件？', '哪些数据不一致？'],
    roles: ['买方能看到什么？', '粮库需要做什么？', '银行可以执行哪些操作？'],
    evidence: ['结论基于什么？', '哪个事件产生了限制？', '谁确认了文件？'],
    government: ['FGIS 粮食检查什么？', '证书是否真实？', '数据何时更新？', '哪个系统尚未连接？'],
  },
};

const SECTION_CONTEXT: ReadonlyArray<{ id: string; context: ContextKey }> = [
  { id: 'deal-example', context: 'deal' },
  { id: 'participants', context: 'roles' },
  { id: 'evidence-contour', context: 'evidence' },
  { id: 'government-data', context: 'government' },
];

export function PublicContextualAssistantPrompts({ locale }: { locale: string }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const activeContextRef = React.useRef<ContextKey>('platform');

  React.useEffect(() => {
    const nodes = SECTION_CONTEXT
      .map(({ id, context }) => ({ node: document.getElementById(id), context }))
      .filter((item): item is { node: HTMLElement; context: ContextKey } => Boolean(item.node));

    const ratios = new Map<ContextKey, number>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const matched = nodes.find((item) => item.node === entry.target);
        if (matched) ratios.set(matched.context, entry.isIntersecting ? entry.intersectionRatio : 0);
      }
      const next = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0];
      activeContextRef.current = next && next[1] > 0 ? next[0] : 'platform';
    }, { rootMargin: '-20% 0px -45% 0px', threshold: [0, 0.2, 0.45, 0.7] });

    nodes.forEach(({ node }) => observer.observe(node));

    const handleRequest = () => {
      const context = activeContextRef.current;
      window.dispatchEvent(new CustomEvent('pc:public-assistant-context', {
        detail: { context, prompts: [...COPY[localeKey][context]] },
      }));
    };

    window.addEventListener('pc:public-assistant-context-request', handleRequest);
    return () => {
      observer.disconnect();
      window.removeEventListener('pc:public-assistant-context-request', handleRequest);
    };
  }, [localeKey]);

  return <span data-public-contextual-assistant-prompts='true' hidden />;
}

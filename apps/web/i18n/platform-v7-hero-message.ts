export type PlatformV7HeroMessage = {
  kicker: string;
  title: string;
  accent: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Для продавца, покупателя и всех участников исполнения',
    title: 'Цена согласована. Но сделка всё ещё может сорваться.',
    accent: '«Прозрачная Цена» доводит её до исполнения и расчёта.',
    lead: 'Поставка, качество, документы, логистика и деньги часто расходятся по разным системам. Платформа связывает их в одной Сделке, а собственный AI TAI показывает, где процесс остановился, кто отвечает и что делать дальше.',
  },
  en: {
    kicker: 'For sellers, buyers and every execution participant',
    title: 'The price is agreed. The Deal can still fail.',
    accent: 'Transparent Price carries it through execution and settlement.',
    lead: 'Delivery, quality, documents, logistics and money are often split across systems. The platform connects them in one Deal, while its own AI, TAI, shows where execution stopped, who owns it and what must happen next.',
  },
  zh: {
    kicker: '面向卖方、买方及所有履约参与方',
    title: '价格已经确定，但交易仍可能失败。',
    accent: '“透明价格”将交易推进至履约与结算。',
    lead: '交付、质量、文件、物流与资金往往分散在不同系统中。平台将其连接在同一笔交易内，自有 AI TAI 显示流程在哪里停止、谁负责以及下一步应做什么。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

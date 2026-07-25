export type PlatformV7HeroMessage = {
  kicker: string;
  title: string;
  accent: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Цифровая инфраструктура исполнения агросделки',
    title: 'Вся агросделка',
    accent: 'с TAI внутри',
    lead: 'Прозрачная Цена связывает торги, логистику, качество, документы и деньги от цены до расчёта. TAI видит блокеры, объясняет основания и готовит следующий шаг.',
  },
  en: {
    kicker: 'Digital infrastructure for agricultural Deal execution',
    title: 'The whole agricultural Deal',
    accent: 'with TAI inside',
    lead: 'Transparent Price connects trading, logistics, quality, documents and money from price to settlement. TAI detects blockers, explains the evidence and prepares the next action.',
  },
  zh: {
    kicker: '农业交易执行的数字基础设施',
    title: '完整农业交易',
    accent: '由 TAI 贯穿',
    lead: '“透明价格”将竞价、物流、质量、文件与资金从价格确定连接到结算。TAI 识别阻碍、解释依据并准备下一步行动。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

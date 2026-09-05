export type PlatformV7HeroMessage = {
  kicker: string;
  title: string;
  accent: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Платформа управления агросделками в растениеводстве\nс собственным искусственным интеллектом',
    title: 'Управляйте агросделкой',
    accent: 'от цены до расчёта',
    lead: 'Одна платформа связывает товар и условия, торги, договор, поставку, приёмку и качество, документы и расчёт. Каждый участник видит свою ответственность и следующий шаг; отклонение или спор подключаются только при необходимости. Гекта сопоставляет доступные факты, объясняет риск и помогает понять следующий разрешённый шаг.',
  },
  en: {
    kicker: 'Crop Deal management platform\nwith proprietary artificial intelligence',
    title: 'Manage an agricultural Deal',
    accent: 'from price to settlement',
    lead: 'One platform links product and terms, bidding, contract, delivery, acceptance and quality, documents and settlement. Every participant sees their responsibility and next step; deviation or dispute appears only when needed. Gekta compares available facts, explains risk and helps identify the next permitted action.',
  },
  zh: {
    kicker: '种植业农业交易管理平台\n配备自主人工智能',
    title: '管理农业交易',
    accent: '从价格到结算',
    lead: '一个平台连接商品与条件、竞价、合同、交付、验收与质量、文件和结算。每个参与方都能看到自己的责任和下一步；只有在确有需要时才进入偏差或争议。Gekta 对照可用事实、解释风险，并帮助理解允许的下一步。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

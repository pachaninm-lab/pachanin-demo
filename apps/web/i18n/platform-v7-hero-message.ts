export type PlatformV7HeroMessage = {
  kicker: string;
  brand: string;
  title: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Единая цифровая инфраструктура исполнения агросделки',
    brand: 'Прозрачная Цена',
    title: 'связывает товар, исполнение и деньги в одной Сделке',
    lead: 'От условий и аукциона до логистики, качества, документов, расчёта, спора и доказательств. На каждом этапе видны статус, блокер, ответственный, основание и следующий шаг.',
  },
  en: {
    kicker: 'Unified digital infrastructure for agricultural Deal execution',
    brand: 'Transparent Price',
    title: 'connects product, execution and money in one Deal',
    lead: 'From terms and auction through logistics, quality, documents, settlement, dispute and evidence. Every stage shows status, blocker, owner, basis and next action.',
  },
  zh: {
    kicker: '农业交易执行的统一数字基础设施',
    brand: '透明价格',
    title: '在一笔交易中连接商品、执行与资金',
    lead: '从条件和竞价到物流、质量、文件、结算、争议与证据。每个阶段都显示状态、阻塞项、责任方、依据和下一步。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

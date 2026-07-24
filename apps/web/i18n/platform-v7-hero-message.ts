export type PlatformV7HeroMessage = {
  kicker: string;
  brand: string;
  title: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Единая цифровая инфраструктура агросделки',
    brand: 'Контроль исполнения Сделки',
    title: 'от цены до расчёта и закрытия',
    lead: 'Товар, участники, логистика, качество, документы и деньги связаны в одной Сделке. Платформа показывает блокер, ответственного, основание и следующий шаг.',
  },
  en: {
    kicker: 'Unified digital infrastructure for agricultural trade',
    brand: 'Control Deal execution',
    title: 'from price to settlement and closure',
    lead: 'Product, participants, logistics, quality, documents and money stay connected in one Deal. The platform shows the blocker, owner, evidence and next action.',
  },
  zh: {
    kicker: '农业交易统一数字基础设施',
    brand: '控制交易执行',
    title: '从定价到结算与关闭',
    lead: '商品、参与方、物流、质量、文件与资金均关联在同一笔交易中。平台显示阻塞项、责任方、依据和下一步。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

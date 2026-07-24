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
    lead: 'Товар, логистика, качество, документы и деньги связаны в одной Сделке. Видны блокер, ответственный, основание и следующий шаг.',
  },
  en: {
    kicker: 'Unified digital infrastructure for agricultural trade',
    brand: 'Control Deal execution',
    title: 'from price to settlement and closure',
    lead: 'Product, logistics, quality, documents and money stay connected in one Deal. The blocker, owner, evidence and next action remain visible.',
  },
  zh: {
    kicker: '农业交易统一数字基础设施',
    brand: '控制交易执行',
    title: '从定价到结算与关闭',
    lead: '商品、物流、质量、文件与资金关联在同一笔交易中。阻塞项、责任方、依据和下一步清晰可见。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

export type PlatformV7HeroMessage = {
  kicker: string;
  brand: string;
  title: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Цифровая инфраструктура исполнения агросделки',
    brand: 'Одна Сделка',
    title: 'связывает товар, исполнение и деньги',
    lead: 'Торги, логистика, качество, документы и расчёт — в едином контуре с видимым статусом, основанием и следующим шагом.',
  },
  en: {
    kicker: 'Digital infrastructure for agricultural Deal execution',
    brand: 'One Deal',
    title: 'connects product, execution and money',
    lead: 'Trading, logistics, quality, documents and settlement stay in one framework with visible status, evidence and next action.',
  },
  zh: {
    kicker: '农业交易执行的数字基础设施',
    brand: '一笔交易',
    title: '连接商品、执行与资金',
    lead: '竞价、物流、质量、文件和结算位于同一闭环，状态、依据和下一步清晰可见。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

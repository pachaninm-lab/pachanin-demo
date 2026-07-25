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
    lead: 'Условия, торги, логистика, качество, документы и расчёт — в одном контуре. На каждом этапе видны статус, блокер, ответственный и следующий шаг.',
  },
  en: {
    kicker: 'Unified digital infrastructure for agricultural Deal execution',
    brand: 'Transparent Price',
    title: 'connects product, execution and money in one Deal',
    lead: 'Terms, auction, logistics, quality, documents and settlement stay in one Deal. Each stage shows the status, blocker, owner and next action.',
  },
  zh: {
    kicker: '农业交易执行的统一数字基础设施',
    brand: '透明价格',
    title: '在一笔交易中连接商品、执行与资金',
    lead: '条件、竞价、物流、质量、文件和结算都在同一笔交易中。每个阶段都显示状态、阻塞项、责任方和下一步。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

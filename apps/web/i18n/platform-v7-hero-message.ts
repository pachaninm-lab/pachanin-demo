export type PlatformV7HeroMessage = {
  kicker: string;
  brand: string;
  title: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Единый контур агробизнеса',
    brand: '«Прозрачная Цена»',
    title: '— единая цифровая инфраструктура исполнения агросделки.',
    lead: 'Платформа связывает цену, участников, логистику, качество, документы, расчёты и доказательства в одном управляемом контуре.',
  },
  en: {
    kicker: 'Unified agribusiness execution contour',
    brand: 'Transparent Price',
    title: 'is a unified digital infrastructure for agricultural transaction execution.',
    lead: 'The platform connects price, participants, logistics, quality, documents, settlement and evidence within one managed contour.',
  },
  zh: {
    kicker: '统一农业业务执行链路',
    brand: '透明价格',
    title: '是一体化农业交易执行数字基础设施。',
    lead: '平台在同一可管理链路中连接价格、参与方、物流、质量、文件、结算与证据。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

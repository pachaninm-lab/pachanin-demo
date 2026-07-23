export type PlatformV7HeroMessage = {
  kicker: string;
  brand: string;
  title: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Промышленная цифровая инфраструктура агробизнеса',
    brand: '«Прозрачная Цена»',
    title: '— единая цифровая инфраструктура исполнения агросделки.',
    lead: 'Платформа связывает цену, участников, логистику, качество, документы, расчёты и доказательства в одном управляемом контуре Сделки.',
  },
  en: {
    kicker: 'Industrial digital infrastructure for agribusiness',
    brand: 'Transparent Price',
    title: 'is a unified digital infrastructure for agricultural transaction execution.',
    lead: 'The platform connects price, participants, logistics, quality, documents, settlement and evidence within one governed Deal contour.',
  },
  zh: {
    kicker: '农业业务工业级数字基础设施',
    brand: '透明价格',
    title: '是一体化农业交易执行数字基础设施。',
    lead: '平台在同一受控交易链路中连接价格、参与方、物流、质量、文件、结算与证据。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

export type PlatformV7HeroMessage = {
  kicker: string;
  brand: string;
  title: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Цифровая инфраструктура исполнения сделок в растениеводстве',
    brand: '«Прозрачная Цена»',
    title: 'ведёт агросделку от цены до закрытия.',
    lead: 'Условия, участники, торги, логистика, приёмка, качество, документы, расчёты и доказательства связаны вокруг одной Сделки.',
  },
  en: {
    kicker: 'Digital infrastructure for crop-trade execution',
    brand: 'Transparent Price',
    title: 'carries an agricultural deal from price to closure.',
    lead: 'Terms, participants, trading, logistics, acceptance, quality, documents, settlement and evidence stay connected around one Deal.',
  },
  zh: {
    kicker: '种植业交易执行数字基础设施',
    brand: '透明价格',
    title: '贯通农业交易从定价到关闭的全过程。',
    lead: '条件、参与方、交易、物流、验收、质量、文件、结算与证据均围绕同一笔交易关联。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

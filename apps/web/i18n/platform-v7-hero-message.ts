export type PlatformV7HeroMessage = {
  kicker: string;
  title: string;
  accent: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Платформа управления агросделками в растениеводстве',
    title: 'От лота и цены',
    accent: 'до поставки, качества и расчёта',
    lead: '«Прозрачная Цена» связывает продавца, покупателя и исполнителей в одной Сделке — от размещения товара и торгов до поставки, качества, документов и расчёта.',
  },
  en: {
    kicker: 'Crop Deal management platform',
    title: 'From lot and price',
    accent: 'to delivery, quality and settlement',
    lead: 'Transparent Price connects seller, buyer and execution parties in one Deal — from product listing and bidding to delivery, quality, documents and settlement.',
  },
  zh: {
    kicker: '种植业农业交易管理平台',
    title: '从批次和价格',
    accent: '到交付、质量与结算',
    lead: '“透明价格”把卖方、买方和履约参与方连接在同一笔交易中——从商品发布和竞价到交付、质量、文件与结算。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

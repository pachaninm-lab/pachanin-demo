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
    lead: 'Для всех участников — от продавца и покупателя до логистики, качества и финансов — «Прозрачная Цена» ведёт одну агросделку от товара и торгов до поставки, качества, документов и расчёта. Каждый участник видит свою ответственность, какие факты и основания доступны и что делать дальше. Гекта помогает разобрать факты и риск, но не принимает решение вместо человека.',
  },
  en: {
    kicker: 'Crop Deal management platform\nwith proprietary artificial intelligence',
    title: 'Manage an agricultural Deal',
    accent: 'from price to settlement',
    lead: 'For every participant — from seller and buyer to logistics, quality and finance — Transparent Price keeps one agricultural Deal connected from product and bidding through delivery, quality, documents and settlement. Each participant sees their responsibility, the available facts and grounds, and what to do next. Gekta helps interpret facts and risk but does not decide instead of the user.',
  },
  zh: {
    kicker: '种植业农业交易管理平台\n配备自主人工智能',
    title: '管理农业交易',
    accent: '从价格到结算',
    lead: '“透明价格”面向交易中的所有参与方——从卖方、买方到物流、质量与金融角色——把一笔农业交易从商品和竞价一直连接到交付、质量、文件和结算。每个参与方都能看到自己的责任、可用事实与依据以及下一步要做什么。Gekta 帮助理解事实和风险，但不会替用户作出决定。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

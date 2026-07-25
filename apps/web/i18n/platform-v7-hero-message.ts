export type PlatformV7HeroMessage = {
  kicker: string;
  title: string;
  accent: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Для продавца, покупателя и партнёров исполнения',
    title: 'Цена согласована. Теперь нужно исполнить Сделку.',
    accent: '«Прозрачная Цена» доводит её до расчёта.',
    lead: 'Поставка, качество, документы и деньги — в одном контуре. Собственный AI TAI показывает блокер, ответственного, доказательства и следующий шаг.',
  },
  en: {
    kicker: 'For sellers, buyers and execution partners',
    title: 'The price is agreed. Now the Deal must be executed.',
    accent: 'Transparent Price carries it through settlement.',
    lead: 'Delivery, quality, documents and money stay in one execution framework. Its own AI, TAI, shows the blocker, owner, evidence and next action.',
  },
  zh: {
    kicker: '面向卖方、买方及履约合作方',
    title: '价格已经确定。现在需要完成交易履约。',
    accent: '“透明价格”将交易推进至结算。',
    lead: '交付、质量、文件与资金处于同一履约闭环。自有 AI TAI 显示阻塞点、责任方、证据和下一步行动。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

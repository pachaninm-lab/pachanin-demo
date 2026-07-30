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
    lead: 'Одна платформа управляет торгами, договором, поставкой, приёмкой, качеством, документами, расчётом и спором. TAI сопоставляет данные Сделки, объясняет отклонения и показывает следующий шаг с источниками.',
  },
  en: {
    kicker: 'Crop Deal management platform\nwith proprietary artificial intelligence',
    title: 'Manage an agricultural Deal',
    accent: 'from price to settlement',
    lead: 'One platform manages trading, contract, delivery, acceptance, quality, documents, settlement and disputes. TAI matches Deal data, explains deviations and shows the next step with sources.',
  },
  zh: {
    kicker: '种植业农业交易管理平台\n配备自主人工智能',
    title: '管理农业交易',
    accent: '从价格到结算',
    lead: '一个平台统一管理竞价、合同、交付、验收、质量、文件、结算与争议。TAI 对照交易数据，解释偏差，并附带来源给出下一步。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

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
    lead: 'Одна платформа управляет торгами и исполнением: производитель, покупатель, логистика, элеватор, лаборатория, финансы и контроль работают по одной версии Сделки — от лота до расчёта и спора. TAI сопоставляет факты, объясняет отклонения и показывает следующий шаг с источниками.',
  },
  en: {
    kicker: 'Crop Deal management platform\nwith proprietary artificial intelligence',
    title: 'Manage an agricultural Deal',
    accent: 'from price to settlement',
    lead: 'One platform manages bidding and execution: producer, buyer, logistics, storage, laboratory, finance and control use one Deal version from lot to settlement and dispute. TAI matches facts, explains deviations and shows the next step with sources.',
  },
  zh: {
    kicker: '种植业农业交易管理平台\n配备自主人工智能',
    title: '管理农业交易',
    accent: '从价格到结算',
    lead: '一个平台统一管理竞价与履约：生产商、买方、物流、仓储、实验室、金融与控制角色使用同一版本的交易，从批次一直到结算与争议。TAI 对照事实、解释偏差，并附带来源给出下一步。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

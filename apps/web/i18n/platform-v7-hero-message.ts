export type PlatformV7HeroMessage = {
  kicker: string;
  title: string;
  accent: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Цифровая инфраструктура исполнения агросделки',
    title: 'Одна Сделка',
    accent: 'интеллект на каждом этапе',
    lead: 'Прозрачная Цена связывает торги, логистику, качество, документы и деньги в одном контуре. TAI выявляет блокеры, объясняет основания и готовит следующий шаг — до расчёта и закрытия.',
  },
  en: {
    kicker: 'Digital infrastructure for agricultural Deal execution',
    title: 'One Deal',
    accent: 'intelligence at every stage',
    lead: 'Transparent Price connects trading, logistics, quality, documents and money in one execution framework. TAI detects blockers, explains the evidence and prepares the next action through settlement and closure.',
  },
  zh: {
    kicker: '农业交易执行的数字基础设施',
    title: '一笔交易',
    accent: '每个阶段都有智能支持',
    lead: '“透明价格”将竞价、物流、质量、文件与资金连接在同一执行闭环中。TAI 识别阻碍、解释依据并准备下一步行动，直至结算与关闭。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

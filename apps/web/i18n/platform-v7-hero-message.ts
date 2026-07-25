export type PlatformV7HeroMessage = {
  kicker: string;
  title: string;
  accent: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Цифровая инфраструктура исполнения агросделки',
    title: 'Одна Сделка.',
    accent: 'TAI помогает на каждом этапе.',
    lead: 'Торги, логистика, качество, документы и деньги — в одной Сделке. TAI выявляет блокеры, объясняет основания и готовит следующий шаг.',
  },
  en: {
    kicker: 'Digital infrastructure for agricultural Deal execution',
    title: 'One Deal.',
    accent: 'TAI supports every stage.',
    lead: 'Trading, logistics, quality, documents and money stay in one Deal. TAI detects blockers, explains the evidence and prepares the next action.',
  },
  zh: {
    kicker: '农业交易执行的数字基础设施',
    title: '一笔交易。',
    accent: 'TAI 支持每个阶段。',
    lead: '竞价、物流、质量、文件与资金统一在一笔交易中。TAI 识别阻碍、解释依据并准备下一步行动。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

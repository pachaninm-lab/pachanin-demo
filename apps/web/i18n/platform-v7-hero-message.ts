export type PlatformV7HeroMessage = {
  kicker: string;
  title: string;
  accent: string;
  lead: string;
};

const messages: Record<'ru' | 'en' | 'zh', PlatformV7HeroMessage> = {
  ru: {
    kicker: 'Платформа управления агросделками в растениеводстве',
    title: 'Управляйте агросделкой',
    accent: 'от цены до расчёта',
    lead: 'Одна платформа связывает торги, договор, поставку, приёмку, лабораторию, документы, готовность расчёта и спор. TAI находит отклонения и объясняет следующий шаг, но решение остаётся за участником.',
  },
  en: {
    kicker: 'Crop Deal execution platform',
    title: 'Manage an agricultural Deal',
    accent: 'from price to settlement',
    lead: 'One platform connects trading, contract, delivery, acceptance, laboratory, documents, settlement readiness and disputes. TAI detects deviations and explains the next step, while the participant retains authority.',
  },
  zh: {
    kicker: '种植业农业交易管理平台',
    title: '管理农业交易',
    accent: '从价格到结算',
    lead: '一个平台连接竞价、合同、交付、验收、实验室、文件、结算准备度和争议。TAI 发现偏差并解释下一步，但决定权仍由参与方掌握。',
  },
};

export function getPlatformV7HeroMessage(locale: string): PlatformV7HeroMessage {
  return locale === 'en' ? messages.en : locale === 'zh' ? messages.zh : messages.ru;
}

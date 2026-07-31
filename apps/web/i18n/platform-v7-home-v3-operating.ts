import { getPlatformV7HomeCopy as getBaseHomeCopy } from './platform-v7-home-v3';

const operatingCopy = {
  ru: {
    nav: { connect: 'Начать работу', status: 'Доверие и контроль' },
    hero: {
      primary: 'Посмотреть 7 шагов Сделки',
      secondary: 'Начать работу с платформой',
      tertiary: 'Посмотреть ИИ в работе',
      proofLabel: '12 ролей · 19 этапов · RU/EN/ZH · TAI',
    },
    lifecycle: {
      lead: 'Все 19 этапов связаны с одной Сделкой: видны факты, ответственный, основание, влияние на расчёт и следующий шаг.',
    },
    final: {
      title: 'Начните работу с полной системой агросделки',
      lead: 'Укажите организацию, роль и рабочую задачу. Платформа объединит участников, лот, торги, поставку, качество, документы, расчёт, спор и аналитику в одной Сделке.',
      primary: 'Начать работу',
      secondary: 'Посмотреть 7 шагов Сделки',
    },
    footer: {
      note: 'Единая система управления агросделкой: 12 ролей, 19 этапов и собственный ИИ TAI — от лота и торгов до расчёта, спора и закрытия.',
    },
  },
  en: {
    nav: { connect: 'Get started', status: 'Trust and control' },
    hero: {
      primary: 'See the 7 Deal steps',
      secondary: 'Start using the platform',
      tertiary: 'See AI in action',
      proofLabel: '12 roles · 19 stages · RU/EN/ZH · TAI',
    },
    lifecycle: {
      lead: 'All 19 stages belong to one Deal and show facts, owner, evidence, settlement impact and the next step.',
    },
    final: {
      title: 'Start working with the complete agricultural Deal system',
      lead: 'Provide the organisation, role and operating task. The platform unites participants, lot, bidding, delivery, quality, documents, settlement, dispute and analytics in one Deal.',
      primary: 'Get started',
      secondary: 'See the 7 Deal steps',
    },
    footer: {
      note: 'One agricultural Deal management system: 12 roles, 19 stages and proprietary TAI — from lot and bidding to settlement, dispute and closure.',
    },
  },
  zh: {
    nav: { connect: '开始使用', status: '信任与控制' },
    hero: {
      primary: '查看交易七步',
      secondary: '开始使用平台',
      tertiary: '查看 AI 如何工作',
      proofLabel: '12 个角色 · 19 个阶段 · RU/EN/ZH · TAI',
    },
    lifecycle: {
      lead: '全部 19 个阶段属于同一笔交易，并显示事实、责任方、依据、结算影响与下一步。',
    },
    final: {
      title: '开始使用完整农业交易系统',
      lead: '填写机构、角色和工作任务。平台将在同一笔交易中连接参与方、批次、竞价、交付、质量、文件、结算、争议与分析。',
      primary: '开始使用',
      secondary: '查看交易七步',
    },
    footer: {
      note: '统一农业交易管理系统：12 个角色、19 个阶段和自主 TAI，覆盖批次、竞价、结算、争议与关闭。',
    },
  },
} as const;

export function getPlatformV7HomeCopy(locale: string) {
  const base = getBaseHomeCopy(locale);
  const localized = locale === 'en' ? operatingCopy.en : locale === 'zh' ? operatingCopy.zh : operatingCopy.ru;

  return {
    ...base,
    nav: { ...base.nav, ...localized.nav },
    hero: { ...base.hero, ...localized.hero },
    lifecycle: { ...base.lifecycle, ...localized.lifecycle },
    final: { ...base.final, ...localized.final },
    footer: { ...base.footer, ...localized.footer },
  };
}

export type { HomeLocale } from './platform-v7-home-v3';

import { getPlatformV7HomeCopy as getBaseHomeCopy } from './platform-v7-home-v3';

const productCopy = {
  ru: {
    nav: { connect: 'Начать работу' },
    hero: {
      primary: 'Посмотреть Сделку в работе',
      secondary: 'Начать работу с платформой',
      tertiary: 'Посмотреть ИИ в работе',
      proofLabel: 'Единый контур исполнения Сделки',
    },
    lifecycle: {
      lead: 'На каждом этапе видны факты, ответственный, подтверждающее основание, влияние на расчёт и следующий шаг.',
    },
    final: {
      title: 'Начните работу с единой системой агросделки',
      lead: 'Подключите организацию, выберите роль и рабочую задачу. Платформа объединит участников, исполнение, документы, расчёты и контроль в одной Сделке.',
      primary: 'Начать подключение',
      secondary: 'Посмотреть Сделку в работе',
    },
    footer: {
      note: 'Единая система управления агросделкой: от условий и торгов до исполнения, расчёта, доказательств и закрытия.',
    },
  },
  en: {
    nav: { connect: 'Get started' },
    hero: {
      primary: 'See a Deal in action',
      secondary: 'Start using the platform',
      tertiary: 'See AI in action',
      proofLabel: 'Unified Deal execution workflow',
    },
    lifecycle: {
      lead: 'Every stage shows the facts, responsible party, supporting evidence, settlement impact and next step.',
    },
    final: {
      title: 'Start working in one agricultural Deal system',
      lead: 'Connect the organisation, select the role and operating task. The platform unites participants, execution, documents, settlement and control in one Deal.',
      primary: 'Start connection',
      secondary: 'See a Deal in action',
    },
    footer: {
      note: 'One agricultural Deal management system, from terms and trading through execution, settlement, evidence and closure.',
    },
  },
  zh: {
    nav: { connect: '开始使用' },
    hero: {
      primary: '查看交易运行',
      secondary: '开始使用平台',
      tertiary: '查看 AI 如何工作',
      proofLabel: '统一交易执行流程',
    },
    lifecycle: {
      lead: '每个阶段都显示事实、责任方、依据、结算影响与下一步。',
    },
    final: {
      title: '开始使用统一农业交易系统',
      lead: '接入机构，选择角色和工作任务。平台将在同一笔交易中连接参与方、执行、文件、结算与控制。',
      primary: '开始接入',
      secondary: '查看交易运行',
    },
    footer: {
      note: '统一农业交易管理系统，覆盖条件、竞价、执行、结算、证据与关闭。',
    },
  },
} as const;

export function getPlatformV7HomeCopy(locale: string) {
  const base = getBaseHomeCopy(locale);
  const localized = locale === 'en' ? productCopy.en : locale === 'zh' ? productCopy.zh : productCopy.ru;

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

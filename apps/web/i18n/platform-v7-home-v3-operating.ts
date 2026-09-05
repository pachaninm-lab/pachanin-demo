import { getPlatformV7HomeCopy as getBaseHomeCopy } from './platform-v7-home-v3';

const operatingCopy = {
  ru: {
    nav: { connect: 'Зарегистрироваться', status: 'Доверие и контроль' },
    hero: {
      primary: 'Посмотреть, как работает Сделка',
      secondary: 'Зарегистрироваться',
      tertiary: 'Скачать презентацию',
      proofLabel: 'Как платформа ведёт Сделку',
    },
    lifecycle: {
      lead: 'Семь понятных шагов ведут Сделку от товара и условий до расчёта и закрытия. На каждом шаге видны факты, ответственный, основание и следующий шаг.',
      hint: 'Семь шагов обычной Сделки.',
      phases: ['Товар и условия', 'Торги и контрагент', 'Сделка и договор', 'Логистика и поставка', 'Приёмка и качество', 'Документы и готовность расчёта', 'Расчёт и закрытие'],
    },
    final: {
      title: 'Начните работать с платформой',
      lead: 'Зарегистрируйтесь, подтвердите организацию и получите рабочий кабинет для своей роли. Помощь с подключением доступна отдельно и не заменяет регистрацию.',
      primary: 'Зарегистрироваться',
      secondary: 'Нужна помощь с подключением',
    },
    footer: {
      note: '«Прозрачная Цена» связывает участников, условия, исполнение, документы, качество и расчёт в одной проверяемой Сделке.',
    },
  },
  en: {
    nav: { connect: 'Register', status: 'Trust and control' },
    hero: {
      primary: 'See how a Deal works',
      secondary: 'Register',
      tertiary: 'Download presentation',
      proofLabel: 'How the platform runs a Deal',
    },
    lifecycle: {
      lead: 'Seven clear steps take a Deal from product and terms to settlement and closure. Every step shows facts, owner, evidence and the next action.',
      hint: 'Seven steps of an ordinary Deal.',
      phases: ['Product and terms', 'Bidding and counterparty', 'Deal and contract', 'Logistics and delivery', 'Acceptance and quality', 'Documents and settlement readiness', 'Settlement and closure'],
    },
    final: {
      title: 'Start using the platform',
      lead: 'Register, verify the organisation and receive the workspace for your role. Connection assistance is separate and does not replace registration.',
      primary: 'Register',
      secondary: 'Need connection assistance',
    },
    footer: {
      note: 'Transparent Price connects participants, terms, execution, documents, quality and settlement in one verifiable Deal.',
    },
  },
  zh: {
    nav: { connect: '注册', status: '信任与控制' },
    hero: {
      primary: '查看交易如何运行',
      secondary: '注册',
      tertiary: '下载演示文稿',
      proofLabel: '平台如何管理交易',
    },
    lifecycle: {
      lead: '七个清晰步骤把交易从商品与条件推进到结算与关闭，每一步都显示事实、责任方、依据和下一步。',
      hint: '普通交易的七个步骤。',
      phases: ['商品与条件', '竞价与交易方', '交易与合同', '物流与交付', '验收与质量', '文件与结算准备', '结算与关闭'],
    },
    final: {
      title: '开始使用平台',
      lead: '完成注册和机构核验后，即可进入与角色对应的工作空间。接入协助是独立服务，不替代注册。',
      primary: '注册',
      secondary: '需要接入协助',
    },
    footer: {
      note: '“透明价格”把参与方、条件、履约、文件、质量和结算连接到同一笔可核验交易中。',
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

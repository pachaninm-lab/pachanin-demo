import {
  getOrganizationConnectCopy as getBaseOrganizationConnectCopy,
  type OrganizationConnectCopy,
} from './platform-v7-organization-connect';

type Locale = 'ru' | 'en' | 'zh';
type SelectOption = OrganizationConnectCopy['scenarios'][number];

const scenarioLabels: Record<Locale, readonly SelectOption[]> = {
  ru: [
    { value: 'DEAL_EXECUTION', label: 'Полный цикл Сделки' },
    { value: 'LOGISTICS_ACCEPTANCE', label: 'Поставка, логистика и приёмка' },
    { value: 'QUALITY_LAB', label: 'Качество, лаборатория и перерасчёт' },
    { value: 'DOCUMENTS_EVIDENCE', label: 'Документы, подписи и доказательства' },
    { value: 'FINANCE_SETTLEMENT', label: 'Финансирование, расчёты и сверка' },
    { value: 'EXTERNAL_INTEGRATION', label: 'Единый обмен данными организации' },
  ],
  en: [
    { value: 'DEAL_EXECUTION', label: 'Complete Deal lifecycle' },
    { value: 'LOGISTICS_ACCEPTANCE', label: 'Delivery, logistics and acceptance' },
    { value: 'QUALITY_LAB', label: 'Quality, laboratory and recalculation' },
    { value: 'DOCUMENTS_EVIDENCE', label: 'Documents, signatures and evidence' },
    { value: 'FINANCE_SETTLEMENT', label: 'Financing, settlement and reconciliation' },
    { value: 'EXTERNAL_INTEGRATION', label: 'Unified organisation data exchange' },
  ],
  zh: [
    { value: 'DEAL_EXECUTION', label: '完整交易周期' },
    { value: 'LOGISTICS_ACCEPTANCE', label: '交付、物流与验收' },
    { value: 'QUALITY_LAB', label: '质量、实验室与重算' },
    { value: 'DOCUMENTS_EVIDENCE', label: '文件、签名与证据' },
    { value: 'FINANCE_SETTLEMENT', label: '融资、结算与对账' },
    { value: 'EXTERNAL_INTEGRATION', label: '机构统一数据交换' },
  ],
};

const operatingCopy = {
  ru: {
    eyebrow: 'Дополнительная помощь',
    title: 'Нужна помощь с подключением организации?',
    lead: 'Эта форма не является регистрацией. Используйте её, если после регистрации вам нужна помощь с рабочим сценарием, ролями или подключением внешних систем.',
    stepOneTitle: 'Организация и контакт',
    stepTwoTitle: 'Роль и задача для подключения',
    scenario: 'С чем нужна помощь',
    consent: 'Я согласен на обработку указанных данных для ответа по вопросу подключения организации к платформе.',
    submit: 'Отправить запрос на помощь',
    submitting: 'Отправляем запрос…',
    note: 'После отправки вы получите номер обращения. Для создания аккаунта используйте отдельную регистрацию платформы.',
    successTitle: 'Запрос принят',
    successText: 'Команда платформы свяжется по указанным контактам и продолжит работу по вашему вопросу подключения.',
  },
  en: {
    eyebrow: 'Optional assistance',
    title: 'Need help connecting your organisation?',
    lead: 'This form is not registration. Use it when you need help after registration with an operating scenario, roles or an external-system connection.',
    stepOneTitle: 'Organisation and contact',
    stepTwoTitle: 'Role and connection task',
    scenario: 'What you need help with',
    consent: 'I consent to processing the supplied data so the platform team can respond to my organisation-connection request.',
    submit: 'Send assistance request',
    submitting: 'Sending request…',
    note: 'After submission you receive a request number. Use the separate platform registration to create an account.',
    successTitle: 'Request accepted',
    successText: 'The platform team will contact you and continue work on your organisation-connection question.',
  },
  zh: {
    eyebrow: '可选接入协助',
    title: '需要协助接入机构？',
    lead: '此表单不是注册。完成注册后，如果需要工作场景、角色或外部系统接入方面的帮助，请使用此表单。',
    stepOneTitle: '机构与联系人',
    stepTwoTitle: '角色与接入任务',
    scenario: '需要哪方面帮助',
    consent: '我同意处理所填写的数据，以便平台团队回复机构接入问题。',
    submit: '发送协助请求',
    submitting: '正在发送请求…',
    note: '提交后你将获得请求编号。创建账户请使用平台独立注册入口。',
    successTitle: '请求已受理',
    successText: '平台团队将按所填联系方式联系你，并继续处理机构接入问题。',
  },
} as const;

function localeOf(locale: string): Locale {
  if (locale === 'en') return 'en';
  if (locale === 'zh') return 'zh';
  return 'ru';
}

export function getOrganizationConnectCopy(locale: string): OrganizationConnectCopy {
  const normalized = localeOf(locale);
  const base = getBaseOrganizationConnectCopy(normalized);
  const localized = operatingCopy[normalized];
  return {
    ...base,
    ...localized,
    scenarios: [...scenarioLabels[normalized]],
  };
}

export type { OrganizationConnectCopy, OrganizationConnectLocale } from './platform-v7-organization-connect';

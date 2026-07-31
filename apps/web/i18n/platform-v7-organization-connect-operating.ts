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
    eyebrow: 'Начало работы',
    title: 'Подключите организацию к полной системе агросделки',
    lead: 'Укажите организацию и контакт, затем выберите роль и рабочую задачу. Команда подключения получит контекст Сделки и подготовит подтверждённый следующий шаг.',
    stepOneTitle: 'Организация и контакт',
    stepTwoTitle: 'Роль и рабочая задача',
    scenario: 'Рабочая задача',
    consent: 'Я согласен на обработку указанных данных для подключения организации к платформе.',
    submit: 'Начать подключение',
    submitting: 'Регистрируем заявку…',
    note: 'После отправки вы получите номер заявки и подтверждённый следующий шаг.',
    successTitle: 'Заявка принята',
    successText: 'Команда подключения свяжется по указанным контактам, подтвердит задачу и продолжит работу по заявке.',
  },
  en: {
    eyebrow: 'Getting started',
    title: 'Connect the organisation to the complete agricultural Deal system',
    lead: 'Provide the organisation and contact, then select the role and operating task. The connection team receives the Deal context and prepares a confirmed next step.',
    stepOneTitle: 'Organisation and contact',
    stepTwoTitle: 'Role and operating task',
    scenario: 'Operating task',
    consent: 'I consent to processing the supplied data to connect the organisation to the platform.',
    submit: 'Start connection',
    submitting: 'Registering request…',
    note: 'After submission you receive a request number and a confirmed next step.',
    successTitle: 'Request accepted',
    successText: 'The connection team will contact you, confirm the task and continue work on the request.',
  },
  zh: {
    eyebrow: '开始使用',
    title: '将机构接入完整农业交易系统',
    lead: '填写机构和联系人，然后选择角色与工作任务。接入团队会收到交易上下文，并准备明确的下一步。',
    stepOneTitle: '机构与联系人',
    stepTwoTitle: '角色与工作任务',
    scenario: '工作任务',
    consent: '我同意为机构接入平台而处理所填写的数据。',
    submit: '开始接入',
    submitting: '正在登记申请…',
    note: '提交后，你将获得申请编号和明确的下一步。',
    successTitle: '申请已受理',
    successText: '接入团队将联系你、确认任务并继续处理申请。',
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

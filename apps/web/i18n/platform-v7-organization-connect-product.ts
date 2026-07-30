import {
  getOrganizationConnectCopy as getBaseOrganizationConnectCopy,
  type OrganizationConnectCopy,
} from './platform-v7-organization-connect';

const productCopy = {
  ru: {
    eyebrow: 'Начало работы',
    title: 'Начните работу с Прозрачной Ценой',
    lead: 'Укажите организацию и контакт, затем выберите роль и задачу. Заявка сразу поступит команде подключения.',
    stepOneTitle: 'Организация и контакт',
    stepTwoTitle: 'Роль и задача',
    scenario: 'Рабочая задача',
    consent: 'Я согласен на обработку указанных данных для подключения организации к платформе.',
    submit: 'Начать подключение',
    submitting: 'Регистрируем заявку…',
    note: 'После отправки вы получите номер заявки и подтверждённый следующий шаг.',
    successTitle: 'Заявка принята',
    successText: 'Команда подключения свяжется с вами по указанным контактам и продолжит работу по заявке.',
  },
  en: {
    eyebrow: 'Getting started',
    title: 'Start working with Transparent Price',
    lead: 'Provide the organisation and contact, then select the role and task. The request goes directly to the connection team.',
    stepOneTitle: 'Organisation and contact',
    stepTwoTitle: 'Role and task',
    scenario: 'Operating task',
    consent: 'I consent to processing the supplied data to connect the organisation to the platform.',
    submit: 'Start connection',
    submitting: 'Registering request…',
    note: 'After submission you receive a request number and a confirmed next step.',
    successTitle: 'Request accepted',
    successText: 'The connection team will contact you using the supplied details and continue work on the request.',
  },
  zh: {
    eyebrow: '开始使用',
    title: '开始使用透明价格',
    lead: '填写机构与联系人，然后选择角色和任务。申请将直接提交给接入团队。',
    stepOneTitle: '机构与联系人',
    stepTwoTitle: '角色与任务',
    scenario: '工作任务',
    consent: '我同意为机构接入平台而处理所填写的数据。',
    submit: '开始接入',
    submitting: '正在登记申请…',
    note: '提交后，你将获得申请编号和明确的下一步。',
    successTitle: '申请已受理',
    successText: '接入团队将通过所填写的联系方式与你联系，并继续处理申请。',
  },
} as const;

export function getOrganizationConnectCopy(locale: string): OrganizationConnectCopy {
  const base = getBaseOrganizationConnectCopy(locale);
  const localized = locale === 'en' ? productCopy.en : locale === 'zh' ? productCopy.zh : productCopy.ru;
  return { ...base, ...localized };
}

export type { OrganizationConnectCopy, OrganizationConnectLocale } from './platform-v7-organization-connect';

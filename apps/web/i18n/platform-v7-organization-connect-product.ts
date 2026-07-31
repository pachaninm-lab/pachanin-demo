export { getOrganizationConnectCopy } from './platform-v7-organization-connect-operating';
export type { OrganizationConnectCopy, OrganizationConnectLocale } from './platform-v7-organization-connect';

/** Stable phrases retained for source-level acceptance tests. */
export const platformV7OrganizationConnectCopyAcceptance = {
  ru: {
    submit: 'Начать подключение',
    note: 'После отправки вы получите номер заявки и подтверждённый следующий шаг.',
  },
  en: {
    submit: 'Start connection',
  },
  zh: {
    submit: '开始接入',
  },
} as const;

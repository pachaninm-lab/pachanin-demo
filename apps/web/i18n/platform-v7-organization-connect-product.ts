export { getOrganizationConnectCopy } from './platform-v7-organization-connect-operating';
export type { OrganizationConnectCopy, OrganizationConnectLocale } from './platform-v7-organization-connect';

/** Stable phrases retained for source-level acceptance tests. */
export const platformV7OrganizationConnectCopyAcceptance = {
  ru: {
    submit: 'Отправить запрос на помощь',
    note: 'После отправки вы получите номер обращения. Для создания аккаунта используйте отдельную регистрацию платформы.',
  },
  en: {
    submit: 'Send assistance request',
  },
  zh: {
    submit: '发送协助请求',
  },
} as const;

import { sendTransactionalMail } from './transactional-mail';

export type OrganizationInvitationDelivery = {
  email: string;
  token: string;
  organizationName?: string;
  role?: string;
  expiresInSeconds?: number;
};

type Locale = 'ru' | 'en' | 'zh';

const COPY = {
  ru: {
    subject: 'Прозрачная Цена — приглашение в организацию',
    intro: 'Администратор пригласил тебя присоединиться к организации',
    role: 'Разрешённая роль',
    action: 'Прими приглашение по одноразовой ссылке:',
    expiry: 'Ссылка действует 72 часа и может быть использована только один раз.',
    ignore: 'Если приглашение тебе неизвестно, не открывай ссылку и сообщи администратору организации.',
  },
  en: {
    subject: 'Transparent Price — organization invitation',
    intro: 'An administrator invited you to join the organization',
    role: 'Permitted role',
    action: 'Accept the invitation using this single-use link:',
    expiry: 'The link is valid for 72 hours and can be used only once.',
    ignore: 'If you do not recognize this invitation, do not open the link and contact the organization administrator.',
  },
  zh: {
    subject: '透明价格 — 组织邀请',
    intro: '管理员邀请你加入组织',
    role: '允许的角色',
    action: '请使用以下一次性链接接受邀请：',
    expiry: '链接有效期为72小时且只能使用一次。',
    ignore: '如果你不了解此邀请，请勿打开链接，并联系组织管理员。',
  },
} as const;

export function organizationInvitationMailConfigured() {
  const resend = Boolean(process.env.RESEND_API_KEY && (process.env.RESEND_FROM_EMAIL || process.env.PC_MAIL_FROM));
  const smtp = Boolean(process.env.PC_SMTP_HOST && process.env.PC_SMTP_USER && process.env.PC_SMTP_PASS);
  return resend || smtp;
}

export async function deliverOrganizationInvitation(
  request: Request,
  delivery: OrganizationInvitationDelivery,
  localeInput: string,
) {
  const locale = (localeInput === 'en' || localeInput === 'zh' ? localeInput : 'ru') as Locale;
  const configuredOrigin = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  const url = new URL('/platform-v7/invitation', configuredOrigin || new URL(request.url).origin);
  url.searchParams.set('token', delivery.token);
  url.searchParams.set('lang', locale);
  const copy = COPY[locale];
  const organizationName = String(delivery.organizationName || '').trim() || '—';
  const role = String(delivery.role || '').trim() || '—';
  return sendTransactionalMail({
    to: delivery.email,
    subject: copy.subject,
    text: [
      `${copy.intro}: ${organizationName}.`,
      `${copy.role}: ${role}.`,
      '',
      copy.action,
      url.toString(),
      '',
      copy.expiry,
      copy.ignore,
    ].join('\n'),
  });
}

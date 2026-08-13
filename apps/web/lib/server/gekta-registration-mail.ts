import { sendTransactionalMail } from '@/lib/server/transactional-mail';
import { publicOrigin } from './gekta-auth-bff';

const mailCopy = {
  ru: {
    subject: 'Гекта — подтвердите email',
    intro: 'Вы начали регистрацию в Гекте.',
    action: 'Подтвердите email по одноразовой ссылке:',
    expiry: 'Ссылка действует 30 минут. Затем Гекта попросит настроить обязательную двухфакторную защиту.',
    ignore: 'Если это были не вы, просто проигнорируйте письмо.',
  },
  en: {
    subject: 'Gekta — confirm your email',
    intro: 'You started creating a Gekta account.',
    action: 'Confirm your email using this single-use link:',
    expiry: 'The link is valid for 30 minutes. Gekta will then ask you to set up mandatory two-factor protection.',
    ignore: 'If this was not you, simply ignore this email.',
  },
  zh: {
    subject: 'Gekta — 确认电子邮箱',
    intro: '你已开始创建 Gekta 账户。',
    action: '请使用以下一次性链接确认电子邮箱：',
    expiry: '链接有效期为 30 分钟。随后 Gekta 会要求设置强制双重验证。',
    ignore: '如果不是你发起的操作，请忽略此邮件。',
  },
} as const;

export type GektaRegistrationLocale = keyof typeof mailCopy;

export function gektaRegistrationLocale(value: unknown): GektaRegistrationLocale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

export async function sendGektaVerificationMail(input: {
  request: Request;
  email: string;
  token: string;
  locale: GektaRegistrationLocale;
}) {
  const verifyUrl = new URL('/api/gekta/auth/email/verify', publicOrigin(input.request));
  verifyUrl.searchParams.set('token', input.token);
  verifyUrl.searchParams.set('lang', input.locale);
  const copy = mailCopy[input.locale];
  return sendTransactionalMail({
    to: input.email,
    subject: copy.subject,
    text: [copy.intro, '', copy.action, verifyUrl.toString(), '', copy.expiry, copy.ignore].join('\n'),
  });
}

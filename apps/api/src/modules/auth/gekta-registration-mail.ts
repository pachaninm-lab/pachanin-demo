import type { AuthMailEnvelope } from '../auth-mail/auth-mail-crypto';
import {
  normalizeAuthMailLocale,
  publicSiteOrigin,
  type AuthMailLocale,
} from '../auth-mail/auth-mail-templates';

const COPY: Record<AuthMailLocale, {
  initialSubject: string;
  resendSubject: string;
  initialIntro: string;
  resendIntro: string;
  action: string;
  expiry: string;
}> = {
  ru: {
    initialSubject: 'Гекта — подтвердите email',
    resendSubject: 'Гекта — новая ссылка подтверждения',
    initialIntro: 'Регистрация в Гекте начата.',
    resendIntro: 'Получен повторный запрос подтверждения email.',
    action: 'Откройте одноразовую ссылку:',
    expiry: 'Ссылка действует 30 минут и может быть использована только один раз.',
  },
  en: {
    initialSubject: 'Gekta — confirm your email',
    resendSubject: 'Gekta — new confirmation link',
    initialIntro: 'Your Gekta registration has started.',
    resendIntro: 'A new email-confirmation request was received.',
    action: 'Open this single-use link:',
    expiry: 'The link is valid for 30 minutes and can be used only once.',
  },
  zh: {
    initialSubject: 'Gekta — 确认电子邮箱',
    resendSubject: 'Gekta — 新的确认链接',
    initialIntro: '你的 Gekta 注册流程已开始。',
    resendIntro: '已收到新的电子邮箱确认请求。',
    action: '请打开以下一次性链接：',
    expiry: '该链接有效期为30分钟且只能使用一次。',
  },
};

export function gektaRegistrationVerificationMail(input: {
  to: string;
  token: string;
  locale: unknown;
  resend?: boolean;
}): AuthMailEnvelope {
  const locale = normalizeAuthMailLocale(input.locale);
  const selected = COPY[locale];
  const url = new URL('/api/gekta/auth/email/verify', publicSiteOrigin());
  url.searchParams.set('token', input.token);
  url.searchParams.set('lang', locale);

  return {
    to: input.to,
    subject: input.resend ? selected.resendSubject : selected.initialSubject,
    text: [
      input.resend ? selected.resendIntro : selected.initialIntro,
      '',
      selected.action,
      url.toString(),
      '',
      selected.expiry,
    ].join('\n'),
  };
}

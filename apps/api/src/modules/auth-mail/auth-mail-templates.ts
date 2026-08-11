import type { AuthMailEnvelope } from './auth-mail-crypto';

export const AUTH_MAIL_LOCALES = ['ru', 'en', 'zh'] as const;
export type AuthMailLocale = typeof AUTH_MAIL_LOCALES[number];

export function normalizeAuthMailLocale(value: unknown): AuthMailLocale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

function production(): boolean {
  return String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

export function publicSiteOrigin(): string {
  const configured = String(process.env.PC_PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '');
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && production()) throw new Error('PC_PUBLIC_SITE_URL must use HTTPS in production');
    return url.origin;
  }
  if (production()) throw new Error('PC_PUBLIC_SITE_URL is required in production for auth mail links');
  return 'http://localhost:3000';
}

export function registrationVerificationMail(input: {
  to: string;
  token: string;
  statusToken: string;
  locale: AuthMailLocale;
}): AuthMailEnvelope {
  const copy = {
    ru: {
      subject: 'Прозрачная Цена — подтвердите email',
      intro: 'Заявка на подключение к платформе «Прозрачная Цена» создана.',
      action: 'Подтвердите email по одноразовой ссылке:',
      expiry: 'Ссылка действует 30 минут. После подтверждения заявка перейдёт на проверку организации.',
    },
    en: {
      subject: 'Transparent Price — confirm your email',
      intro: 'Your application to join the Transparent Price platform has been created.',
      action: 'Confirm your email using this single-use link:',
      expiry: 'The link is valid for 30 minutes. After confirmation, the organization review will begin.',
    },
    zh: {
      subject: '透明价格 — 确认电子邮箱',
      intro: '你加入“透明价格”平台的申请已创建。',
      action: '请使用以下一次性链接确认电子邮箱：',
      expiry: '链接有效期为30分钟。确认后，组织审核将开始。',
    },
  } as const;
  const url = new URL('/platform-v7/register', publicSiteOrigin());
  url.searchParams.set('verify', input.token);
  url.searchParams.set('statusToken', input.statusToken);
  url.searchParams.set('lang', input.locale);
  const selected = copy[input.locale];
  return {
    to: input.to,
    subject: selected.subject,
    text: [selected.intro, '', selected.action, url.toString(), '', selected.expiry].join('\n'),
  };
}

export function passwordResetMail(input: {
  to: string;
  token: string;
  locale: AuthMailLocale;
}): AuthMailEnvelope {
  const copy = {
    ru: {
      subject: 'Прозрачная Цена — восстановление доступа',
      intro: 'Получен запрос на восстановление доступа к платформе «Прозрачная Цена».',
      action: 'Чтобы установить новый пароль, открой ссылку:',
      expiry: 'Ссылка действует 15 минут и может быть использована только один раз.',
      ignore: 'Если запрос отправил не ты, ничего не делай. Действующие сессии не изменятся.',
    },
    en: {
      subject: 'Transparent Price — restore access',
      intro: 'A request was received to restore access to the Transparent Price platform.',
      action: 'Open this link to set a new password:',
      expiry: 'The link is valid for 15 minutes and can be used only once.',
      ignore: 'If you did not make this request, no action is required. Existing sessions will remain unchanged.',
    },
    zh: {
      subject: '透明价格 — 恢复访问权限',
      intro: '我们收到了恢复“透明价格”平台访问权限的请求。',
      action: '请打开以下链接设置新密码：',
      expiry: '该链接有效期为15分钟且只能使用一次。',
      ignore: '如果不是你发起的请求，无需操作。现有会话不会改变。',
    },
  } as const;
  const url = new URL('/platform-v7/forgot-password', publicSiteOrigin());
  url.searchParams.set('token', input.token);
  url.searchParams.set('lang', input.locale);
  const selected = copy[input.locale];
  return {
    to: input.to,
    subject: selected.subject,
    text: [selected.intro, '', selected.action, url.toString(), '', selected.expiry, selected.ignore].join('\n'),
  };
}

export function passwordChangedMail(to: string): AuthMailEnvelope {
  return {
    to,
    subject: 'Прозрачная Цена — пароль изменён',
    text: [
      'Пароль доступа к платформе «Прозрачная Цена» был изменён.',
      '',
      'Все прежние сессии отозваны.',
      'Если это действие выполнил не ты, немедленно обратись в поддержку платформы.',
    ].join('\n'),
  };
}

export function organizationInvitationMail(input: {
  to: string;
  token: string;
  organizationName: string;
  role: string;
  locale?: AuthMailLocale;
}): AuthMailEnvelope {
  const locale = input.locale ?? 'ru';
  const url = new URL('/platform-v7/invitation', publicSiteOrigin());
  url.searchParams.set('token', input.token);
  url.searchParams.set('lang', locale);
  const copy = {
    ru: {
      subject: `Прозрачная Цена — приглашение в ${input.organizationName}`,
      text: `Тебя пригласили в организацию «${input.organizationName}» с ролью ${input.role}.\n\nПринять приглашение:\n${url.toString()}\n\nСсылка действует 72 часа и является одноразовой.`,
    },
    en: {
      subject: `Transparent Price — invitation to ${input.organizationName}`,
      text: `You were invited to ${input.organizationName} with role ${input.role}.\n\nAccept the invitation:\n${url.toString()}\n\nThe link is valid for 72 hours and is single-use.`,
    },
    zh: {
      subject: `透明价格 — ${input.organizationName} 邀请`,
      text: `你已被邀请加入 ${input.organizationName}，角色为 ${input.role}。\n\n接受邀请：\n${url.toString()}\n\n链接有效期为72小时且只能使用一次。`,
    },
  } as const;
  return { to: input.to, subject: copy[locale].subject, text: copy[locale].text };
}

export function registrationJoinReviewMail(input: {
  to: string;
  applicantName: string;
  applicantEmail: string;
  requestedWorkspace: string;
}): AuthMailEnvelope {
  return {
    to: input.to,
    subject: 'Прозрачная Цена — запрос сотрудника на вступление',
    text: [
      'Получен запрос на вступление в вашу организацию.',
      '',
      `Заявитель: ${input.applicantName || 'не указано'}`,
      `Email: ${input.applicantEmail}`,
      `Рабочее пространство: ${input.requestedWorkspace}`,
      '',
      'Проверьте запрос в личном кабинете организации. Решение должно приниматься только авторизованным администратором организации.',
    ].join('\n'),
  };
}

export function mfaRecoveryMail(input: { to: string; token: string; organizationName?: string }): AuthMailEnvelope {
  const url = new URL('/platform-v7/mfa-recovery', publicSiteOrigin());
  url.searchParams.set('token', input.token);
  return {
    to: input.to,
    subject: 'Прозрачная Цена — восстановление MFA',
    text: [
      'Запрошено восстановление многофакторной аутентификации.',
      input.organizationName ? `Организация: ${input.organizationName}` : '',
      '',
      'Продолжить восстановление:',
      url.toString(),
      '',
      'Ссылка действует 30 минут и может быть использована один раз.',
      'Если запрос отправил не ты, ничего не делай и сообщи администратору организации.',
    ].filter(Boolean).join('\n'),
  };
}

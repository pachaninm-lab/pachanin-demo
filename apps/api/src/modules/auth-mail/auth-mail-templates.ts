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

export function registrationDecisionMail(input: {
  to: string;
  status: string;
  reason: string | null;
}): AuthMailEnvelope {
  const status = String(input.status || 'UPDATED').trim().slice(0, 64);
  const reason = String(input.reason || 'RECORDED').trim().slice(0, 1000);
  return {
    to: input.to,
    subject: 'Прозрачная Цена — статус заявки / application status / 申请状态',
    text: [
      `Статус регистрационной заявки: ${status}. Основание: ${reason}. Откройте страницу статуса по исходной защищённой ссылке.`,
      '',
      `Registration application status: ${status}. Basis: ${reason}. Open the status page using the original protected link.`,
      '',
      `注册申请状态：${status}。依据：${reason}。请使用原始安全链接打开状态页面。`,
    ].join('\n'),
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
  const selected = copy[locale];
  return {
    to: input.to,
    subject: selected.subject,
    text: [
      `${selected.intro}: ${input.organizationName}.`,
      `${selected.role}: ${input.role}.`,
      '',
      selected.action,
      url.toString(),
      '',
      selected.expiry,
      selected.ignore,
    ].join('\n'),
  };
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

function russianMinutes(minutes: number): string {
  const tail = minutes % 100;
  if (tail >= 11 && tail <= 14) return 'минут';
  switch (minutes % 10) {
    case 1:
      return 'минуту';
    case 2:
    case 3:
    case 4:
      return 'минуты';
    default:
      return 'минут';
  }
}

/**
 * Nothing calls this. The MFA-recovery mail that actually reaches a mailbox is
 * built and sent web-side, in apps/web/lib/server/mfa-recovery-mail.ts, from
 * the delivery payload the API returns.
 *
 * It is kept because it is a template, not a control - deleting it removes no
 * enforcement - but it was stating a thirty-minute lifetime that no longer
 * matches the credential (ASVS 5.0 V6.5.5 caps an out-of-band request at ten
 * minutes, and MFA_RECOVERY_TTL_MS was brought down to it). An unreferenced
 * template that hardcodes a lifetime is a false claim waiting for a caller, so
 * the lifetime is now a required argument: whoever wires this up has to hand it
 * the real number and cannot inherit a stale one.
 */
export function mfaRecoveryMail(input: {
  to: string;
  token: string;
  expiresInMinutes: number;
  organizationName?: string;
  locale?: AuthMailLocale;
}): AuthMailEnvelope {
  const locale = input.locale ?? 'ru';
  const url = new URL('/platform-v7/mfa-recovery', publicSiteOrigin());
  url.searchParams.set('token', input.token);
  url.searchParams.set('lang', locale);
  const copy = {
    ru: {
      subject: 'Прозрачная Цена — подтверждение восстановления MFA',
      intro: 'Администратор вашей организации инициировал восстановление MFA.',
      action: 'Чтобы отозвать прежний MFA, подтвердите текущий пароль по одноразовой ссылке:',
      expiry: (minutes: number) =>
        `Ссылка действует ${minutes} ${russianMinutes(minutes)} и может быть использована только один раз.`,
      consequence: 'После подтверждения все активные сессии будут отозваны, а при следующем входе потребуется настроить новый TOTP и сохранить новые резервные коды.',
      ignore: 'Если вы не запрашивали восстановление, не открывайте ссылку и свяжитесь с владельцем организации.',
    },
    en: {
      subject: 'Transparent Price — confirm MFA recovery',
      intro: 'Your organization administrator initiated MFA recovery.',
      action: 'To revoke the previous MFA, confirm your current password using this single-use link:',
      expiry: (minutes: number) =>
        `The link is valid for ${minutes} minute${minutes === 1 ? '' : 's'} and can be used only once.`,
      consequence: 'After confirmation, all active sessions will be revoked and the next sign-in will require a new TOTP enrollment and new backup codes.',
      ignore: 'If you did not request recovery, do not open the link and contact your organization owner.',
    },
    zh: {
      subject: '透明价格 — 确认 MFA 恢复',
      intro: '您的组织管理员已发起 MFA 恢复。',
      action: '如需撤销旧 MFA，请通过以下一次性链接确认当前密码：',
      expiry: (minutes: number) => `链接有效期为 ${minutes} 分钟且只能使用一次。`,
      consequence: '确认后，所有活动会话将被撤销；下次登录时必须重新设置 TOTP 并保存新的备用代码。',
      ignore: '如果您未请求恢复，请勿打开链接，并联系组织负责人。',
    },
  } as const;
  const selected = copy[locale];
  return {
    to: input.to,
    subject: selected.subject,
    text: [
      selected.intro,
      input.organizationName ? `Organization: ${input.organizationName}` : '',
      '',
      selected.action,
      url.toString(),
      '',
      selected.expiry(input.expiresInMinutes),
      selected.consequence,
      selected.ignore,
    ].filter(Boolean).join('\n'),
  };
}

export function mfaRecoveryCompletedMail(input: {
  to: string;
  locale?: AuthMailLocale;
}): AuthMailEnvelope {
  const copy = {
    ru: {
      subject: 'Прозрачная Цена — MFA отозван',
      text: 'Прежний MFA отозван, все активные сессии завершены. При следующем входе потребуется настроить новый TOTP. Если это сделали не вы, немедленно свяжитесь с владельцем организации.',
    },
    en: {
      subject: 'Transparent Price — MFA revoked',
      text: 'The previous MFA was revoked and all active sessions were terminated. Your next sign-in will require a new TOTP enrollment. If this was not you, contact your organization owner immediately.',
    },
    zh: {
      subject: '透明价格 — MFA 已撤销',
      text: '旧 MFA 已撤销，所有活动会话均已终止。下次登录时必须重新设置 TOTP。如果并非本人操作，请立即联系组织负责人。',
    },
  } as const;
  const selected = copy[input.locale ?? 'ru'];
  return { to: input.to, subject: selected.subject, text: selected.text };
}

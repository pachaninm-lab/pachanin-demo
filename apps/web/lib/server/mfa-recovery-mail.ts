import { sendTransactionalMail } from './transactional-mail';

export type MfaRecoveryDelivery = {
  email: string;
  token: string;
  expiresInSeconds?: number;
};

type Locale = 'ru' | 'en' | 'zh';

/**
 * How long the link actually lasts is decided by the API - it mints the
 * credential and sends the lifetime down as expiresInSeconds. The mail used to
 * restate that number in three languages instead of reading it, so the copy
 * kept saying thirty minutes while ASVS 5.0 V6.5.5 caps an out-of-band request
 * at ten and the API was changed to match. Reading the delivered value is what
 * keeps the sentence from being wrong again the next time the bound moves.
 *
 * A delivery with no lifetime on it is a bug upstream, not a licence to guess:
 * the sentence falls back to the cap itself, which is the shortest claim that
 * cannot overstate how long the link is good for.
 */
const OOB_MAX_LIFETIME_MINUTES = 10;

function expiryMinutesFrom(expiresInSeconds: number | undefined): number {
  if (typeof expiresInSeconds !== 'number' || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    return OOB_MAX_LIFETIME_MINUTES;
  }
  const minutes = Math.floor(expiresInSeconds / 60);
  if (minutes < 1) return 1;
  return Math.min(minutes, OOB_MAX_LIFETIME_MINUTES);
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

const RECOVERY_COPY = {
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

const COMPLETED_COPY = {
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

function localeFrom(value: string): Locale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

export function mfaRecoveryMailConfigured() {
  return Boolean(
    (process.env.RESEND_API_KEY && (process.env.RESEND_FROM_EMAIL || process.env.PC_MAIL_FROM))
      || (process.env.PC_SMTP_HOST && process.env.PC_SMTP_USER && process.env.PC_SMTP_PASS),
  );
}

export async function deliverMfaRecovery(
  request: Request,
  delivery: MfaRecoveryDelivery,
  localeInput: string,
) {
  const locale = localeFrom(localeInput);
  const configuredOrigin = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  const url = new URL('/platform-v7/mfa-recovery', configuredOrigin || new URL(request.url).origin);
  url.searchParams.set('token', delivery.token);
  url.searchParams.set('lang', locale);
  const copy = RECOVERY_COPY[locale];
  const expiry = copy.expiry(expiryMinutesFrom(delivery.expiresInSeconds));
  return sendTransactionalMail({
    to: delivery.email,
    subject: copy.subject,
    text: [copy.intro, '', copy.action, url.toString(), '', expiry, copy.consequence, copy.ignore].join('\n'),
  });
}

export async function deliverMfaRecoveryCompleted(email: string, localeInput: string) {
  const copy = COMPLETED_COPY[localeFrom(localeInput)];
  return sendTransactionalMail({ to: email, subject: copy.subject, text: copy.text });
}

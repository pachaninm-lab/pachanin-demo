import type { PhoneState } from './phone';

/**
 * Provider-neutral граница подтверждения телефона.
 *
 * Пока действующего production-провайдера нет, режим остаётся `NONE`: телефон
 * обязателен при регистрации и хранится в состоянии `DECLARED`, а authority
 * аккаунта обеспечивают существующие email verification, пароль/сессия и MFA.
 *
 * Что здесь сознательно не делается: фиктивная отправка кода, статический код,
 * заглушка «код всегда 0000» и любой другой способ показать пользователю
 * «номер подтверждён» без фактического подтверждения владения.
 */

export type PhoneVerificationChannel = 'NONE' | 'SMS' | 'FLASH_CALL' | 'OTHER_VERIFIED_CHANNEL';

export type PhoneVerificationStatus =
  | 'UNSUPPORTED'
  | 'PENDING'
  | 'VERIFIED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FAILED';

export type PhoneVerificationRequest = Readonly<{
  accountId: string;
  e164: string;
  locale: 'ru' | 'en' | 'zh';
}>;

export type PhoneVerificationResult = Readonly<{
  status: PhoneVerificationStatus;
  channel: PhoneVerificationChannel;
  /** Идентификатор попытки у провайдера. Никогда не содержит номер. */
  verificationId: string | null;
  /** Когда можно повторить запрос. */
  retryAfterSeconds: number | null;
  /** Состояние, в которое следует перевести телефон аккаунта. */
  phoneState: PhoneState;
}>;

export type PhoneVerificationProvider = Readonly<{
  channel: PhoneVerificationChannel;
  requestVerification: (request: PhoneVerificationRequest) => Promise<PhoneVerificationResult>;
  verifyCode: (verificationId: string, code: string) => Promise<PhoneVerificationResult>;
  getStatus: (verificationId: string) => Promise<PhoneVerificationResult>;
  cancelVerification: (verificationId: string) => Promise<PhoneVerificationResult>;
  health: () => Promise<{ healthy: boolean; detail: string }>;
}>;

const UNSUPPORTED: PhoneVerificationResult = {
  status: 'UNSUPPORTED',
  channel: 'NONE',
  verificationId: null,
  retryAfterSeconds: null,
  phoneState: 'DECLARED',
};

/**
 * Провайдер по умолчанию. Он честно отвечает «канал недоступен» вместо того,
 * чтобы изображать отправку кода, и оставляет телефон в состоянии `DECLARED`.
 */
export const NO_PHONE_VERIFICATION_PROVIDER: PhoneVerificationProvider = {
  channel: 'NONE',
  requestVerification: async () => UNSUPPORTED,
  verifyCode: async () => UNSUPPORTED,
  getStatus: async () => UNSUPPORTED,
  cancelVerification: async () => UNSUPPORTED,
  health: async () => ({ healthy: true, detail: 'no verification channel configured' }),
};

const registry = new Map<PhoneVerificationChannel, PhoneVerificationProvider>();

/** Регистрация реального провайдера — единственный способ включить канал. */
export function registerPhoneVerificationProvider(provider: PhoneVerificationProvider): void {
  if (provider.channel === 'NONE') throw new Error('cannot register a provider for the NONE channel');
  registry.set(provider.channel, provider);
}

export function resolvePhoneVerificationChannel(env: NodeJS.ProcessEnv = process.env): PhoneVerificationChannel {
  const configured = env.GEKTA_PHONE_VERIFICATION_PROVIDER?.trim();
  if (configured === 'SMS' || configured === 'FLASH_CALL' || configured === 'OTHER_VERIFIED_CHANNEL') return configured;
  return 'NONE';
}

/**
 * Настроенный, но незарегистрированный канал не включается молча: продукт
 * возвращается к `NONE`, а не делает вид, что подтверждение работает.
 */
export function getPhoneVerificationProvider(env: NodeJS.ProcessEnv = process.env): PhoneVerificationProvider {
  const channel = resolvePhoneVerificationChannel(env);
  if (channel === 'NONE') return NO_PHONE_VERIFICATION_PROVIDER;
  return registry.get(channel) ?? NO_PHONE_VERIFICATION_PROVIDER;
}

export function phoneVerificationAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return getPhoneVerificationProvider(env).channel !== 'NONE';
}

/** Какое состояние телефона допустимо показывать пользователю. */
export function displayPhoneState(state: PhoneState, locale: 'ru' | 'en' | 'zh'): string {
  const copy = {
    ru: { DECLARED: 'Указан', VERIFIED: 'Подтверждён', CONFLICTED: 'Требует уточнения', REVOKED: 'Отозван' },
    en: { DECLARED: 'Provided', VERIFIED: 'Verified', CONFLICTED: 'Needs clarification', REVOKED: 'Revoked' },
    zh: { DECLARED: '已填写', VERIFIED: '已验证', CONFLICTED: '需要确认', REVOKED: '已撤销' },
  } as const;
  return copy[locale][state];
}

/**
 * Профиль продавца Гекты.
 *
 * Юридическая форма продавца — конфигурация, а не код. Продукт одинаково
 * работает, когда услугу оказывает физическое лицо на НПД, индивидуальный
 * предприниматель или юридическое лицо; переход между формами меняет профиль
 * и не требует миграции аккаунтов, подписок или entitlement.
 *
 * Ни один реквизит здесь не выдумывается. Пока профиль не заполнен
 * подтверждёнными данными, приём платежей выключен, а пользователю не
 * показывается ни один placeholder.
 */

export type MerchantOperatorType = 'NPD_INDIVIDUAL' | 'IP' | 'LEGAL_ENTITY';

export type MerchantTaxRegime = 'NPD' | 'USN' | 'OSNO' | 'OTHER';

/**
 * Для НПД чек формируется средствами «Мой налог» и не является кассовым чеком
 * по 54-ФЗ (ч. 2.2 ст. 2 54-ФЗ освобождает от ККТ). Для ИП и юрлица требуется
 * фискальный чек ККТ. См. docs/gekta/legal-source-audit-20260812.md.
 */
export type MerchantReceiptMode = 'NPD_RECEIPT' | 'KKT_RECEIPT' | 'NONE';

export type MerchantProfile = Readonly<{
  id: string;
  operatorType: MerchantOperatorType;
  /** Как продавец называется в документах и в подвале продукта. */
  legalDisplayName: string;
  /** ФИО для физлица и ИП. Для юрлица — имя подписанта, если применимо. */
  fullName: string | null;
  inn: string | null;
  ogrnip: string | null;
  ogrn: string | null;
  /** Адрес указывается только там, где закон этого требует. */
  legalAddress: string | null;
  contactAddress: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  taxRegime: MerchantTaxRegime;
  receiptMode: MerchantReceiptMode;
  paymentProvider: string | null;
  billingEnabled: boolean;
  /** Когда реквизиты были фактически подтверждены. */
  verifiedAt: string | null;
  /** Откуда взяты реквизиты: реестр, документ, конфигурация. */
  source: string | null;
  /** С какой даты действует эта версия профиля. */
  effectiveFrom: string;
}>;

/** Профиль-заглушка не выдумывает реквизиты: незаполненное остаётся null. */
export const UNCONFIGURED_MERCHANT: MerchantProfile = {
  id: 'unconfigured',
  operatorType: 'NPD_INDIVIDUAL',
  legalDisplayName: '',
  fullName: null,
  inn: null,
  ogrnip: null,
  ogrn: null,
  legalAddress: null,
  contactAddress: null,
  supportEmail: null,
  supportPhone: null,
  taxRegime: 'NPD',
  receiptMode: 'NPD_RECEIPT',
  paymentProvider: null,
  billingEnabled: false,
  verifiedAt: null,
  source: null,
  effectiveFrom: '1970-01-01T00:00:00.000Z',
};

function trimmed(value: string | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}

function operatorTypeFrom(value: string | undefined): MerchantOperatorType {
  return value === 'IP' || value === 'LEGAL_ENTITY' ? value : 'NPD_INDIVIDUAL';
}

function receiptModeFor(operatorType: MerchantOperatorType): MerchantReceiptMode {
  return operatorType === 'NPD_INDIVIDUAL' ? 'NPD_RECEIPT' : 'KKT_RECEIPT';
}

function taxRegimeFor(operatorType: MerchantOperatorType, configured: string | undefined): MerchantTaxRegime {
  if (configured === 'NPD' || configured === 'USN' || configured === 'OSNO' || configured === 'OTHER') return configured;
  return operatorType === 'NPD_INDIVIDUAL' ? 'NPD' : 'OTHER';
}

export function getMerchantProfile(env: NodeJS.ProcessEnv = process.env): MerchantProfile {
  const operatorType = operatorTypeFrom(env.GEKTA_MERCHANT_OPERATOR_TYPE);
  const legalDisplayName = trimmed(env.GEKTA_MERCHANT_LEGAL_NAME);
  if (!legalDisplayName) return UNCONFIGURED_MERCHANT;

  return {
    id: trimmed(env.GEKTA_MERCHANT_PROFILE_ID) ?? 'configured',
    operatorType,
    legalDisplayName,
    fullName: trimmed(env.GEKTA_MERCHANT_FULL_NAME),
    inn: trimmed(env.GEKTA_MERCHANT_INN),
    ogrnip: trimmed(env.GEKTA_MERCHANT_OGRNIP),
    ogrn: trimmed(env.GEKTA_MERCHANT_OGRN),
    legalAddress: trimmed(env.GEKTA_MERCHANT_LEGAL_ADDRESS),
    contactAddress: trimmed(env.GEKTA_MERCHANT_CONTACT_ADDRESS),
    supportEmail: trimmed(env.GEKTA_MERCHANT_SUPPORT_EMAIL),
    supportPhone: trimmed(env.GEKTA_MERCHANT_SUPPORT_PHONE),
    taxRegime: taxRegimeFor(operatorType, env.GEKTA_MERCHANT_TAX_REGIME),
    receiptMode: receiptModeFor(operatorType),
    paymentProvider: trimmed(env.GEKTA_PAYMENT_PROVIDER),
    billingEnabled: false,
    verifiedAt: trimmed(env.GEKTA_MERCHANT_VERIFIED_AT),
    source: trimmed(env.GEKTA_MERCHANT_SOURCE),
    effectiveFrom: trimmed(env.GEKTA_MERCHANT_EFFECTIVE_FROM) ?? UNCONFIGURED_MERCHANT.effectiveFrom,
  };
}

export type BillingReadinessCheck = Readonly<{ id: string; passed: boolean; requirement: string }>;

/**
 * Приём платежей включается только когда выполнены все условия сразу.
 * Список выведен из docs/gekta/legal-source-audit-20260812.md: без
 * подтверждённого продавца, договора с провайдером и работающей выдачи чека
 * live-платёж принимать нельзя.
 */
export function getBillingReadiness(profile: MerchantProfile, env: NodeJS.ProcessEnv = process.env): {
  ready: boolean;
  checks: readonly BillingReadinessCheck[];
} {
  const checks: BillingReadinessCheck[] = [
    {
      id: 'merchant_profile_complete',
      passed: Boolean(profile.legalDisplayName && profile.inn && profile.verifiedAt),
      requirement: 'Профиль продавца заполнен подтверждёнными реквизитами и датой подтверждения.',
    },
    {
      id: 'tax_status_verified',
      passed: profile.operatorType !== 'NPD_INDIVIDUAL' || env.GEKTA_NPD_STATUS_VERIFIED === 'true',
      requirement: 'Для НПД подтверждён фактический статус плательщика НПД и применимость режима.',
    },
    {
      id: 'payment_provider_configured',
      passed: Boolean(trimmed(env.GEKTA_PAYMENT_PROVIDER)) && env.GEKTA_PAYMENT_PROVIDER !== 'NONE',
      requirement: 'Заключён договор с платёжным провайдером и заданы merchant credentials.',
    },
    {
      id: 'receipt_channel_available',
      passed: profile.receiptMode === 'NONE'
        ? false
        : Boolean(trimmed(env.GEKTA_RECEIPT_PROVIDER)) && env.GEKTA_RECEIPT_PROVIDER !== 'NONE',
      requirement: 'Доступен канал выдачи чека: без него рекуррентный платёж принимать нельзя.',
    },
    {
      id: 'subscription_terms_published',
      passed: env.GEKTA_SUBSCRIPTION_TERMS_PUBLISHED === 'true',
      requirement: 'Опубликованы условия подписки, отмены, отказа от автопродления и возврата.',
    },
  ];

  return { ready: checks.every((check) => check.passed), checks };
}

/** Итоговое решение: включён ли приём платежей. Ни один флаг сам по себе не включает его. */
export function isBillingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GEKTA_BILLING_ENABLED !== 'true') return false;
  return getBillingReadiness(getMerchantProfile(env), env).ready;
}

/**
 * Лимит режима НПД. Значение — политика, а не константа продукта: продукт не
 * блокируется по захардкоженной сумме, но обязан предупреждать заранее.
 */
export function getNpdRevenuePolicy(env: NodeJS.ProcessEnv = process.env) {
  const limit = Number.parseInt(env.GEKTA_NPD_ANNUAL_LIMIT_RUB ?? '', 10);
  const warnAt = Number.parseInt(env.GEKTA_NPD_WARN_PERCENT ?? '', 10);
  return {
    annualLimitRub: Number.isFinite(limit) && limit > 0 ? limit : 2_400_000,
    warnAtPercent: Number.isFinite(warnAt) && warnAt > 0 && warnAt < 100 ? warnAt : 80,
  } as const;
}

export function npdRevenueStatus(revenueYtdRub: number, env: NodeJS.ProcessEnv = process.env): 'OK' | 'WARNING' | 'LIMIT_REACHED' {
  const { annualLimitRub, warnAtPercent } = getNpdRevenuePolicy(env);
  if (revenueYtdRub >= annualLimitRub) return 'LIMIT_REACHED';
  if (revenueYtdRub >= (annualLimitRub * warnAtPercent) / 100) return 'WARNING';
  return 'OK';
}

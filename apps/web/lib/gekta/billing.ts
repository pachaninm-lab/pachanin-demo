import { isBillingEnabled } from './merchant';

/**
 * Provider-neutral контур оплаты.
 *
 * Ни одного захардкоженного провайдера. Пока реальный провайдер не подключён и
 * профиль продавца не подтверждён, `isBillingEnabled()` возвращает false, и
 * продукт не показывает ни checkout, ни успешное списание.
 *
 * Требования 376-ФЗ (действует с 01.03.2026) заложены в модель: отзыв
 * платёжного средства обязателен, списание после отзыва запрещено, отмена
 * доступна так же, как подключение. См. docs/gekta/legal-source-audit-20260812.md.
 */

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type ReceiptState = 'NOT_REQUIRED' | 'PENDING' | 'ISSUED' | 'CANCELLED' | 'FAILED';

export type PaymentRecord = Readonly<{
  id: string;
  accountId: string;
  provider: string;
  providerPaymentId: string | null;
  amountKopecks: number;
  currency: 'RUB';
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  /** Один и тот же ключ никогда не создаёт второй платёж. */
  idempotencyKey: string;
  receiptState: ReceiptState;
  receiptId: string | null;
  receiptUrl: string | null;
  /** Снимок продавца на момент платежа: смена формы не переписывает историю. */
  merchantSnapshot: Readonly<{ id: string; operatorType: string; legalDisplayName: string; inn: string | null }>;
}>;

export type SubscriptionRecord = Readonly<{
  accountId: string;
  plan: string;
  status: 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  /** Разрешение на периодическое списание, данное осознанно и отдельно. */
  paymentMethodAuthorization: string | null;
  /** Отзыв разрешения. После него списание запрещено. */
  paymentMethodRevokedAt: string | null;
}>;

export type CheckoutRequest = Readonly<{
  accountId: string;
  amountKopecks: number;
  description: string;
  idempotencyKey: string;
  returnUrl: string;
  recurring: boolean;
}>;

export type CheckoutResult = Readonly<{
  accepted: boolean;
  paymentId: string | null;
  redirectUrl: string | null;
  reason: string | null;
}>;

export type WebhookVerification = Readonly<{ valid: boolean; reason: string | null }>;

export type PaymentProvider = Readonly<{
  id: string;
  createCheckout: (request: CheckoutRequest) => Promise<CheckoutResult>;
  getPayment: (paymentId: string) => Promise<PaymentRecord | null>;
  cancelPayment: (paymentId: string) => Promise<PaymentRecord | null>;
  refundPayment: (paymentId: string, amountKopecks: number, idempotencyKey: string) => Promise<PaymentRecord | null>;
  createRecurringAuthorization: (accountId: string, paymentId: string) => Promise<string | null>;
  chargeRecurring: (accountId: string, authorization: string, amountKopecks: number, idempotencyKey: string) => Promise<PaymentRecord | null>;
  revokePaymentMethod: (accountId: string, authorization: string) => Promise<boolean>;
  cancelSubscription: (accountId: string, atPeriodEnd: boolean) => Promise<SubscriptionRecord | null>;
  verifyWebhook: (rawBody: string, headers: Readonly<Record<string, string>>) => WebhookVerification;
  handleWebhook: (event: unknown) => Promise<{ handled: boolean; reason: string | null }>;
}>;

export type ReceiptRequest = Readonly<{
  paymentId: string;
  amountKopecks: number;
  description: string;
  idempotencyKey: string;
}>;

export type ReceiptResult = Readonly<{
  state: ReceiptState;
  receiptId: string | null;
  receiptUrl: string | null;
  reason: string | null;
}>;

/**
 * Чек вынесен отдельно от платежа: для НПД он формируется не кассой, а
 * средствами «Мой налог» (ч. 2.2 ст. 2 54-ФЗ освобождает НПД от ККТ), поэтому
 * канал чека и канал денег — разные интеграции с разной судьбой.
 */
export type NpdReceiptProvider = Readonly<{
  id: string;
  createReceipt: (request: ReceiptRequest) => Promise<ReceiptResult>;
  getReceipt: (receiptId: string) => Promise<ReceiptResult>;
  cancelReceipt: (receiptId: string, reason: string) => Promise<ReceiptResult>;
  health: () => Promise<{ healthy: boolean; detail: string }>;
}>;

const DISABLED_REASON = 'billing_disabled';

export const DISABLED_PAYMENT_PROVIDER: PaymentProvider = {
  id: 'NONE',
  createCheckout: async () => ({ accepted: false, paymentId: null, redirectUrl: null, reason: DISABLED_REASON }),
  getPayment: async () => null,
  cancelPayment: async () => null,
  refundPayment: async () => null,
  createRecurringAuthorization: async () => null,
  chargeRecurring: async () => null,
  revokePaymentMethod: async () => false,
  cancelSubscription: async () => null,
  verifyWebhook: () => ({ valid: false, reason: DISABLED_REASON }),
  handleWebhook: async () => ({ handled: false, reason: DISABLED_REASON }),
};

export const DISABLED_RECEIPT_PROVIDER: NpdReceiptProvider = {
  id: 'NONE',
  createReceipt: async () => ({ state: 'FAILED', receiptId: null, receiptUrl: null, reason: DISABLED_REASON }),
  getReceipt: async () => ({ state: 'FAILED', receiptId: null, receiptUrl: null, reason: DISABLED_REASON }),
  cancelReceipt: async () => ({ state: 'FAILED', receiptId: null, receiptUrl: null, reason: DISABLED_REASON }),
  health: async () => ({ healthy: true, detail: 'no receipt channel configured' }),
};

const paymentProviders = new Map<string, PaymentProvider>();
const receiptProviders = new Map<string, NpdReceiptProvider>();

export function registerPaymentProvider(provider: PaymentProvider): void {
  if (provider.id === 'NONE') throw new Error('cannot register a provider under the NONE id');
  paymentProviders.set(provider.id, provider);
}

export function registerReceiptProvider(provider: NpdReceiptProvider): void {
  if (provider.id === 'NONE') throw new Error('cannot register a provider under the NONE id');
  receiptProviders.set(provider.id, provider);
}

export function getPaymentProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  if (!isBillingEnabled(env)) return DISABLED_PAYMENT_PROVIDER;
  const id = env.GEKTA_PAYMENT_PROVIDER?.trim();
  return (id && paymentProviders.get(id)) || DISABLED_PAYMENT_PROVIDER;
}

export function getReceiptProvider(env: NodeJS.ProcessEnv = process.env): NpdReceiptProvider {
  if (!isBillingEnabled(env)) return DISABLED_RECEIPT_PROVIDER;
  const id = env.GEKTA_RECEIPT_PROVIDER?.trim();
  return (id && receiptProviders.get(id)) || DISABLED_RECEIPT_PROVIDER;
}

/**
 * Списание по подписке. Отозванное платёжное средство — жёсткий стоп: это
 * прямое требование 376-ФЗ, а не продуктовое предпочтение.
 */
export function canChargeRecurring(subscription: SubscriptionRecord, now: Date): { allowed: boolean; reason: string | null } {
  if (subscription.paymentMethodRevokedAt) return { allowed: false, reason: 'payment_method_revoked' };
  if (!subscription.paymentMethodAuthorization) return { allowed: false, reason: 'no_authorization' };
  if (subscription.status === 'CANCELLED') return { allowed: false, reason: 'subscription_cancelled' };
  if (subscription.cancelAtPeriodEnd) {
    const end = subscription.currentPeriodEnd ? Date.parse(subscription.currentPeriodEnd) : null;
    if (end !== null && Number.isFinite(end) && now.getTime() >= end) {
      return { allowed: false, reason: 'cancelled_at_period_end' };
    }
  }
  return { allowed: true, reason: null };
}

/** Повторный webhook с тем же идентификатором события не применяется дважды. */
export function isReplayedWebhook(seenEventIds: ReadonlySet<string>, eventId: string): boolean {
  return seenEventIds.has(eventId);
}

import { describe, expect, it } from 'vitest';
import { getBillingReadiness, getMerchantProfile, isBillingEnabled, npdRevenueStatus, UNCONFIGURED_MERCHANT } from '@/lib/gekta/merchant';
import { canChargeRecurring, DISABLED_PAYMENT_PROVIDER, getPaymentProvider, getReceiptProvider, isReplayedWebhook, type SubscriptionRecord } from '@/lib/gekta/billing';
import { maskPhone, normalizePhone, phoneLookupHash, encryptPhone, decryptPhone, resolvePhoneClaim, publicPhoneAvailabilityResponse } from '@/lib/gekta/phone';
import { getPhoneVerificationProvider, phoneVerificationAvailable, resolvePhoneVerificationChannel } from '@/lib/gekta/phone-verification';
import { resolveAccountEntitlement, startTrial, trialDaysRemaining, getGektaAccessPolicy, type GektaAccountAccess } from '@/lib/gekta/entitlement';
import { canReadConversationContent, createSupportAccessGrant, hasPermission, resolveGrantTarget, buildAuditEntry } from '@/lib/gekta/operator-rbac';
import { merchantDisclosureSection, renderLegalDocument, getGektaLegalDocument } from '@/lib/gekta/legal';

const NOW = new Date('2026-08-12T12:00:00.000Z');

const BASE_ACCESS: GektaAccountAccess = {
  accountId: 'acc-1',
  trialStartedAt: null,
  trialEndsAt: null,
  subscriptionStatus: 'NONE',
  currentPeriodEnd: null,
  manualAccessUntil: null,
  lifetimeAccess: false,
  suspended: false,
};

describe('профиль продавца', () => {
  it('без подтверждённых реквизитов не выдумывает ни одного значения', () => {
    const profile = getMerchantProfile({});
    expect(profile).toEqual(UNCONFIGURED_MERCHANT);
    expect(profile.inn).toBeNull();
    expect(profile.legalDisplayName).toBe('');
    expect(profile.billingEnabled).toBe(false);
  });

  it('поддерживает три формы продавца и подбирает режим чека под форму', () => {
    const npd = getMerchantProfile({ GEKTA_MERCHANT_LEGAL_NAME: 'Иванов И. И.', GEKTA_MERCHANT_OPERATOR_TYPE: 'NPD_INDIVIDUAL' });
    expect(npd.operatorType).toBe('NPD_INDIVIDUAL');
    expect(npd.receiptMode).toBe('NPD_RECEIPT');
    expect(npd.taxRegime).toBe('NPD');

    const ip = getMerchantProfile({ GEKTA_MERCHANT_LEGAL_NAME: 'ИП Иванов', GEKTA_MERCHANT_OPERATOR_TYPE: 'IP' });
    expect(ip.receiptMode).toBe('KKT_RECEIPT');

    const entity = getMerchantProfile({ GEKTA_MERCHANT_LEGAL_NAME: 'ООО «Пример»', GEKTA_MERCHANT_OPERATOR_TYPE: 'LEGAL_ENTITY' });
    expect(entity.receiptMode).toBe('KKT_RECEIPT');
  });

  it('не включает платежи, пока не выполнено каждое условие готовности', () => {
    const env = {
      GEKTA_BILLING_ENABLED: 'true',
      GEKTA_MERCHANT_LEGAL_NAME: 'Иванов И. И.',
      GEKTA_MERCHANT_INN: '000000000000',
      GEKTA_MERCHANT_VERIFIED_AT: '2026-08-01T00:00:00.000Z',
    };
    expect(isBillingEnabled(env)).toBe(false);
    const readiness = getBillingReadiness(getMerchantProfile(env), env);
    expect(readiness.ready).toBe(false);
    const failing = readiness.checks.filter((check) => !check.passed).map((check) => check.id);
    expect(failing).toContain('tax_status_verified');
    expect(failing).toContain('payment_provider_configured');
    expect(failing).toContain('receipt_channel_available');
    expect(failing).toContain('subscription_terms_published');
  });

  it('включает платежи только когда выполнены все условия сразу', () => {
    const env = {
      GEKTA_BILLING_ENABLED: 'true',
      GEKTA_MERCHANT_LEGAL_NAME: 'Иванов И. И.',
      GEKTA_MERCHANT_INN: '000000000000',
      GEKTA_MERCHANT_VERIFIED_AT: '2026-08-01T00:00:00.000Z',
      GEKTA_NPD_STATUS_VERIFIED: 'true',
      GEKTA_PAYMENT_PROVIDER: 'some-provider',
      GEKTA_RECEIPT_PROVIDER: 'some-receipt',
      GEKTA_SUBSCRIPTION_TERMS_PUBLISHED: 'true',
    };
    expect(getBillingReadiness(getMerchantProfile(env), env).ready).toBe(true);
    expect(isBillingEnabled(env)).toBe(true);
    // Даже при готовности незарегистрированный провайдер не изображает оплату.
    expect(getPaymentProvider(env).id).toBe('NONE');
  });

  it('следит за лимитом режима НПД как за политикой, а не константой', () => {
    expect(npdRevenueStatus(100_000)).toBe('OK');
    expect(npdRevenueStatus(2_000_000)).toBe('WARNING');
    expect(npdRevenueStatus(2_400_000)).toBe('LIMIT_REACHED');
    expect(npdRevenueStatus(500, { GEKTA_NPD_ANNUAL_LIMIT_RUB: '1000', GEKTA_NPD_WARN_PERCENT: '50' })).toBe('WARNING');
  });
});

describe('биллинг', () => {
  it('при выключенных платежах не создаёт checkout и не подтверждает webhook', async () => {
    const provider = getPaymentProvider({});
    expect(provider.id).toBe('NONE');
    const checkout = await provider.createCheckout({
      accountId: 'acc-1', amountKopecks: 29_900, description: 'Гекта', idempotencyKey: 'k1', returnUrl: '/gekta', recurring: true,
    });
    expect(checkout.accepted).toBe(false);
    expect(checkout.redirectUrl).toBeNull();
    expect(provider.verifyWebhook('{}', {}).valid).toBe(false);
    expect((await getReceiptProvider({}).createReceipt({ paymentId: 'p1', amountKopecks: 29_900, description: 'Гекта', idempotencyKey: 'k1' })).state).toBe('FAILED');
    expect(DISABLED_PAYMENT_PROVIDER.id).toBe('NONE');
  });

  it('запрещает списание после отзыва платёжного средства', () => {
    const subscription: SubscriptionRecord = {
      accountId: 'acc-1', plan: 'monthly', status: 'ACTIVE',
      startedAt: '2026-07-01T00:00:00.000Z', currentPeriodStart: '2026-08-01T00:00:00.000Z',
      currentPeriodEnd: '2026-09-01T00:00:00.000Z', cancelAtPeriodEnd: false, cancelledAt: null,
      paymentMethodAuthorization: 'auth-1', paymentMethodRevokedAt: null,
    };
    expect(canChargeRecurring(subscription, NOW).allowed).toBe(true);
    expect(canChargeRecurring({ ...subscription, paymentMethodRevokedAt: '2026-08-10T00:00:00.000Z' }, NOW)).toEqual({ allowed: false, reason: 'payment_method_revoked' });
    expect(canChargeRecurring({ ...subscription, paymentMethodAuthorization: null }, NOW).allowed).toBe(false);
    expect(canChargeRecurring({ ...subscription, status: 'CANCELLED' }, NOW).allowed).toBe(false);
    const ended = { ...subscription, cancelAtPeriodEnd: true, currentPeriodEnd: '2026-08-01T00:00:00.000Z' };
    expect(canChargeRecurring(ended, NOW)).toEqual({ allowed: false, reason: 'cancelled_at_period_end' });
  });

  it('не применяет повторно уже обработанное событие', () => {
    expect(isReplayedWebhook(new Set(['e1']), 'e1')).toBe(true);
    expect(isReplayedWebhook(new Set(['e1']), 'e2')).toBe(false);
  });
});

describe('телефон', () => {
  const env = {
    GEKTA_PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    GEKTA_PHONE_LOOKUP_PEPPER: 'pepper-value-for-tests',
  };

  it('приводит российские записи одного номера к одному каноническому виду', () => {
    const canonical = '+79162778989';
    for (const input of ['+7 916 277-89-89', '8 (916) 277-89-89', '79162778989', '9162778989']) {
      expect(normalizePhone(input)?.e164).toBe(canonical);
    }
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
  });

  it('шифрует номер и ищет по отдельному индексу, а не по открытому значению', () => {
    const stored = encryptPhone('+79162778989', env);
    expect(stored.startsWith('v1.')).toBe(true);
    expect(stored).not.toContain('79162778989');
    expect(decryptPhone(stored, env)).toBe('+79162778989');
    // Шифрование недетерминировано: два хранения одного номера различны.
    expect(encryptPhone('+79162778989', env)).not.toBe(stored);
    // Индекс поиска, наоборот, детерминирован и не содержит номера.
    const hash = phoneLookupHash('+79162778989', env);
    expect(hash).toBe(phoneLookupHash('+79162778989', env));
    expect(hash).not.toContain('79162778989');
    expect(phoneLookupHash('+79162778988', env)).not.toBe(hash);
    // Без перца поиск невозможен: несолёного индекса не существует.
    expect(phoneLookupHash('+79162778989', {})).toBeNull();
  });

  it('не позволяет заблокировать чужой номер и не раскрывает регистрацию', () => {
    expect(resolvePhoneClaim([], 'acc-1')).toEqual({ state: 'DECLARED', conflicts: [] });
    const declaredElsewhere = resolvePhoneClaim([{ accountId: 'acc-2', state: 'DECLARED' }], 'acc-1');
    expect(declaredElsewhere.state).toBe('CONFLICTED');
    expect(declaredElsewhere.conflicts).toEqual(['acc-2']);
    // Публичный ответ одинаков независимо от того, занят номер или нет.
    expect(publicPhoneAvailabilityResponse()).toEqual({ status: 'accepted' });
    expect(maskPhone('+79162778989')).not.toContain('916277');
  });

  it('без провайдера оставляет номер заявленным и не называет его подтверждённым', async () => {
    expect(resolvePhoneVerificationChannel({})).toBe('NONE');
    expect(phoneVerificationAvailable({})).toBe(false);
    const provider = getPhoneVerificationProvider({});
    const result = await provider.requestVerification({ accountId: 'acc-1', e164: '+79162778989', locale: 'ru' });
    expect(result.status).toBe('UNSUPPORTED');
    expect(result.phoneState).toBe('DECLARED');
    // Настроенный, но незарегистрированный канал не включается молча.
    expect(getPhoneVerificationProvider({ GEKTA_PHONE_VERIFICATION_PROVIDER: 'SMS' }).channel).toBe('NONE');
  });
});

describe('доступ аккаунта', () => {
  it('выдаёт тридцатидневный пробный доступ по серверным часам', () => {
    expect(getGektaAccessPolicy().trialDays).toBe(30);
    const trial = startTrial(NOW);
    expect(trial.trialEndsAt).toBe('2026-09-11T12:00:00.000Z');
    expect(trialDaysRemaining(trial.trialEndsAt, NOW)).toBe(30);
    expect(trialDaysRemaining(trial.trialEndsAt, new Date('2026-09-20T00:00:00.000Z'))).toBe(0);
  });

  it('разбирает состояния в порядке приоритета, а не по первому совпадению', () => {
    const trial = startTrial(NOW);
    const active = { ...BASE_ACCESS, ...trial };
    expect(resolveAccountEntitlement(active, NOW).state).toBe('TRIAL_ACTIVE');
    expect(resolveAccountEntitlement(active, NOW).canAsk).toBe(true);

    const expired = { ...active, trialEndsAt: '2026-08-01T00:00:00.000Z' };
    expect(resolveAccountEntitlement(expired, NOW).state).toBe('TRIAL_EXPIRED');
    expect(resolveAccountEntitlement(expired, NOW).canAsk).toBe(false);

    // Оплата перекрывает истёкший пробный период.
    expect(resolveAccountEntitlement({ ...expired, subscriptionStatus: 'ACTIVE', currentPeriodEnd: '2026-09-01T00:00:00.000Z' }, NOW).state).toBe('PAID_ACTIVE');
    expect(resolveAccountEntitlement({ ...expired, subscriptionStatus: 'PAST_DUE' }, NOW).canAsk).toBe(false);
    expect(resolveAccountEntitlement({ ...expired, subscriptionStatus: 'CANCELLED' }, NOW).state).toBe('CANCELLED');

    // Ручной и бессрочный доступ сильнее подписки, блокировка сильнее всего.
    expect(resolveAccountEntitlement({ ...expired, manualAccessUntil: '2026-08-20T00:00:00.000Z' }, NOW).state).toBe('MANUAL_ACCESS');
    expect(resolveAccountEntitlement({ ...expired, manualAccessUntil: '2026-08-01T00:00:00.000Z' }, NOW).state).toBe('TRIAL_EXPIRED');
    expect(resolveAccountEntitlement({ ...expired, lifetimeAccess: true }, NOW).state).toBe('LIFETIME_ACCESS');
    expect(resolveAccountEntitlement({ ...expired, lifetimeAccess: true, suspended: true }, NOW).state).toBe('SUSPENDED');
    expect(resolveAccountEntitlement({ ...expired, lifetimeAccess: true, suspended: true }, NOW).canAsk).toBe(false);
  });

  it('никогда не берёт срок доступа из часов браузера', () => {
    const snapshot = resolveAccountEntitlement({ ...BASE_ACCESS, ...startTrial(NOW) }, NOW);
    expect(snapshot.serverTime).toBe(NOW.toISOString());
  });
});

describe('права кабинета оператора', () => {
  it('не даёт поддержке полномочий владельца', () => {
    expect(hasPermission(['GEKTA_SUPPORT'], 'account.search')).toBe(true);
    expect(hasPermission(['GEKTA_SUPPORT'], 'entitlement.grant_manual')).toBe(false);
    expect(hasPermission(['GEKTA_SUPPORT'], 'entitlement.grant_lifetime')).toBe(false);
    expect(hasPermission(['GEKTA_ADMIN'], 'entitlement.grant_manual')).toBe(true);
    expect(hasPermission(['GEKTA_ADMIN'], 'entitlement.grant_lifetime')).toBe(false);
    expect(hasPermission(['GEKTA_OWNER'], 'entitlement.grant_lifetime')).toBe(true);
    expect(hasPermission(['GEKTA_OWNER'], 'metrics.read_global')).toBe(true);
  });

  it('читает содержание диалога только по действующему согласию пользователя', () => {
    const grant = createSupportAccessGrant('acc-1', 'op-1', 'обращение в поддержку', NOW);
    expect(canReadConversationContent(['GEKTA_OWNER'], grant, 'acc-1', NOW).allowed).toBe(true);
    // Даже владелец без гранта не читает переписку.
    expect(canReadConversationContent(['GEKTA_OWNER'], null, 'acc-1', NOW)).toEqual({ allowed: false, reason: 'no_support_grant' });
    expect(canReadConversationContent(['GEKTA_OWNER'], grant, 'acc-2', NOW).reason).toBe('grant_account_mismatch');
    const later = new Date(NOW.getTime() + 25 * 60 * 60 * 1000);
    expect(canReadConversationContent(['GEKTA_OWNER'], grant, 'acc-1', later).reason).toBe('grant_expired');
    expect(canReadConversationContent(['GEKTA_SUPPORT'], grant, 'acc-1', NOW).reason).toBe('permission_denied');
  });

  it('не угадывает аккаунт, когда телефон нашёл несколько', () => {
    expect(resolveGrantTarget([]).status).toBe('not_found');
    expect(resolveGrantTarget([{ accountId: 'acc-1' }])).toEqual({ status: 'single', accountId: 'acc-1', candidates: [] });
    const ambiguous = resolveGrantTarget([{ accountId: 'acc-1' }, { accountId: 'acc-2' }]);
    expect(ambiguous.status).toBe('ambiguous');
    expect(ambiguous.accountId).toBeNull();
    expect(ambiguous.candidates).toEqual(['acc-1', 'acc-2']);
  });

  it('записывает изменение доступа целиком и только с маскированным телефоном', () => {
    const entry = buildAuditEntry({
      correlationId: 'corr-1',
      actorOperatorId: 'op-1',
      actorRoles: ['GEKTA_OWNER'],
      targetAccountId: 'acc-1',
      phoneLocatorMasked: maskPhone('+79162778989'),
      action: 'entitlement.grant_manual',
      previousState: 'TRIAL_EXPIRED',
      newState: 'MANUAL_ACCESS',
      reason: 'договорённость с хозяйством',
      expiresAt: '2026-09-11T12:00:00.000Z',
      source: 'operator_console',
    }, NOW);
    expect(entry.timestamp).toBe(NOW.toISOString());
    expect(entry.phoneLocatorMasked).not.toContain('916277');
    expect(entry.previousState).toBe('TRIAL_EXPIRED');
    expect(entry.newState).toBe('MANUAL_ACCESS');
  });
});

describe('юридические документы', () => {
  it('не показывают выдуманного исполнителя, пока профиль не заполнен', () => {
    const section = merchantDisclosureSection(UNCONFIGURED_MERCHANT);
    expect(section.paragraphs.join(' ')).toContain('публикуются в этом разделе до начала приёма платежей');
    expect(section.paragraphs.join(' ')).not.toContain('ИНН:');
    expect(section.paragraphs.join(' ')).not.toContain('ООО');
  });

  it('называют форму продавца ровно так, как она задана в профиле', () => {
    const npd = merchantDisclosureSection(getMerchantProfile({
      GEKTA_MERCHANT_LEGAL_NAME: 'Иванов Иван Иванович',
      GEKTA_MERCHANT_OPERATOR_TYPE: 'NPD_INDIVIDUAL',
      GEKTA_MERCHANT_INN: '123456789012',
    }));
    const text = npd.paragraphs.join(' ');
    expect(text).toContain('Налог на профессиональный доход');
    expect(text).toContain('ИНН: 123456789012.');
    expect(text).not.toContain('Юридическое лицо');
    expect(text).toContain('чек в порядке, установленном для налога на профессиональный доход');
  });

  it('добавляют блок исполнителя только в договорные документы', () => {
    const profile = getMerchantProfile({ GEKTA_MERCHANT_LEGAL_NAME: 'Иванов И. И.' });
    const agreement = renderLegalDocument(getGektaLegalDocument('polzovatelskoe-soglashenie')!, profile);
    expect(agreement.sections.at(-1)?.heading).toBe('Исполнитель');
    const privacy = renderLegalDocument(getGektaLegalDocument('politika-konfidencialnosti')!, profile);
    expect(privacy.sections.at(-1)?.heading).not.toBe('Исполнитель');
  });
});

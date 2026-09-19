-- Gekta: аккаунт, доступ, история и монетизация.
--
-- Гекта не создаёт вторую систему аутентификации: аккаунт Гекты — состояние
-- поверх существующего users. Email verification, пароль/сессия и MFA остаются
-- authority аккаунта.
--
-- Миграция forward-only и rollback-safe: она только добавляет типы, таблицы и
-- индексы и не изменяет ни одной существующей колонки.

CREATE TYPE "GektaPhoneState" AS ENUM ('DECLARED', 'VERIFIED', 'CONFLICTED', 'REVOKED');
CREATE TYPE "GektaGrantKind" AS ENUM ('MANUAL', 'LIFETIME', 'TRIAL_EXTENSION');
CREATE TYPE "GektaSubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'PAST_DUE', 'CANCELLED');
CREATE TYPE "GektaPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "GektaReceiptState" AS ENUM ('NOT_REQUIRED', 'PENDING', 'ISSUED', 'CANCELLED', 'FAILED');
CREATE TYPE "GektaConsentPurpose" AS ENUM ('SERVICE_TERMS', 'PERSONAL_DATA', 'MARKETING', 'SUPPORT_ACCESS', 'SUBSCRIPTION_TERMS', 'AUTO_RENEWAL');

CREATE TABLE "gekta_accounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "trialStartedAt" TIMESTAMPTZ(6),
  "trialEndsAt" TIMESTAMPTZ(6),
  "trialGranted" BOOLEAN NOT NULL DEFAULT false,
  "lifetimeAccess" BOOLEAN NOT NULL DEFAULT false,
  "suspended" BOOLEAN NOT NULL DEFAULT false,
  "suspendedAt" TIMESTAMPTZ(6),
  "suspendReason" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "gekta_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gekta_accounts_user_key" ON "gekta_accounts"("userId");
CREATE INDEX "gekta_accounts_trial_ends_idx" ON "gekta_accounts"("trialEndsAt");
CREATE INDEX "gekta_accounts_created_idx" ON "gekta_accounts"("createdAt");

ALTER TABLE "gekta_accounts"
  ADD CONSTRAINT "gekta_accounts_user_fk" FOREIGN KEY ("userId")
  REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "gekta_phone_identities" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "encryptedPhone" VARCHAR(512) NOT NULL,
  "lookupHash" VARCHAR(64) NOT NULL,
  "state" "GektaPhoneState" NOT NULL DEFAULT 'DECLARED',
  "declaredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),
  "verifiedVia" VARCHAR(64),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "gekta_phone_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gekta_phone_identities_account_key" ON "gekta_phone_identities"("accountId");
CREATE INDEX "gekta_phone_identities_lookup_idx" ON "gekta_phone_identities"("lookupHash");
CREATE INDEX "gekta_phone_identities_state_idx" ON "gekta_phone_identities"("state");

-- Уникален только подтверждённый номер. Неподтверждённый намеренно не уникален:
-- иначе первый заявивший навсегда блокировал бы чужой номер, не доказав владение.
CREATE UNIQUE INDEX "gekta_phone_identities_verified_key"
  ON "gekta_phone_identities"("lookupHash")
  WHERE "state" = 'VERIFIED';

ALTER TABLE "gekta_phone_identities"
  ADD CONSTRAINT "gekta_phone_identities_account_fk" FOREIGN KEY ("accountId")
  REFERENCES "gekta_accounts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "gekta_usage" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "completedAnswers" BIGINT NOT NULL DEFAULT 0,
  "answersToday" INTEGER NOT NULL DEFAULT 0,
  "todayResetAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAnswerAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "gekta_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gekta_usage_account_key" ON "gekta_usage"("accountId");

ALTER TABLE "gekta_usage"
  ADD CONSTRAINT "gekta_usage_account_fk" FOREIGN KEY ("accountId")
  REFERENCES "gekta_accounts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "gekta_entitlement_grants" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "kind" "GektaGrantKind" NOT NULL,
  "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),
  "grantedBy" VARCHAR(64) NOT NULL,
  "revokedBy" VARCHAR(64),
  "reason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gekta_entitlement_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gekta_entitlement_grants_active_idx"
  ON "gekta_entitlement_grants"("accountId", "revokedAt", "expiresAt");

ALTER TABLE "gekta_entitlement_grants"
  ADD CONSTRAINT "gekta_entitlement_grants_account_fk" FOREIGN KEY ("accountId")
  REFERENCES "gekta_accounts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "gekta_projects" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "name" VARCHAR(60) NOT NULL,
  "description" VARCHAR(240) NOT NULL DEFAULT '',
  "locale" VARCHAR(8) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "deletedAt" TIMESTAMPTZ(6),
  CONSTRAINT "gekta_projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gekta_projects_account_idx"
  ON "gekta_projects"("accountId", "deletedAt", "updatedAt" DESC);

ALTER TABLE "gekta_projects"
  ADD CONSTRAINT "gekta_projects_account_fk" FOREIGN KEY ("accountId")
  REFERENCES "gekta_accounts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "gekta_conversations" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "projectId" TEXT,
  "title" VARCHAR(80) NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "importedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "deletedAt" TIMESTAMPTZ(6),
  CONSTRAINT "gekta_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gekta_conversations_account_idx"
  ON "gekta_conversations"("accountId", "deletedAt", "updatedAt" DESC);
CREATE INDEX "gekta_conversations_project_idx" ON "gekta_conversations"("projectId");

ALTER TABLE "gekta_conversations"
  ADD CONSTRAINT "gekta_conversations_account_fk" FOREIGN KEY ("accountId")
  REFERENCES "gekta_accounts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- Удаление проекта не удаляет диалоги: они возвращаются в общую историю.
ALTER TABLE "gekta_conversations"
  ADD CONSTRAINT "gekta_conversations_project_fk" FOREIGN KEY ("projectId")
  REFERENCES "gekta_projects"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

CREATE TABLE "gekta_messages" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" VARCHAR(16) NOT NULL,
  "body" TEXT NOT NULL,
  "citations" JSONB,
  "attachments" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gekta_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gekta_messages_conversation_idx" ON "gekta_messages"("conversationId", "createdAt");

ALTER TABLE "gekta_messages"
  ADD CONSTRAINT "gekta_messages_conversation_fk" FOREIGN KEY ("conversationId")
  REFERENCES "gekta_conversations"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "gekta_consents" (
  "id" TEXT NOT NULL,
  "accountId" TEXT,
  "anonymousSid" VARCHAR(64),
  "purpose" "GektaConsentPurpose" NOT NULL,
  "documentSlug" VARCHAR(128) NOT NULL,
  "documentVersion" VARCHAR(32) NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "acceptedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMPTZ(6),
  "sourceSurface" VARCHAR(64) NOT NULL,
  CONSTRAINT "gekta_consents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gekta_consents_account_idx"
  ON "gekta_consents"("accountId", "purpose", "acceptedAt" DESC);
CREATE INDEX "gekta_consents_anonymous_idx" ON "gekta_consents"("anonymousSid");

ALTER TABLE "gekta_consents"
  ADD CONSTRAINT "gekta_consents_account_fk" FOREIGN KEY ("accountId")
  REFERENCES "gekta_accounts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "gekta_support_grants" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),
  "reason" VARCHAR(500) NOT NULL,
  CONSTRAINT "gekta_support_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gekta_support_grants_account_idx"
  ON "gekta_support_grants"("accountId", "expiresAt" DESC);

ALTER TABLE "gekta_support_grants"
  ADD CONSTRAINT "gekta_support_grants_account_fk" FOREIGN KEY ("accountId")
  REFERENCES "gekta_accounts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "gekta_operator_audits" (
  "id" TEXT NOT NULL,
  "correlationId" VARCHAR(64) NOT NULL,
  "actorUserId" VARCHAR(64) NOT NULL,
  "actorRoles" VARCHAR(200) NOT NULL,
  "accountId" TEXT,
  "phoneLocatorMasked" VARCHAR(32),
  "action" VARCHAR(64) NOT NULL,
  "previousState" VARCHAR(64) NOT NULL,
  "newState" VARCHAR(64) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "expiresAt" TIMESTAMPTZ(6),
  "source" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gekta_operator_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gekta_operator_audits_account_idx"
  ON "gekta_operator_audits"("accountId", "createdAt" DESC);
CREATE INDEX "gekta_operator_audits_actor_idx"
  ON "gekta_operator_audits"("actorUserId", "createdAt" DESC);
CREATE INDEX "gekta_operator_audits_correlation_idx"
  ON "gekta_operator_audits"("correlationId");

-- Журнал переживает удаление аккаунта: запись о выданном доступе не исчезает.
ALTER TABLE "gekta_operator_audits"
  ADD CONSTRAINT "gekta_operator_audits_account_fk" FOREIGN KEY ("accountId")
  REFERENCES "gekta_accounts"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

CREATE TABLE "gekta_subscriptions" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "plan" VARCHAR(32) NOT NULL DEFAULT 'monthly',
  "status" "GektaSubscriptionStatus" NOT NULL DEFAULT 'NONE',
  "startedAt" TIMESTAMPTZ(6),
  "currentPeriodStart" TIMESTAMPTZ(6),
  "currentPeriodEnd" TIMESTAMPTZ(6),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "cancelledAt" TIMESTAMPTZ(6),
  "paymentMethodAuthorization" VARCHAR(255),
  "paymentMethodRevokedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "gekta_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gekta_subscriptions_account_key" ON "gekta_subscriptions"("accountId");
CREATE INDEX "gekta_subscriptions_status_idx" ON "gekta_subscriptions"("status", "currentPeriodEnd");

ALTER TABLE "gekta_subscriptions"
  ADD CONSTRAINT "gekta_subscriptions_account_fk" FOREIGN KEY ("accountId")
  REFERENCES "gekta_accounts"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

CREATE TABLE "gekta_payments" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "providerPaymentId" VARCHAR(128),
  "amountKopecks" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
  "status" "GektaPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "receiptState" "GektaReceiptState" NOT NULL DEFAULT 'NOT_REQUIRED',
  "receiptId" VARCHAR(128),
  "receiptUrl" VARCHAR(512),
  "merchantSnapshot" JSONB NOT NULL,
  "paidAt" TIMESTAMPTZ(6),
  "refundedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "gekta_payments_pkey" PRIMARY KEY ("id")
);

-- Один и тот же ключ никогда не создаёт второй платёж.
CREATE UNIQUE INDEX "gekta_payments_idempotency_key" ON "gekta_payments"("idempotencyKey");
CREATE INDEX "gekta_payments_account_idx" ON "gekta_payments"("accountId", "createdAt" DESC);
CREATE INDEX "gekta_payments_status_idx" ON "gekta_payments"("status", "createdAt" DESC);

-- Платёж нельзя удалить вместе с аккаунтом: расчётная история сохраняется.
ALTER TABLE "gekta_payments"
  ADD CONSTRAINT "gekta_payments_account_fk" FOREIGN KEY ("accountId")
  REFERENCES "gekta_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "gekta_webhook_events" (
  "id" TEXT NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "eventId" VARCHAR(128) NOT NULL,
  "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ(6),
  "outcome" VARCHAR(64) NOT NULL,
  CONSTRAINT "gekta_webhook_events_pkey" PRIMARY KEY ("id")
);

-- Повторное событие того же провайдера не применяется дважды.
CREATE UNIQUE INDEX "gekta_webhook_events_provider_event_key"
  ON "gekta_webhook_events"("provider", "eventId");

CREATE TABLE "gekta_merchant_profiles" (
  "id" TEXT NOT NULL,
  "operatorType" VARCHAR(32) NOT NULL,
  "legalDisplayName" VARCHAR(255) NOT NULL,
  "fullName" VARCHAR(255),
  "inn" VARCHAR(12),
  "ogrnip" VARCHAR(15),
  "ogrn" VARCHAR(13),
  "legalAddress" VARCHAR(500),
  "contactAddress" VARCHAR(500),
  "supportEmail" VARCHAR(255),
  "supportPhone" VARCHAR(32),
  "taxRegime" VARCHAR(16) NOT NULL,
  "receiptMode" VARCHAR(16) NOT NULL,
  "paymentProvider" VARCHAR(64),
  "billingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMPTZ(6),
  "source" VARCHAR(255),
  "effectiveFrom" TIMESTAMPTZ(6) NOT NULL,
  "effectiveTo" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gekta_merchant_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gekta_merchant_profiles_effective_idx"
  ON "gekta_merchant_profiles"("effectiveFrom" DESC);

-- Права runtime-принципалов на новые таблицы.
--
-- Таблицы создаёт владелец миграции, а приложение работает под ограниченной
-- ролью. Без явной выдачи прав ни одна операция Гекты не выполнится в
-- production, где принципал приложения отличается от владельца схемы.
--
-- Роль перечислена условно: в окружениях, где её нет, блок просто не выдаёт
-- ничего и миграция остаётся применимой.
DO $gekta_runtime_grants$
DECLARE
  runtime_role text;
  gekta_table text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_deal_runtime', 'one_deal_app', 'app_runtime')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime_role);

    FOREACH gekta_table IN ARRAY ARRAY[
      'gekta_accounts',
      'gekta_phone_identities',
      'gekta_usage',
      'gekta_entitlement_grants',
      'gekta_projects',
      'gekta_conversations',
      'gekta_messages',
      'gekta_consents',
      'gekta_support_grants',
      'gekta_subscriptions',
      'gekta_payments',
      'gekta_webhook_events',
      'gekta_merchant_profiles'
    ]
    LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO %I', gekta_table, runtime_role);
    END LOOP;

    -- Журнал оператора только дописывается: право на UPDATE ему не выдаётся,
    -- поэтому запись о выданном доступе нельзя переписать задним числом.
    EXECUTE format('GRANT SELECT, INSERT ON public.gekta_operator_audits TO %I', runtime_role);
  END LOOP;
END;
$gekta_runtime_grants$;

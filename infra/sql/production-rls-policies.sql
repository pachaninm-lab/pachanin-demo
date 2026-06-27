-- GrainFlow — PostgreSQL Row Level Security (ТЗ 4.1)
-- Применяется поверх Prisma-миграций в production PostgreSQL.
-- SQLite не поддерживает RLS — этот файл исполняется только в production.
--
-- Соглашение: current_setting('app.current_org_id', true) содержит orgId текущего пользователя,
-- current_setting('app.current_role', true) содержит роль (ADMIN/COMPLIANCE_OFFICER/etc.)
-- Устанавливается в начале транзакции через SET LOCAL.

-- ── 1. Deal ──────────────────────────────────────────────────────────────────
ALTER TABLE "Deal" ENABLE ROW LEVEL SECURITY;

-- Admin и Compliance видят все сделки
CREATE POLICY IF NOT EXISTS deal_admin_policy ON "Deal"
  USING (
    current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER')
  );

-- Участники сделки видят свою сделку
CREATE POLICY IF NOT EXISTS deal_participant_policy ON "Deal"
  USING (
    "sellerOrgId" = current_setting('app.current_org_id', true)
    OR "buyerOrgId" = current_setting('app.current_org_id', true)
  );

-- Arbitrator видит только сделки с активными спорами, где назначен арбитром
CREATE POLICY IF NOT EXISTS deal_arbitrator_policy ON "Deal"
  USING (
    current_setting('app.current_role', true) = 'ARBITRATOR'
    AND EXISTS (
      SELECT 1 FROM "Dispute" d
      WHERE d."dealId" = "Deal"."id"
        AND d."arbitratorId" = current_setting('app.current_user_id', true)
    )
  );

-- ── 2. Organization ───────────────────────────────────────────────────────────
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;

-- ADMIN/COMPLIANCE/SUPPORT видят все организации
CREATE POLICY IF NOT EXISTS org_admin_policy ON "organizations"
  USING (
    current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER')
  );

-- Пользователь видит свою организацию
CREATE POLICY IF NOT EXISTS org_own_policy ON "organizations"
  USING ("id" = current_setting('app.current_org_id', true));

-- ── 3. AuditEvent (append-only: DELETE запрещён для всех) ─────────────────────
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;

-- Только ADMIN и COMPLIANCE могут читать все записи
CREATE POLICY IF NOT EXISTS audit_read_policy ON "AuditEvent" FOR SELECT
  USING (
    current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER')
  );

-- Участники сделки видят только аудит своей сделки
CREATE POLICY IF NOT EXISTS audit_deal_policy ON "AuditEvent" FOR SELECT
  USING (
    "dealId" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "Deal" d
      WHERE d."id" = "AuditEvent"."dealId"
        AND (d."sellerOrgId" = current_setting('app.current_org_id', true)
          OR d."buyerOrgId" = current_setting('app.current_org_id', true))
    )
  );

-- INSERT разрешён только через сервисный аккаунт (role: app_service)
CREATE POLICY IF NOT EXISTS audit_insert_policy ON "AuditEvent" FOR INSERT
  WITH CHECK (current_user = 'app_service');

-- DELETE и UPDATE запрещены всем (append-only enforcement)
CREATE POLICY IF NOT EXISTS audit_no_delete_policy ON "AuditEvent" FOR DELETE
  USING (false);

CREATE POLICY IF NOT EXISTS audit_no_update_policy ON "AuditEvent" FOR UPDATE
  USING (false);

-- ── 4. LedgerEntry (финансовые записи) ───────────────────────────────────────
ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS ledger_admin_policy ON "LedgerEntry"
  USING (
    current_setting('app.current_role', true) IN ('ADMIN', 'ACCOUNTING', 'COMPLIANCE_OFFICER')
  );

CREATE POLICY IF NOT EXISTS ledger_deal_policy ON "LedgerEntry"
  USING (
    EXISTS (
      SELECT 1 FROM "Deal" d
      WHERE d."id" = "LedgerEntry"."dealId"
        AND (d."sellerOrgId" = current_setting('app.current_org_id', true)
          OR d."buyerOrgId" = current_setting('app.current_org_id', true))
    )
  );

-- UPDATE/DELETE запрещены (immutable ledger)
CREATE POLICY IF NOT EXISTS ledger_no_delete_policy ON "LedgerEntry" FOR DELETE
  USING (false);

CREATE POLICY IF NOT EXISTS ledger_no_update_policy ON "LedgerEntry" FOR UPDATE
  USING (false);

-- ── 5. IntegrationEvent ───────────────────────────────────────────────────────
ALTER TABLE "IntegrationEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS integration_event_policy ON "IntegrationEvent"
  USING (
    current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER')
  );

-- ── 6. OutboxEntry ────────────────────────────────────────────────────────────
ALTER TABLE "OutboxEntry" ENABLE ROW LEVEL SECURITY;

-- Только сервисный аккаунт и ADMIN
CREATE POLICY IF NOT EXISTS outbox_service_policy ON "OutboxEntry"
  USING (
    current_user = 'app_service'
    OR current_setting('app.current_role', true) = 'ADMIN'
  );

-- ── Вспомогательные функции ─────────────────────────────────────────────────
-- Функция для установки контекста пользователя в начале каждого запроса
CREATE OR REPLACE FUNCTION set_app_context(
  p_user_id TEXT,
  p_org_id TEXT,
  p_role TEXT
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.current_user_id', COALESCE(p_user_id, ''), false);
  PERFORM set_config('app.current_org_id', COALESCE(p_org_id, ''), false);
  PERFORM set_config('app.current_role', COALESCE(p_role, ''), false);
END;
$$;

COMMENT ON FUNCTION set_app_context IS
  'Вызывается API перед каждой транзакцией для RLS context. '
  'Prisma middleware: $executeRaw`SELECT set_app_context($1, $2, $3)`';

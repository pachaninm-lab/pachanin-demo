-- Кросс-tenant исполнение сделки (PHASE2_EXECUTION.md, решение A).
--
-- Реальная сделка объединяет организации из разных tenant'ов (покупатель,
-- элеватор, перевозчик, лаборатория). Сделка живёт в tenant'е продавца, а
-- участники назначаются в тот же tenant сделки. Прежде исполнение требовало,
-- чтобы tenant токена совпадал с tenant'ом сделки — участник из другого
-- tenant'а не мог ни прочитать сделку, ни исполнить команду.
--
-- RLS денежной сделки НЕ ослабляется. Вместо этого узкая SECURITY DEFINER
-- функция подтверждает активное участие (dealId + user + org + role) и
-- возвращает tenant сделки; приложение затем выполняет операцию в доверенном
-- RLS-контексте tenant'а сделки. Функция обходит RLS только для этой проверки
-- и возвращает исключительно tenant при подтверждённом участии — идентичность
-- участника (org/user/role) сверяется по строке deal_participants.

CREATE SCHEMA IF NOT EXISTS dealx;

CREATE OR REPLACE FUNCTION dealx.participant_tenant(
  p_deal_id text,
  p_user_id text,
  p_org_id text,
  p_role text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT d."tenantId"
  FROM deals d
  JOIN deal_participants p
    ON p."dealId" = d.id
   AND p."tenantId" = d."tenantId"
  WHERE d.id = p_deal_id
    AND p."userId" = p_user_id
    AND p."organizationId" = p_org_id
    AND p.role = p_role
    AND p.status = 'ACTIVE'
    AND p."accessLevel" = ANY (ARRAY['READ', 'WORK', 'APPROVE'])
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION dealx.participant_tenant(text, text, text, text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT USAGE ON SCHEMA dealx TO app_deal;
    GRANT EXECUTE ON FUNCTION dealx.participant_tenant(text, text, text, text) TO app_deal;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    GRANT USAGE ON SCHEMA dealx TO postgres;
    GRANT EXECUTE ON FUNCTION dealx.participant_tenant(text, text, text, text) TO postgres;
  END IF;
END $$;

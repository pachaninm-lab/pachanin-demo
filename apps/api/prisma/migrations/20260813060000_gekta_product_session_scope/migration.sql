-- Ограниченный тип сессии для продукта Гекта.
--
-- Гекта продаётся человеку, а не организации: у пользователя Гекты нет ни
-- членства, ни организации, ни ИНН. При этом вторая система аккаунтов не
-- создаётся — это те же public.users, тот же пароль в auth.credential_states,
-- та же email verification и тот же MFA. Отличается только область действия
-- сессии, и она хранится на сервере, а не в токене.
--
-- Существующая платформенная сессия не меняется ни в одном факте:
--   * колонка scope добавляется со значением по умолчанию 'PLATFORM',
--     поэтому каждая уже существующая строка остаётся платформенной;
--   * NOT NULL для membership_id/organization_id/tenant_id снимается на уровне
--     колонки, но тут же восстанавливается CHECK-ограничением ровно для
--     scope = 'PLATFORM'. Платформенная сессия без организации по-прежнему
--     физически невозможна;
--   * для scope = 'GEKTA' те же три колонки обязаны быть NULL. Продуктовая
--     сессия не может нести чужую организацию даже по ошибке приложения.
--
-- Следствие для авторизации: auth.resolve_session_identity_v2 внутренне
-- соединяется с user_orgs и organizations, поэтому строка со scope = 'GEKTA'
-- не разрешается этой функцией вообще. Любой платформенный маршрут,
-- построенный на ней, отклоняет продуктовую сессию без единой правки —
-- отказ обеспечивается схемой, а не проверкой в коде.
--
-- Миграция forward-only: она добавляет колонку, ограничения и индекс и не
-- переписывает ни одной существующей строки.

-- Утверждения идемпотентны: тот же файл повторно проигрывается гейтом
-- identity-изоляции поверх уже применённой цепочки миграций.
ALTER TABLE auth.sessions
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'PLATFORM';

ALTER TABLE auth.sessions
  ALTER COLUMN membership_id DROP NOT NULL,
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN tenant_id DROP NOT NULL;

ALTER TABLE auth.sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_scope_check;
ALTER TABLE auth.sessions
  ADD CONSTRAINT auth_sessions_scope_check
    CHECK (scope IN ('PLATFORM', 'GEKTA'));

-- Ограничение строго сильнее прежних трёх NOT NULL: оно сохраняет их для
-- платформенной сессии и дополнительно запрещает продуктовой сессии нести
-- организационную принадлежность.
ALTER TABLE auth.sessions
  DROP CONSTRAINT IF EXISTS auth_sessions_scope_identity_check;
ALTER TABLE auth.sessions
  ADD CONSTRAINT auth_sessions_scope_identity_check
    CHECK (
      (
        scope = 'PLATFORM'
        AND membership_id IS NOT NULL
        AND organization_id IS NOT NULL
        AND tenant_id IS NOT NULL
      )
      OR (
        scope = 'GEKTA'
        AND membership_id IS NULL
        AND organization_id IS NULL
        AND tenant_id IS NULL
      )
    );

CREATE INDEX IF NOT EXISTS auth_sessions_scope_user_idx ON auth.sessions (scope, user_id);

-- Разрешение личности продуктовой сессии.
--
-- public."users" закрыт row-level security, и рантайм не читает эту таблицу
-- напрямую ни в одном существующем сценарии: личность всегда приходит из
-- ограниченной SECURITY DEFINER функции. Продукт не становится исключением —
-- он получает такую же функцию с такими же владельцем, search_path и
-- row_security, и возвращает она строго четыре поля.
--
-- Организация, тенант, членство и роль отсутствуют в возвращаемом типе, а не
-- просто не заполняются: продуктовая сессия физически не может предъявить
-- организационную принадлежность, даже если вызывающий код этого захочет.
CREATE OR REPLACE FUNCTION auth.resolve_product_session_identity_v1(
  p_user_id text
)
RETURNS TABLE (
  user_id text,
  email text,
  full_name text,
  user_status text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
SET row_security = on
AS $function$
  SELECT
    subject."id",
    subject."email",
    subject."fullName",
    subject."status"
  FROM public."users" subject
  WHERE subject."id" = p_user_id
  LIMIT 1;
$function$;
ALTER FUNCTION auth.resolve_product_session_identity_v1(text)
  OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.resolve_product_session_identity_v1(text) FROM PUBLIC;

-- Право выполнения выдаётся ровно тем рантайм-ролям, которые уже разрешают
-- платформенную сессию. Новых принципалов не появляется.
DO $product_session_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_product_session_identity_v1(text) TO %I', runtime_role);
  END LOOP;
END;
$product_session_grants$;

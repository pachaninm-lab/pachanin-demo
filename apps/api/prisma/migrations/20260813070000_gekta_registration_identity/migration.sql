-- Регистрация в Гекте без организации и ИНН.
--
-- Корпоративная регистрация «Прозрачной Цены» неприменима: она требует ИНН,
-- создаёт организацию и ставит заявку в очередь на проверку. Пользователю
-- Гекты нечего проверять — он покупает доступ себе, а не организации.
--
-- Вторая система аккаунтов при этом не создаётся. Пользователь заводится в тех
-- же public.users, пароль — в тех же auth.credential_states, подтверждение
-- email — в той же таблице auth.registration_email_challenges и тем же
-- механизмом одноразового токена, MFA — тот же. Отличается ровно одно: у
-- заявки нет организации, поэтому у неё нет и registration_application.
--
-- Ослабления нет: NOT NULL на application_id снимается на уровне колонки и
-- тут же восстанавливается CHECK-ограничением ровно для scope = 'PLATFORM'.
-- Корпоративный challenge без заявки по-прежнему физически невозможен, а
-- продуктовый не может сослаться на чужую заявку.

ALTER TABLE auth.registration_email_challenges
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'PLATFORM';

ALTER TABLE auth.registration_email_challenges
  ALTER COLUMN application_id DROP NOT NULL;

ALTER TABLE auth.registration_email_challenges
  DROP CONSTRAINT IF EXISTS registration_email_scope_check;
ALTER TABLE auth.registration_email_challenges
  ADD CONSTRAINT registration_email_scope_check
    CHECK (scope IN ('PLATFORM', 'GEKTA'));

ALTER TABLE auth.registration_email_challenges
  DROP CONSTRAINT IF EXISTS registration_email_scope_application_check;
ALTER TABLE auth.registration_email_challenges
  ADD CONSTRAINT registration_email_scope_application_check
    CHECK (
      (scope = 'PLATFORM' AND application_id IS NOT NULL)
      OR (scope = 'GEKTA' AND application_id IS NULL)
    );

CREATE INDEX IF NOT EXISTS registration_email_scope_user_idx
  ON auth.registration_email_challenges (scope, user_id, status, created_at DESC);

-- Заведение личности пользователя Гекты.
--
-- Функция намеренно не принимает ни ИНН, ни организацию, ни тенант, ни роль,
-- ни запрошенное рабочее место: их нет в сигнатуре, поэтому продуктовая
-- регистрация не может создать организацию даже по ошибке приложения.
--
-- Ответ на занятый email не отличается от ответа на свободный: иначе форма
-- регистрации стала бы способом перечислять пользователей платформы.
CREATE OR REPLACE FUNCTION auth.prepare_gekta_registration_identity(
  p_user_id text,
  p_email text,
  p_phone text,
  p_password_hash text,
  p_full_name text
)
RETURNS TABLE (
  outcome text,
  user_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  normalized_email text := lower(btrim(COALESCE(p_email, '')));
  created_at timestamptz := now();
BEGIN
  IF normalized_email = '' OR position('@' in normalized_email) <= 1 THEN
    RAISE EXCEPTION 'Registration email is invalid' USING ERRCODE = '22023';
  END IF;
  IF btrim(COALESCE(p_user_id, '')) = '' THEN
    RAISE EXCEPTION 'Registration identifier is required' USING ERRCODE = '22023';
  END IF;
  -- Открытый пароль в базу не попадает ни на одном шаге: функция принимает
  -- только уже посчитанный bcrypt-хеш.
  IF length(COALESCE(p_password_hash, '')) < 40 THEN
    RAISE EXCEPTION 'Registration credential must be pre-hashed' USING ERRCODE = '22023';
  END IF;
  IF btrim(COALESCE(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Registration name is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('registration-email:' || normalized_email, 0));

  IF EXISTS (SELECT 1 FROM public."users" subject WHERE lower(subject."email") = normalized_email) THEN
    RETURN QUERY SELECT 'SUPPRESSED'::text, NULL::text;
    RETURN;
  END IF;

  INSERT INTO public."users" (
    "id", "email", "phone", "passwordHash", "fullName", "status",
    "mfaEnabled", "mfaSecret", "mfaBackup", "deletedAt", "createdAt", "updatedAt"
  ) VALUES (
    p_user_id, normalized_email, NULLIF(btrim(COALESCE(p_phone, '')), ''),
    p_password_hash, btrim(p_full_name), 'PENDING_EMAIL_VERIFICATION',
    false, NULL, NULL, NULL, created_at, created_at
  );

  -- Ни одной строки в user_orgs и organizations: у пользователя Гекты нет
  -- членства, поэтому auth.resolve_session_identity_v2 никогда не разрешит
  -- ему платформенную сессию, а login «Прозрачной Цены» ответит
  -- NO_ACTIVE_MEMBERSHIP. Доступ к закрытым функциям платформы не возникает.

  RETURN QUERY SELECT 'CREATED'::text, p_user_id;
END;
$function$;
-- Владелец тот же, что у корпоративной регистрации: право писать в
-- public.users принадлежит контуру регистрации, а не контуру чтения личности.
ALTER FUNCTION auth.prepare_gekta_registration_identity(text, text, text, text, text)
  OWNER TO pc_registration_lifecycle_authority;
REVOKE ALL ON FUNCTION auth.prepare_gekta_registration_identity(text, text, text, text, text) FROM PUBLIC;

-- Подтверждение email пользователя Гекты.
--
-- Пользователь становится ACTIVE только после того, как в этой же транзакции
-- одноразовый токен уже переведён в CONSUMED. Проверять нечего сверх этого:
-- организации, которую надо было бы одобрить, у него нет.
CREATE OR REPLACE FUNCTION auth.mark_gekta_email_verified(
  p_challenge_id text,
  p_user_id text
)
RETURNS TABLE (updated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  affected integer;
BEGIN
  UPDATE public."users" subject
  SET "status" = 'ACTIVE', "updatedAt" = now()
  WHERE subject."id" = p_user_id
    AND subject."status" = 'PENDING_EMAIL_VERIFICATION'
    AND EXISTS (
      SELECT 1
      FROM auth.registration_email_challenges challenge
      WHERE challenge.id = p_challenge_id
        AND challenge.user_id = p_user_id
        AND challenge.scope = 'GEKTA'
        AND challenge.application_id IS NULL
        AND challenge.status = 'CONSUMED'
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN QUERY SELECT affected = 1;
END;
$function$;
ALTER FUNCTION auth.mark_gekta_email_verified(text, text)
  OWNER TO pc_registration_lifecycle_authority;
REVOKE ALL ON FUNCTION auth.mark_gekta_email_verified(text, text) FROM PUBLIC;

-- Учётные данные для входа в Гекту.
--
-- Тот же трёхпольный до-парольный контур, что и у платформы: идентификатор,
-- нормализованный email и bcrypt-хеш, и ничего больше. Отличается только
-- условие — у субъекта не должно быть ни одного членства, иначе это
-- платформенный пользователь и вход должен идти обычным путём.
CREATE OR REPLACE FUNCTION auth.resolve_gekta_login_credential(
  p_email text
)
RETURNS TABLE (
  user_id text,
  email text,
  password_hash text,
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
    subject."passwordHash",
    subject."status"
  FROM public."users" subject
  WHERE lower(subject."email") = lower(btrim(COALESCE(p_email, '')))
    AND subject."deletedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public."user_orgs" membership WHERE membership."userId" = subject."id"
    )
  LIMIT 1;
$function$;
ALTER FUNCTION auth.resolve_gekta_login_credential(text)
  OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.resolve_gekta_login_credential(text) FROM PUBLIC;

-- Данные, нужные web-BFF после подтверждения email.
--
-- Телефон не включён в общую личность продуктовой сессии: большинству
-- маршрутов он не нужен. Этот узкий резолвер используется только внутри
-- регистрационной транзакции, после одноразового email-токена, чтобы BFF мог
-- связать заявленный номер с Гектой после успешного MFA. Пользователь с любым
-- членством здесь не разрешается.
CREATE OR REPLACE FUNCTION auth.resolve_gekta_registration_subject_v1(
  p_user_id text
)
RETURNS TABLE (
  user_id text,
  email text,
  full_name text,
  phone text,
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
    subject."phone",
    subject."status"
  FROM public."users" subject
  WHERE subject."id" = p_user_id
    AND subject."deletedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public."user_orgs" membership WHERE membership."userId" = subject."id"
    )
  LIMIT 1;
$function$;
ALTER FUNCTION auth.resolve_gekta_registration_subject_v1(text)
  OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.resolve_gekta_registration_subject_v1(text) FROM PUBLIC;

-- Право выполнения выдаётся ровно тем рантайм-ролям, которые уже выполняют
-- соответствующие платформенные функции. Новых принципалов не появляется.
DO $gekta_registration_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.prepare_gekta_registration_identity(text,text,text,text,text) TO %I',
      runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.mark_gekta_email_verified(text,text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_gekta_login_credential(text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_gekta_registration_subject_v1(text) TO %I', runtime_role);
  END LOOP;
END;
$gekta_registration_grants$;

-- Every internal staff assignment requires MFA.
-- Setting mfa_enabled without a secret intentionally drives the existing login
-- flow into TOTP enrollment before any staff authority can be exercised.

CREATE OR REPLACE FUNCTION auth.require_mfa_for_staff_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  INSERT INTO auth.credential_states (user_id, mfa_enabled, updated_at)
  VALUES (NEW.user_id, TRUE, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET mfa_enabled = TRUE,
      updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_require_mfa_on_staff_assignment
AFTER INSERT OR UPDATE OF user_id, role, status ON auth.staff_assignments
FOR EACH ROW
WHEN (NEW.status IN ('ELIGIBLE', 'ACTIVE'))
EXECUTE FUNCTION auth.require_mfa_for_staff_assignment();

REVOKE ALL ON FUNCTION auth.require_mfa_for_staff_assignment() FROM PUBLIC;

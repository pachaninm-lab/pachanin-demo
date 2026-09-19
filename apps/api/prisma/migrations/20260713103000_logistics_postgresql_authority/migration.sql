-- IR-10.2 least-privilege row-lock capability.
--
-- PostgreSQL requires UPDATE privilege on at least one column for
-- SELECT ... FOR UPDATE. Canonical Deal validation locks a normalized admission
-- before the shipment insert consumes it, but the application principal must not
-- be able to mutate the registry directly.
--
-- Schema USAGE remains explicitly granted only to trusted runtime principals.
-- PUBLIC receives a column-scoped lock capability, while a table-owner guard
-- rejects every direct UPDATE/DELETE from non-authority principals. The
-- SECURITY DEFINER shipment-binding function continues to mutate the admission
-- as the table owner inside the canonical Deal transaction.

CREATE OR REPLACE FUNCTION logistics.guard_deal_admission_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, logistics
AS $function$
DECLARE
  relation_owner NAME;
BEGIN
  SELECT pg_get_userbyid(class.relowner)
  INTO relation_owner
  FROM pg_catalog.pg_class class
  WHERE class.oid = TG_RELID;

  IF relation_owner IS NULL OR current_user <> relation_owner THEN
    RAISE EXCEPTION 'normalized logistics admission is authority-owned and cannot be mutated directly'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS logistics_deal_admissions_authority_guard
  ON logistics.deal_admissions;
CREATE TRIGGER logistics_deal_admissions_authority_guard
BEFORE UPDATE OR DELETE ON logistics.deal_admissions
FOR EACH ROW EXECUTE FUNCTION logistics.guard_deal_admission_authority();

REVOKE UPDATE, DELETE ON logistics.deal_admissions FROM PUBLIC;
GRANT UPDATE (version) ON logistics.deal_admissions TO PUBLIC;

COMMENT ON FUNCTION logistics.guard_deal_admission_authority() IS
  'Blocks direct normalized-admission mutation; only table-owner SECURITY DEFINER authority paths may consume or revoke an admission.';
COMMENT ON COLUMN logistics.deal_admissions.version IS
  'Column-scoped UPDATE privilege is a PostgreSQL row-lock capability only; direct updates are rejected by logistics_deal_admissions_authority_guard.';

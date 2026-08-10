-- Regression proof for the live reviewer-preflight 42501 authority ACL repair.
-- This migration intentionally performs no data mutation and adds no privilege.

DO $p0_reviewer_authority_acl_regression$
BEGIN
  IF NOT has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'SELECT') THEN
    RAISE EXCEPTION 'pc_staff_authority lost SELECT on auth.staff_assignments'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'SELECT')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'INSERT')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'UPDATE')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'DELETE')
  THEN
    RAISE EXCEPTION 'pc_staff_runtime gained forbidden staff_assignments table authority'
      USING ERRCODE = '42501';
  END IF;
  IF NOT has_function_privilege(
    'pc_staff_runtime', 'auth.staff_reviewer_preflight()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime lost reviewer-preflight execute authority'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_authority_acl_regression$;

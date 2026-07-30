from pathlib import Path

path = Path('apps/api/prisma/migrations/20260730101500_fgis_grain_tenant_read_authority/migration.sql')
source = path.read_text()
helper = """CREATE OR REPLACE FUNCTION public.text_array_has_unique_elements(values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $function$
  SELECT cardinality(values) = (
    SELECT count(DISTINCT value)::integer
    FROM unnest(values) AS item(value)
  );
$function$;

"""
if 'CREATE OR REPLACE FUNCTION public.text_array_has_unique_elements' not in source:
    source = helper + source
invalid = '\n      AND cardinality("allowedOperations") = cardinality(ARRAY(SELECT DISTINCT unnest("allowedOperations")))'
unique_guard = '\n      AND public.text_array_has_unique_elements("allowedOperations")'
if invalid in source:
    source = source.replace(invalid, unique_guard)
elif unique_guard not in source:
    anchor = """      ]::text[]
    ),
  CONSTRAINT "fgis_grain_tenant_read_auth_ttl_ck""" 
    replacement = """      ]::text[]
      AND public.text_array_has_unique_elements("allowedOperations")
    ),
  CONSTRAINT "fgis_grain_tenant_read_auth_ttl_ck"""
    if source.count(anchor) != 1:
        raise SystemExit(f'migration duplicate guard anchor count: {source.count(anchor)}')
    source = source.replace(anchor, replacement)
if 'grainflow_runtime' in source:
    raise SystemExit('migration still contains nonexistent grainflow_runtime role')
for required in [
    "ARRAY['app_runtime', 'app_service']",
    'public.app_rls_context_ready()',
    'fgis_grain_tenant_read_auth_select_policy',
    'fgis_grain_tenant_read_auth_insert_policy',
    'fgis_grain_tenant_read_auth_update_policy',
    'fgis_grain_tenant_read_audit_select_policy',
    'fgis_grain_tenant_read_audit_insert_policy',
]:
    if required not in source:
        raise SystemExit(f'migration hardening missing: {required}')
path.write_text(source)

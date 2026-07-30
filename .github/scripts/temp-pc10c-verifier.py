from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    return source.replace(old, new)


path = Path('scripts/pc-crop-10c/verify.mjs')
source = path.read_text()
anchor = """  check(migration.includes('GRANT SELECT, INSERT ON public.\"fgis_grain_tenant_read_audits\"'), 'audit runtime grant is not append-only');
  check(!migration.includes('GRANT DELETE') && !migration.includes('GRANT ALL'), 'migration grants unsafe mutation authority');"""
extra = anchor + """
  check(!migration.includes('grainflow_runtime'), 'migration targets a nonexistent runtime principal');
  check(migration.includes("ARRAY['app_runtime', 'app_service']"), 'runtime principal grant set mismatch');
  check(migration.includes('public.app_rls_context_ready()'), 'role-aware RLS context guard missing');
  check(migration.includes('fgis_grain_tenant_read_auth_select_policy'), 'authorization SELECT policy missing');
  check(migration.includes('fgis_grain_tenant_read_auth_insert_policy'), 'authorization INSERT policy missing');
  check(migration.includes('fgis_grain_tenant_read_auth_update_policy'), 'authorization UPDATE policy missing');
  check(migration.includes('text_array_has_unique_elements'), 'database duplicate-operation guard missing');"""
if 'migration targets a nonexistent runtime principal' not in source:
    source = replace_once(source, anchor, extra, 'verifier runtime grants')
anchor = "  check(repository.includes('Prisma.join(input.allowedOperations)'), 'PostgreSQL operation array binding is not parameterized safely');"
if 'denied request audit can roll back' not in source:
    source = replace_once(source, anchor, anchor + "\n  check(repository.includes('if (preflight.denial)'), 'denied request audit can roll back with the HTTP rejection');", 'verifier denial commit')
anchor = "  check(e2e.includes('CREATE_SDIZ'), 'PostgreSQL E2E does not prove provider mutation rejection');"
if 'PostgreSQL E2E does not use the restricted runtime principal' not in source:
    source = replace_once(source, anchor, anchor + """
  check(e2e.includes('runtimeVisibleAuthorizationCount'), 'PostgreSQL E2E does not use the restricted runtime principal');
  check(e2e.includes('AUTHORIZATION_NOT_ATTESTED'), 'PostgreSQL E2E does not prove committed denial evidence');""", 'verifier restricted RLS tests')
path.write_text(source)

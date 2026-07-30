from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    return source.replace(old, new)


path = Path('.github/workflows/pc-crop-10c.yml')
source = path.read_text()
if 'PC_CROP_10C_RUNTIME_DATABASE_URL' not in source:
    source = replace_once(source, '  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/grainflow?schema=public', '  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/grainflow?schema=public\n  PC_CROP_10C_RUNTIME_DATABASE_URL: postgresql://app_runtime:app_runtime@localhost:5432/grainflow?schema=public', 'runtime database URL')
bootstrap = r'''      - name: Bootstrap restricted runtime principal
        env:
          PGPASSWORD: postgres
        shell: bash
        run: |
          set -euo pipefail
          psql -h localhost -U postgres -d grainflow -v ON_ERROR_STOP=1 <<'SQL'
          DO $bootstrap$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
              CREATE ROLE app_runtime LOGIN PASSWORD 'app_runtime' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
            ELSE
              ALTER ROLE app_runtime LOGIN PASSWORD 'app_runtime' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
            END IF;
          END;
          $bootstrap$;
          GRANT CONNECT ON DATABASE grainflow TO app_runtime;
          GRANT USAGE ON SCHEMA public TO app_runtime;
          SQL

'''
marker = """      - name: Apply complete PostgreSQL migration chain
        shell: bash"""
if 'Bootstrap restricted runtime principal' not in source:
    source = replace_once(source, marker, bootstrap + marker, 'runtime principal bootstrap')
privilege = r'''      - name: Verify restricted principal and append-only grants
        env:
          PGPASSWORD: postgres
        shell: bash
        run: |
          set -euo pipefail
          psql -h localhost -U postgres -d grainflow -v ON_ERROR_STOP=1 <<'SQL'
          DO $verify$
          BEGIN
            IF NOT has_table_privilege('app_runtime', 'public.fgis_grain_tenant_read_authorizations', 'SELECT')
               OR NOT has_table_privilege('app_runtime', 'public.fgis_grain_tenant_read_authorizations', 'INSERT')
               OR NOT has_table_privilege('app_runtime', 'public.fgis_grain_tenant_read_authorizations', 'UPDATE')
               OR has_table_privilege('app_runtime', 'public.fgis_grain_tenant_read_authorizations', 'DELETE')
               OR NOT has_table_privilege('app_runtime', 'public.fgis_grain_tenant_read_audits', 'SELECT')
               OR NOT has_table_privilege('app_runtime', 'public.fgis_grain_tenant_read_audits', 'INSERT')
               OR has_table_privilege('app_runtime', 'public.fgis_grain_tenant_read_audits', 'UPDATE')
               OR has_table_privilege('app_runtime', 'public.fgis_grain_tenant_read_audits', 'DELETE')
            THEN
              RAISE EXCEPTION 'PC_CROP_10C_RUNTIME_GRANTS_INVALID';
            END IF;
            IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fgis_grain_tenant_read_authorizations') <> 3
               OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fgis_grain_tenant_read_audits') <> 2
            THEN
              RAISE EXCEPTION 'PC_CROP_10C_RLS_POLICIES_INVALID';
            END IF;
          END;
          $verify$;
          SQL
          touch "$EVIDENCE_DIR/restricted-principal.ok"

'''
marker = """      - name: Typecheck API authority
        shell: bash"""
if 'Verify restricted principal and append-only grants' not in source:
    source = replace_once(source, marker, privilege + marker, 'restricted grant verification')
path.write_text(source)

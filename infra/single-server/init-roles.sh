#!/bin/bash
# Runs once, on first database initialization. Creates the runtime principals the
# application requires: a least-privilege app role and a SEPARATE storage role
# (the API enforces that STORAGE_DATABASE_URL uses a distinct principal). The
# migration image, running as the grainflow_ddl owner, creates the schema and
# grants these roles their privileges.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE grainflow_app LOGIN PASSWORD '${APP_PASSWORD}';
  CREATE ROLE grainflow_storage LOGIN PASSWORD '${STORAGE_PASSWORD}';
  GRANT CONNECT ON DATABASE grainflow TO grainflow_app, grainflow_storage;
EOSQL

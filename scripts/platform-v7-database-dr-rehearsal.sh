#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ADMIN_URL="${DR_SOURCE_ADMIN_URL:?DR_SOURCE_ADMIN_URL is required}"
RESTORE_ADMIN_URL="${DR_RESTORE_ADMIN_URL:?DR_RESTORE_ADMIN_URL is required}"
RESTORE_AUTH_URL="${DR_RESTORE_AUTH_URL:?DR_RESTORE_AUTH_URL is required}"
RESTORE_APP_URL="${DR_RESTORE_APP_URL:?DR_RESTORE_APP_URL is required}"
BACKUP_PATH="${DR_BACKUP_PATH:-/tmp/platform-v7-predeploy.backup}"
MANIFEST_PATH="${DR_MANIFEST_PATH:-/tmp/platform-v7-dr-manifest.json}"
EVIDENCE_LOG="${DR_EVIDENCE_LOG:-/tmp/platform-v7-dr-rehearsal.log}"

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Refusing DR rehearsal with NODE_ENV=production" >&2
  exit 2
fi
for candidate in "$SOURCE_ADMIN_URL" "$RESTORE_ADMIN_URL" "$RESTORE_AUTH_URL" "$RESTORE_APP_URL"; do
  if [[ "$candidate" =~ (^|[^a-z])(prod|production)([^a-z]|$) ]]; then
    echo "Refusing DR rehearsal: datasource appears production-like" >&2
    exit 2
  fi
done
if [[ "$SOURCE_ADMIN_URL" == "$RESTORE_ADMIN_URL" ]]; then
  echo "Refusing DR rehearsal: source and restore admin URLs are identical" >&2
  exit 2
fi
if [[ "$RESTORE_AUTH_URL" == "$RESTORE_APP_URL" ]]; then
  echo "Refusing DR rehearsal: restore auth and app URLs must use different principals" >&2
  exit 2
fi

for command in node psql pg_dump pg_restore createdb dropdb sha256sum date; do
  command -v "$command" >/dev/null || { echo "$command is required" >&2; exit 2; }
done

mkdir -p "$(dirname "$BACKUP_PATH")" "$(dirname "$MANIFEST_PATH")" "$(dirname "$EVIDENCE_LOG")"
: > "$EVIDENCE_LOG"
exec > >(tee -a "$EVIDENCE_LOG") 2>&1
cd "$ROOT_DIR"

url_database() {
  node -e "const u=new URL(process.argv[1]); console.log(decodeURIComponent(u.pathname.replace(/^\\//,'')))" "$1"
}
maintenance_url() {
  node -e "const u=new URL(process.argv[1]); u.pathname='/postgres'; console.log(u.toString())" "$1"
}

RESTORE_DATABASE="$(url_database "$RESTORE_ADMIN_URL")"
RESTORE_MAINTENANCE_URL="$(maintenance_url "$RESTORE_ADMIN_URL")"
if [[ ! "$RESTORE_DATABASE" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Unsafe restore database name: $RESTORE_DATABASE" >&2
  exit 2
fi

fingerprint() {
  local url="$1"
  psql "$url" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT md5(jsonb_build_object(
  'deal', (SELECT jsonb_build_object('id', id, 'status', status, 'totalKopecks', "totalKopecks", 'closedAt', "closedAt") FROM public.deals WHERE id='DEAL-INDUSTRIAL-001'),
  'participants', (SELECT count(*) FROM public.deal_participants WHERE "dealId"='DEAL-INDUSTRIAL-001'),
  'events', (SELECT jsonb_build_object('count', count(*), 'chain', md5(COALESCE(string_agg(id || ':' || hash || ':' || COALESCE("prevHash", ''), '|' ORDER BY "createdAt", id), ''))) FROM public.deal_events WHERE "dealId"='DEAL-INDUSTRIAL-001'),
  'audits', (SELECT jsonb_build_object('count', count(*), 'chain', md5(COALESCE(string_agg(id || ':' || hash || ':' || COALESCE("prevHash", ''), '|' ORDER BY "createdAt", id), ''))) FROM public.audit_events WHERE "dealId"='DEAL-INDUSTRIAL-001'),
  'documents', (SELECT count(*) FROM public.deal_documents WHERE "dealId"='DEAL-INDUSTRIAL-001' AND status='SIGNED'),
  'bankOperations', (SELECT jsonb_build_object('count', count(*), 'done', count(*) FILTER (WHERE status='DONE')) FROM public.bank_operations WHERE "dealId"='DEAL-INDUSTRIAL-001'),
  'ledger', (SELECT jsonb_build_object('count', count(*), 'amount', COALESCE(sum("amountKopecks"), 0)) FROM public.ledger_entries WHERE "dealId"='DEAL-INDUSTRIAL-001'),
  'authSessions', (SELECT jsonb_build_object('count', count(*), 'active', count(*) FILTER (WHERE status='ACTIVE')) FROM auth.sessions),
  'refreshTokens', (SELECT count(*) FROM auth.refresh_tokens),
  'migrations', (SELECT md5(COALESCE(string_agg(migration_name || ':' || COALESCE(checksum, '') || ':' || COALESCE(finished_at::text, ''), '|' ORDER BY migration_name), '')) FROM public._prisma_migrations),
  'rls', (SELECT md5(COALESCE(string_agg(c.relname || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text, '|' ORDER BY c.relname), '')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')),
  'policies', (SELECT md5(COALESCE(string_agg(tablename || ':' || policyname || ':' || cmd || ':' || permissive, '|' ORDER BY tablename, policyname), '')) FROM pg_policies WHERE schemaname='public')
)::text);
SQL
}

SOURCE_FINGERPRINT="$(fingerprint "$SOURCE_ADMIN_URL")"
if [[ -z "$SOURCE_FINGERPRINT" ]]; then
  echo "Source fingerprint is empty" >&2
  exit 1
fi

echo "[dr] source fingerprint: $SOURCE_FINGERPRINT"
BACKUP_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BACKUP_STARTED_EPOCH="$(date +%s)"
rm -f "$BACKUP_PATH" "$BACKUP_PATH.sha256"
pg_dump "$SOURCE_ADMIN_URL" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-acl \
  --file="$BACKUP_PATH"
sha256sum "$BACKUP_PATH" > "$BACKUP_PATH.sha256"
sha256sum --check "$BACKUP_PATH.sha256"
BACKUP_COMPLETED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BACKUP_SECONDS="$(( $(date +%s) - BACKUP_STARTED_EPOCH ))"
BACKUP_SHA256="$(cut -d' ' -f1 "$BACKUP_PATH.sha256")"
BACKUP_BYTES="$(wc -c < "$BACKUP_PATH" | tr -d ' ')"

echo "[dr] recreating isolated restore database: $RESTORE_DATABASE"
dropdb --if-exists --force --maintenance-db="$RESTORE_MAINTENANCE_URL" "$RESTORE_DATABASE"
createdb --maintenance-db="$RESTORE_MAINTENANCE_URL" "$RESTORE_DATABASE"

RESTORE_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RESTORE_STARTED_EPOCH="$(date +%s)"
pg_restore \
  --dbname="$RESTORE_ADMIN_URL" \
  --exit-on-error \
  --no-owner \
  --no-acl \
  "$BACKUP_PATH"
RESTORE_COMPLETED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RESTORE_SECONDS="$(( $(date +%s) - RESTORE_STARTED_EPOCH ))"

echo "[dr] restoring least-privilege runtime grants"
psql "$RESTORE_ADMIN_URL" -X --set ON_ERROR_STOP=1 <<SQL
GRANT CONNECT ON DATABASE "$RESTORE_DATABASE" TO one_deal_app, one_deal_auth;
GRANT USAGE ON SCHEMA public TO one_deal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO one_deal_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO one_deal_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO one_deal_app;

GRANT USAGE ON SCHEMA public, auth TO one_deal_auth;
GRANT SELECT, INSERT, UPDATE ON public.users, public.user_orgs, public.organizations TO one_deal_auth;
GRANT SELECT, INSERT, UPDATE ON
  auth.login_throttles,
  auth.credential_states,
  auth.sessions,
  auth.refresh_tokens,
  auth.mfa_challenges,
  auth.password_reset_challenges
TO one_deal_auth;
GRANT SELECT, INSERT ON auth.audit_events TO one_deal_auth;
SQL

RESTORE_FINGERPRINT="$(fingerprint "$RESTORE_ADMIN_URL")"
echo "[dr] restore fingerprint: $RESTORE_FINGERPRINT"
if [[ "$SOURCE_FINGERPRINT" != "$RESTORE_FINGERPRINT" ]]; then
  echo "Source and restore fingerprints differ" >&2
  exit 1
fi

FAILED_MIGRATIONS="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL")"
if [[ "$FAILED_MIGRATIONS" != "0" ]]; then
  echo "Restored migration history contains $FAILED_MIGRATIONS failed/incomplete migration(s)" >&2
  exit 1
fi

RLS_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FILTER (WHERE c.relrowsecurity)::text || ':' || count(*) FILTER (WHERE c.relforcerowsecurity)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')")"
if [[ "$RLS_PROOF" != "8:8" ]]; then
  echo "Restored RLS proof failed: $RLS_PROOF" >&2
  exit 1
fi

NODE_ENV=test \
DATABASE_URL="$RESTORE_APP_URL" \
AUTH_DATABASE_URL="$RESTORE_AUTH_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
JWT_SECRET="${JWT_SECRET:?JWT_SECRET is required}" \
AUTH_TOKEN_PEPPER="${AUTH_TOKEN_PEPPER:?AUTH_TOKEN_PEPPER is required}" \
MFA_ENCRYPTION_KEY="${MFA_ENCRYPTION_KEY:?MFA_ENCRYPTION_KEY is required}" \
pnpm --filter @pc/api exec ts-node test/one-deal/restored-database-acceptance.ts

node - "$MANIFEST_PATH" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
const manifest = {
  rehearsal: 'isolated-postgresql-backup-restore',
  productionAcceptance: false,
  sourceFingerprint: process.env.SOURCE_FINGERPRINT,
  restoreFingerprint: process.env.RESTORE_FINGERPRINT,
  backupSha256: process.env.BACKUP_SHA256,
  backupBytes: Number(process.env.BACKUP_BYTES),
  backupStartedAt: process.env.BACKUP_STARTED_AT,
  backupCompletedAt: process.env.BACKUP_COMPLETED_AT,
  backupSeconds: Number(process.env.BACKUP_SECONDS),
  restoreStartedAt: process.env.RESTORE_STARTED_AT,
  restoreCompletedAt: process.env.RESTORE_COMPLETED_AT,
  restoreSeconds: Number(process.env.RESTORE_SECONDS),
  recoveryPoint: process.env.BACKUP_COMPLETED_AT,
  rpo: 'not-established-production-cadence-required',
  rto: 'not-established-production-observation-required',
  rlsProof: '8:8',
  failedMigrations: 0,
};
fs.writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

export SOURCE_FINGERPRINT RESTORE_FINGERPRINT BACKUP_SHA256 BACKUP_BYTES
export BACKUP_STARTED_AT BACKUP_COMPLETED_AT BACKUP_SECONDS
export RESTORE_STARTED_AT RESTORE_COMPLETED_AT RESTORE_SECONDS

# Re-write after exports so the manifest contains measured values.
node - "$MANIFEST_PATH" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
const manifest = {
  rehearsal: 'isolated-postgresql-backup-restore',
  productionAcceptance: false,
  sourceFingerprint: process.env.SOURCE_FINGERPRINT,
  restoreFingerprint: process.env.RESTORE_FINGERPRINT,
  backupSha256: process.env.BACKUP_SHA256,
  backupBytes: Number(process.env.BACKUP_BYTES),
  backupStartedAt: process.env.BACKUP_STARTED_AT,
  backupCompletedAt: process.env.BACKUP_COMPLETED_AT,
  backupSeconds: Number(process.env.BACKUP_SECONDS),
  restoreStartedAt: process.env.RESTORE_STARTED_AT,
  restoreCompletedAt: process.env.RESTORE_COMPLETED_AT,
  restoreSeconds: Number(process.env.RESTORE_SECONDS),
  recoveryPoint: process.env.BACKUP_COMPLETED_AT,
  rpo: 'not-established-production-cadence-required',
  rto: 'not-established-production-observation-required',
  rlsProof: '8:8',
  failedMigrations: 0,
};
fs.writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

cat "$MANIFEST_PATH"
echo "[dr] backup/restore rehearsal passed without weakening RLS"

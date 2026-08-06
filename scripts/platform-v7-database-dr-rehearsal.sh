#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ADMIN_URL="${DR_SOURCE_ADMIN_URL:?DR_SOURCE_ADMIN_URL is required}"
RESTORE_ADMIN_URL="${DR_RESTORE_ADMIN_URL:?DR_RESTORE_ADMIN_URL is required}"
RESTORE_AUTH_URL="${DR_RESTORE_AUTH_URL:?DR_RESTORE_AUTH_URL is required}"
RESTORE_APP_URL="${DR_RESTORE_APP_URL:?DR_RESTORE_APP_URL is required}"
RESTORE_STORAGE_URL="${DR_RESTORE_STORAGE_URL:?DR_RESTORE_STORAGE_URL is required}"
BACKUP_PATH="${DR_BACKUP_PATH:-/tmp/platform-v7-predeploy.backup}"
MANIFEST_PATH="${DR_MANIFEST_PATH:-/tmp/platform-v7-dr-manifest.json}"
EVIDENCE_LOG="${DR_EVIDENCE_LOG:-/tmp/platform-v7-dr-rehearsal.log}"

if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Refusing DR rehearsal with NODE_ENV=production" >&2
  exit 2
fi
for candidate in "$SOURCE_ADMIN_URL" "$RESTORE_ADMIN_URL" "$RESTORE_AUTH_URL" "$RESTORE_APP_URL" "$RESTORE_STORAGE_URL"; do
  if [[ "$candidate" =~ (^|[^a-z])(prod|production)([^a-z]|$) ]]; then
    echo "Refusing DR rehearsal: datasource appears production-like" >&2
    exit 2
  fi
done
if [[ "$SOURCE_ADMIN_URL" == "$RESTORE_ADMIN_URL" ]]; then
  echo "Refusing DR rehearsal: source and restore admin URLs are identical" >&2
  exit 2
fi
if [[ "$RESTORE_AUTH_URL" == "$RESTORE_APP_URL" || "$RESTORE_AUTH_URL" == "$RESTORE_STORAGE_URL" \
  || "$RESTORE_APP_URL" == "$RESTORE_STORAGE_URL" ]]; then
  echo "Refusing DR rehearsal: restore auth, app and storage URLs must use different principals" >&2
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
  'settlementPayment', (SELECT jsonb_build_object(
      'status', status,
      'reserved', confirmed_reserved_minor,
      'released', confirmed_released_minor,
      'refunded', confirmed_refunded_minor,
      'hold', active_hold_minor,
      'version', version
    ) FROM settlement.payments WHERE deal_id='DEAL-INDUSTRIAL-001'),
  'settlementOperations', (SELECT jsonb_build_object(
      'count', count(*),
      'chain', md5(COALESCE(string_agg(id || ':' || operation_type || ':' || status || ':' || amount_minor::text, '|' ORDER BY created_at, id), ''))
    ) FROM settlement.bank_operations WHERE deal_id='DEAL-INDUSTRIAL-001'),
  'settlementCallbacks', (SELECT jsonb_build_object(
      'count', count(*),
      'chain', md5(COALESCE(string_agg(event_id || ':' || operation_id || ':' || callback_status || ':' || payload_fingerprint, '|' ORDER BY received_at, id), ''))
    ) FROM settlement.bank_callbacks WHERE deal_id='DEAL-INDUSTRIAL-001'),
  'settlementLedger', (SELECT jsonb_build_object(
      'count', count(*),
      'chain', md5(COALESCE(string_agg(id || ':' || hash || ':' || COALESCE(prev_hash, ''), '|' ORDER BY created_at, id), ''))
    ) FROM settlement.ledger_entries WHERE deal_id='DEAL-INDUSTRIAL-001'),
  'settlementOutbox', (SELECT jsonb_build_object(
      'bankRequests', count(*) FILTER (WHERE left(type, 5)='BANK_'),
      'confirmedBankRequests', count(*) FILTER (WHERE left(type, 5)='BANK_' AND status='CONFIRMED'),
      'receipts', count(*) FILTER (WHERE type='settlement.command.receipt'),
      'confirmedReceipts', count(*) FILTER (WHERE type='settlement.command.receipt' AND status='CONFIRMED'),
      'chain', md5(COALESCE(string_agg(id || ':' || type || ':' || status || ':' || COALESCE("idempotencyKey", ''), '|' ORDER BY "createdAt", id), ''))
    ) FROM public.outbox_entries WHERE "dealId"='DEAL-INDUSTRIAL-001' AND (left(type, 5)='BANK_' OR type='settlement.command.receipt')),
  'authSessions', (SELECT jsonb_build_object('count', count(*), 'active', count(*) FILTER (WHERE status='ACTIVE')) FROM auth.sessions),
  'refreshTokens', (SELECT count(*) FROM auth.refresh_tokens),
  'migrations', (SELECT md5(COALESCE(string_agg(migration_name || ':' || COALESCE(checksum, '') || ':' || COALESCE(finished_at::text, ''), '|' ORDER BY migration_name), '')) FROM public._prisma_migrations),
  'publicRls', (SELECT md5(COALESCE(string_agg(c.relname || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text, '|' ORDER BY c.relname), '')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')),
  'settlementRls', (SELECT md5(COALESCE(string_agg(c.relname || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text, '|' ORDER BY c.relname), '')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='settlement' AND c.relname IN ('payment_terms','beneficiaries','payments','holds','bank_operations','bank_callbacks','ledger_entries','reconciliation_facts')),
  'publicPolicies', (SELECT md5(COALESCE(string_agg(tablename || ':' || policyname || ':' || cmd || ':' || permissive, '|' ORDER BY tablename, policyname), '')) FROM pg_policies WHERE schemaname='public'),
  'settlementPolicies', (SELECT md5(COALESCE(string_agg(tablename || ':' || policyname || ':' || cmd || ':' || permissive, '|' ORDER BY tablename, policyname), '')) FROM pg_policies WHERE schemaname='settlement')
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
GRANT CONNECT ON DATABASE "$RESTORE_DATABASE" TO one_deal_app, one_deal_auth, one_deal_storage;

GRANT USAGE ON SCHEMA public, security, logistics, labs, settlement, auth TO one_deal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO one_deal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA security TO one_deal_app;
GRANT SELECT ON ALL TABLES IN SCHEMA logistics TO one_deal_app;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA logistics FROM one_deal_app;
GRANT SELECT, INSERT, UPDATE ON
  labs.laboratories,
  labs.authorized_actors,
  labs.methods,
  labs.equipment,
  labs.sample_admissions
TO one_deal_app;
GRANT SELECT, INSERT ON labs.sample_custody_events TO one_deal_app;
GRANT SELECT ON labs.protocols TO one_deal_app;
REVOKE DELETE ON ALL TABLES IN SCHEMA labs FROM one_deal_app;
GRANT SELECT, INSERT ON
  settlement.payment_terms,
  settlement.beneficiaries,
  settlement.bank_callbacks,
  settlement.ledger_entries,
  settlement.reconciliation_facts
TO one_deal_app;
GRANT SELECT, INSERT, UPDATE ON
  settlement.payments,
  settlement.holds,
  settlement.bank_operations
TO one_deal_app;
REVOKE DELETE ON ALL TABLES IN SCHEMA settlement FROM one_deal_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO one_deal_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO one_deal_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA settlement TO one_deal_app;

GRANT USAGE ON SCHEMA public TO one_deal_storage;
GRANT SELECT ON public.deals, public.deal_participants TO one_deal_storage;
GRANT SELECT, UPDATE ON public.deal_documents TO one_deal_storage;
REVOKE INSERT, DELETE ON public.deal_documents FROM one_deal_storage;

GRANT USAGE ON SCHEMA public, auth TO one_deal_auth;
GRANT SELECT, INSERT, UPDATE ON public.users, public.user_orgs, public.organizations TO one_deal_auth;
GRANT SELECT, INSERT, UPDATE ON
  auth.login_throttles,
  auth.credential_states,
  auth.sessions,
  auth.refresh_tokens,
  auth.mfa_challenges
TO one_deal_auth;
GRANT SELECT, INSERT ON auth.audit_events TO one_deal_auth;
SQL

# pg_restore ran with --no-owner --no-acl, which is what makes the restored
# database independent of the source cluster's roles — and what silently
# dismantles the identity boundary. Every SECURITY DEFINER function comes back
# owned by the restoring principal, so a definer function meant to run as the
# confined pc_identity_bootstrap runs as the restore admin instead: FORCE RLS
# stops applying to it and the pre-auth surface becomes an unrestricted read.
# The ACLs are gone too, so the REVOKE ... FROM PUBLIC no longer holds.
#
# Re-establishing that is part of the recovery, not an optimisation. This is
# the same statement set the migration issues, replayed after the restore.
echo "[dr] re-establishing identity definer ownership and execution privileges"
psql "$RESTORE_ADMIN_URL" -X --set ON_ERROR_STOP=1 <<'SQL'
DO $identity_recovery$
DECLARE
  bootstrap_owned text[] := ARRAY[
    'auth.resolve_login_identity(text)',
    'auth.resolve_login_identity_by_id(text)',
    'auth.resolve_login_memberships(text)',
    'auth.resolve_login_memberships_ordered(text)',
    'auth.resolve_login_context_by_email(text)',
    'auth.resolve_login_context_by_membership(text,text)',
    'auth.resolve_session_identity(text,text,text,text)',
    'auth.validate_deal_creation_actors(text,text,text,text,text)',
    'public.app_identity_is_org_admin()',
    'public.app_identity_is_reviewer()'
  ];
  authority_owned text[] := ARRAY[
    'auth.staff_admission_capability(text,text,text,text,text)',
    'auth.staff_admission_queue(text,text,text,integer)',
    'auth.staff_admission_application(text,text,text,text)',
    'auth.staff_admission_decision(text,text,text,text,text,text)'
  ];
  target text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_identity_bootstrap') THEN
    FOREACH target IN ARRAY bootstrap_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_identity_bootstrap', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA auth, public TO pc_identity_bootstrap;
    GRANT SELECT ON auth.staff_assignments, auth.sessions TO pc_identity_bootstrap;
    GRANT SELECT ON public.users, public.user_orgs, public.organizations TO pc_identity_bootstrap;
    -- The two authority predicates are consulted by policies on behalf of
    -- whichever principal runs the statement, so they go back to PUBLIC.
    GRANT EXECUTE ON FUNCTION public.app_identity_is_org_admin() TO PUBLIC;
    GRANT EXECUTE ON FUNCTION public.app_identity_is_reviewer() TO PUBLIC;
    -- The pre-auth surface goes to the authentication principal alone.
    GRANT EXECUTE ON FUNCTION auth.resolve_login_identity(text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_login_identity_by_id(text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_login_memberships(text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_login_memberships_ordered(text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_email(text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_membership(text,text) TO one_deal_auth;
    GRANT EXECUTE ON FUNCTION auth.resolve_session_identity(text,text,text,text) TO one_deal_auth;
    -- Deal actor validation is separate from pre-authentication and belongs to
    -- the deal runtime only. It returns a status code, never identity rows.
    GRANT EXECUTE ON FUNCTION auth.validate_deal_creation_actors(text,text,text,text,text)
      TO one_deal_app;
    REVOKE ALL ON FUNCTION auth.validate_deal_creation_actors(text,text,text,text,text)
      FROM one_deal_auth, one_deal_storage;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_staff_authority') THEN
    FOREACH target IN ARRAY authority_owned LOOP
      IF to_regprocedure(target) IS NOT NULL THEN
        EXECUTE format('ALTER FUNCTION %s OWNER TO pc_staff_authority', target);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', target);
      END IF;
    END LOOP;
    GRANT USAGE ON SCHEMA public, auth TO pc_staff_authority;
    GRANT SELECT ON auth.staff_access_sessions, auth.staff_access_grants, auth.staff_assignments
      TO pc_staff_authority;
    GRANT SELECT ON public.organizations, public.users, public.user_orgs TO pc_staff_authority;
    GRANT UPDATE ("status", "kycStatus", "verifiedAt", "updatedAt")
      ON public.organizations TO pc_staff_authority;
    GRANT SELECT ON public.kyc_tasks TO pc_staff_authority;
    GRANT UPDATE ("status", "assignedTo", "notes", "resolvedAt", "updatedAt")
      ON public.kyc_tasks TO pc_staff_authority;
    GRANT EXECUTE ON FUNCTION auth.staff_admission_capability(text,text,text,text,text)
      TO pc_staff_authority;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_staff_runtime') THEN
      GRANT USAGE ON SCHEMA auth TO pc_staff_runtime;
      GRANT EXECUTE ON FUNCTION auth.staff_admission_queue(text,text,text,integer) TO pc_staff_runtime;
      GRANT EXECUTE ON FUNCTION auth.staff_admission_application(text,text,text,text) TO pc_staff_runtime;
      GRANT EXECUTE ON FUNCTION auth.staff_admission_decision(text,text,text,text,text,text)
        TO pc_staff_runtime;
    END IF;
  END IF;

  -- The privileged columns of public.users are withheld at the grant level,
  -- which --no-acl also discarded.
  REVOKE UPDATE ON public.users FROM PUBLIC;
  FOREACH target IN ARRAY ARRAY['one_deal_auth', 'one_deal_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target) THEN
      EXECUTE format('REVOKE UPDATE ON public.users FROM %I', target);
      EXECUTE format(
        'GRANT UPDATE ("email", "phone", "fullName", "updatedAt") ON public.users TO %I', target);
    END IF;
  END LOOP;
END;
$identity_recovery$;
SQL

RESTORE_IDENTITY_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname IN ('users','user_orgs','organizations')
     AND c.relrowsecurity AND c.relforcerowsecurity)::text
  || ':' ||
  (SELECT count(*) FROM pg_proc p JOIN pg_roles owner ON owner.oid = p.proowner
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'auth'
     AND p.proname IN (
       'resolve_login_identity', 'resolve_login_identity_by_id',
       'resolve_login_memberships', 'resolve_login_memberships_ordered',
       'resolve_login_context_by_email', 'resolve_login_context_by_membership',
       'resolve_session_identity', 'validate_deal_creation_actors')
     AND owner.rolname = 'pc_identity_bootstrap')::text
  || ':' ||
  (SELECT count(*) FROM pg_roles WHERE rolname = 'one_deal_auth' AND rolbypassrls)::text
  || ':' ||
  has_function_privilege('one_deal_auth', 'auth.resolve_login_identity(text)', 'EXECUTE')::int::text
  || ':' ||
  has_function_privilege('one_deal_app', 'auth.validate_deal_creation_actors(text,text,text,text,text)', 'EXECUTE')::int::text
  || ':' ||
  has_function_privilege('one_deal_auth', 'auth.validate_deal_creation_actors(text,text,text,text,text)', 'EXECUTE')::int::text;
SQL
)"
echo "[dr] restored identity proof forced-rls:bootstrap-owned:auth-bypassrls:bootstrap-execute:deal-actor-execute:auth-actor-execute = $RESTORE_IDENTITY_PROOF"
if [[ "$RESTORE_IDENTITY_PROOF" != "3:8:0:1:1:0" ]]; then
  echo "Restored identity boundary is invalid: $RESTORE_IDENTITY_PROOF" >&2
  exit 1
fi

RESTORE_AUTH_ISOLATION="$(psql "$RESTORE_AUTH_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM public.users)::text || ':' || (SELECT count(*) FROM public.organizations)::text")"
echo "[dr] restored auth principal without context users:orgs = $RESTORE_AUTH_ISOLATION"
if [[ "$RESTORE_AUTH_ISOLATION" != "0:0" ]]; then
  echo "Restored auth principal reads identities without context: $RESTORE_AUTH_ISOLATION" >&2
  exit 1
fi

RESTORE_APP_ROLE_PROOF="$(psql "$RESTORE_APP_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT has_schema_privilege(current_user,'settlement','USAGE')::text || ':' || has_table_privilege(current_user,'settlement.payments','SELECT')::text || ':' || has_table_privilege(current_user,'settlement.payments','UPDATE')::text || ':' || has_table_privilege(current_user,'settlement.ledger_entries','DELETE')::text || ':' || has_function_privilege(current_user,'auth.validate_deal_creation_actors(text,text,text,text,text)','EXECUTE')::text")"
echo "[dr] restored settlement/deal principal proof usage:select:update:ledger-delete:actor-execute = $RESTORE_APP_ROLE_PROOF"
if [[ "$RESTORE_APP_ROLE_PROOF" != "true:true:true:false:true" && "$RESTORE_APP_ROLE_PROOF" != "t:t:t:f:t" ]]; then
  echo "Restored application Settlement/deal privilege boundary is invalid: $RESTORE_APP_ROLE_PROOF" >&2
  exit 1
fi

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

PUBLIC_RLS_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FILTER (WHERE c.relrowsecurity)::text || ':' || count(*) FILTER (WHERE c.relforcerowsecurity)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')")"
if [[ "$PUBLIC_RLS_PROOF" != "8:8" ]]; then
  echo "Restored public RLS proof failed: $PUBLIC_RLS_PROOF" >&2
  exit 1
fi
SETTLEMENT_RLS_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FILTER (WHERE c.relrowsecurity)::text || ':' || count(*) FILTER (WHERE c.relforcerowsecurity)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='settlement' AND c.relname IN ('payment_terms','beneficiaries','payments','holds','bank_operations','bank_callbacks','ledger_entries','reconciliation_facts')")"
if [[ "$SETTLEMENT_RLS_PROOF" != "8:8" ]]; then
  echo "Restored Settlement RLS proof failed: $SETTLEMENT_RLS_PROOF" >&2
  exit 1
fi
SETTLEMENT_OUTBOX_PROOF="$(psql "$RESTORE_ADMIN_URL" -X -At --set ON_ERROR_STOP=1 -c "SELECT count(*) FILTER (WHERE left(type,5)='BANK_')::text || ':' || count(*) FILTER (WHERE left(type,5)='BANK_' AND status='CONFIRMED')::text || ':' || count(*) FILTER (WHERE type='settlement.command.receipt')::text || ':' || count(*) FILTER (WHERE type='settlement.command.receipt' AND status='CONFIRMED')::text FROM public.outbox_entries WHERE \"dealId\"='DEAL-INDUSTRIAL-001' AND (left(type,5)='BANK_' OR type='settlement.command.receipt')")"
echo "[dr] restored Settlement outbox proof bank:confirmed:receipts:confirmed = $SETTLEMENT_OUTBOX_PROOF"
if [[ "$SETTLEMENT_OUTBOX_PROOF" != "2:2:4:4" ]]; then
  echo "Restored Settlement durable outbox proof failed: $SETTLEMENT_OUTBOX_PROOF" >&2
  exit 1
fi

NODE_ENV=test \
DATABASE_URL="$RESTORE_APP_URL" \
AUTH_DATABASE_URL="$RESTORE_AUTH_URL" \
STORAGE_DATABASE_URL="$RESTORE_STORAGE_URL" \
DB_PRINCIPAL_BOUNDARY_ENFORCED=true \
JWT_SECRET="${JWT_SECRET:?JWT_SECRET is required}" \
AUTH_TOKEN_PEPPER="${AUTH_TOKEN_PEPPER:?AUTH_TOKEN_PEPPER is required}" \
MFA_ENCRYPTION_KEY="${MFA_ENCRYPTION_KEY:?MFA_ENCRYPTION_KEY is required}" \
pnpm --filter @pc/api exec ts-node test/one-deal/restored-database-acceptance.ts

export SOURCE_FINGERPRINT RESTORE_FINGERPRINT BACKUP_SHA256 BACKUP_BYTES
export BACKUP_STARTED_AT BACKUP_COMPLETED_AT BACKUP_SECONDS
export RESTORE_STARTED_AT RESTORE_COMPLETED_AT RESTORE_SECONDS
export PUBLIC_RLS_PROOF SETTLEMENT_RLS_PROOF RESTORE_APP_ROLE_PROOF SETTLEMENT_OUTBOX_PROOF

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
  publicRlsProof: process.env.PUBLIC_RLS_PROOF,
  settlementRlsProof: process.env.SETTLEMENT_RLS_PROOF,
  settlementPrincipalProof: process.env.RESTORE_APP_ROLE_PROOF,
  settlementOutboxProof: process.env.SETTLEMENT_OUTBOX_PROOF,
  failedMigrations: 0,
};
fs.writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

cat "$MANIFEST_PATH"
echo "[dr] backup/restore rehearsal passed without weakening RLS"

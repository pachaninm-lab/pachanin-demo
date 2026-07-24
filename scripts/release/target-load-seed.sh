#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${NAMESPACE:-grainflow-acceptance}"
EVIDENCE_DIR="${EVIDENCE_DIR:-artifacts/industrial-readiness/load}"
BUYER_SESSIONS="${TARGET_LOAD_BUYER_SESSIONS:-5000}"
COMPLIANCE_SESSIONS="${TARGET_LOAD_COMPLIANCE_SESSIONS:-100}"
DEAL_COUNT="${TARGET_LOAD_DEALS:-50000}"
EVENT_COUNT="${TARGET_LOAD_EVENTS:-10000000}"
BANK_OPERATION_COUNT="${TARGET_LOAD_BANK_OPERATIONS:-1000}"
EVENT_BATCH_SIZE="${TARGET_LOAD_EVENT_BATCH_SIZE:-250000}"
AUCTION_END_DELAY_SECONDS="${TARGET_LOAD_AUCTION_END_DELAY_SECONDS:-3600}"

mkdir -p "$EVIDENCE_DIR"
started_epoch="$(date +%s)"

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  POSTGRES_PASSWORD="$(
    kubectl get secret grainflow-postgresql-secrets -n "$NAMESPACE" \
      -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 --decode
  )"
fi
[[ -n "$POSTGRES_PASSWORD" ]] || { echo "POSTGRES_PASSWORD could not be resolved" >&2; exit 2; }

for value in \
  "$BUYER_SESSIONS" "$COMPLIANCE_SESSIONS" "$DEAL_COUNT" \
  "$EVENT_COUNT" "$BANK_OPERATION_COUNT" "$EVENT_BATCH_SIZE" "$AUCTION_END_DELAY_SECONDS"; do
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || { echo "Target-load counts must be positive integers" >&2; exit 2; }
done

psql_admin() {
  kubectl exec -i -n "$NAMESPACE" statefulset/postgresql -- \
    env PGPASSWORD="$POSTGRES_PASSWORD" psql -X -v ON_ERROR_STOP=1 -U postgres -d grainflow "$@"
}

echo "[target-load] seeding identities, sessions, Deals, settlement and auction fixtures"
psql_admin \
  -v buyer_count="$BUYER_SESSIONS" \
  -v compliance_count="$COMPLIANCE_SESSIONS" \
  -v deal_count="$DEAL_COUNT" \
  -v bank_count="$BANK_OPERATION_COUNT" \
  -v auction_end_delay="$AUCTION_END_DELAY_SECONDS" <<'SQL'
SET synchronous_commit = off;
SET statement_timeout = 0;
SET lock_timeout = '30s';

INSERT INTO public.organizations (
  id, inn, name, type, status, "tenantId", "kycStatus", "amlStatus", "sanctionHit", "updatedAt"
) VALUES
  ('load-seller-org', '7700000001', 'Load Proof Seller', 'LEGAL', 'VERIFIED', 'load-tenant', 'APPROVED', 'CLEAR', false, now()),
  ('load-compliance-org', '7700000002', 'Load Proof Compliance', 'LEGAL', 'VERIFIED', 'load-tenant', 'APPROVED', 'CLEAR', false, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (
  id, inn, name, type, status, "tenantId", "kycStatus", "amlStatus", "sanctionHit", "updatedAt"
)
SELECT
  'load-buyer-org-' || lpad(g::text, 5, '0'),
  '78' || lpad(g::text, 8, '0'),
  'Load Proof Buyer ' || g,
  'LEGAL', 'VERIFIED', 'load-tenant', 'APPROVED', 'CLEAR', false, now()
FROM generate_series(1, :'buyer_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (
  id, email, "passwordHash", "fullName", status, "mfaEnabled", "updatedAt"
) VALUES (
  'load-farmer-user-001', 'load-farmer-001@example.invalid', 'load-proof-no-login',
  'Load Proof Farmer', 'ACTIVE', false, now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, "passwordHash", "fullName", status, "mfaEnabled", "updatedAt")
SELECT
  'load-buyer-user-' || lpad(g::text, 5, '0'),
  'load-buyer-' || lpad(g::text, 5, '0') || '@example.invalid',
  'load-proof-no-login',
  'Load Proof Buyer ' || g,
  'ACTIVE', true, now()
FROM generate_series(1, :'buyer_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, "passwordHash", "fullName", status, "mfaEnabled", "updatedAt")
SELECT
  'load-compliance-user-' || lpad(g::text, 3, '0'),
  'load-compliance-' || lpad(g::text, 3, '0') || '@example.invalid',
  'load-proof-no-login',
  'Load Proof Compliance ' || g,
  'ACTIVE', true, now()
FROM generate_series(1, :'compliance_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_orgs (id, "userId", "organizationId", role, "isDefault")
VALUES (
  'load-farmer-membership-001', 'load-farmer-user-001', 'load-seller-org', 'FARMER', true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_orgs (id, "userId", "organizationId", role, "isDefault")
SELECT
  'load-buyer-membership-' || lpad(g::text, 5, '0'),
  'load-buyer-user-' || lpad(g::text, 5, '0'),
  'load-buyer-org-' || lpad(g::text, 5, '0'),
  'BUYER', true
FROM generate_series(1, :'buyer_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_orgs (id, "userId", "organizationId", role, "isDefault")
SELECT
  'load-compliance-membership-' || lpad(g::text, 3, '0'),
  'load-compliance-user-' || lpad(g::text, 3, '0'),
  'load-compliance-org',
  'COMPLIANCE_OFFICER', true
FROM generate_series(1, :'compliance_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.credential_states (user_id, credential_version, mfa_enabled, consent_version, consent_at)
SELECT id, 1, "mfaEnabled", 'load-proof-v1', now()
FROM public.users
WHERE id LIKE 'load-%-user-%'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO auth.sessions (
  id, user_id, membership_id, organization_id, tenant_id, status,
  refresh_family_id, credential_version, mfa_level, mfa_verified_at,
  expires_at, last_seen_at
)
SELECT
  'load-buyer-session-' || lpad(g::text, 5, '0'),
  'load-buyer-user-' || lpad(g::text, 5, '0'),
  'load-buyer-membership-' || lpad(g::text, 5, '0'),
  'load-buyer-org-' || lpad(g::text, 5, '0'),
  'load-tenant', 'ACTIVE',
  'load-buyer-family-' || lpad(g::text, 5, '0'), 1, 'TOTP', now(),
  now() + interval '8 hours', now() - interval '2 hours'
FROM generate_series(1, :'buyer_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.sessions (
  id, user_id, membership_id, organization_id, tenant_id, status,
  refresh_family_id, credential_version, mfa_level, mfa_verified_at,
  expires_at, last_seen_at
)
SELECT
  'load-compliance-session-' || lpad(g::text, 3, '0'),
  'load-compliance-user-' || lpad(g::text, 3, '0'),
  'load-compliance-membership-' || lpad(g::text, 3, '0'),
  'load-compliance-org', 'load-tenant', 'ACTIVE',
  'load-compliance-family-' || lpad(g::text, 3, '0'), 1, 'TOTP', now(),
  now() + interval '8 hours', now() - interval '2 hours'
FROM generate_series(1, :'compliance_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.sessions (
  id, user_id, membership_id, organization_id, tenant_id, status,
  refresh_family_id, credential_version, mfa_level, expires_at, last_seen_at
) VALUES (
  'load-farmer-session-001', 'load-farmer-user-001', 'load-farmer-membership-001',
  'load-seller-org', 'load-tenant', 'ACTIVE', 'load-farmer-family-001', 1,
  'NONE', now() + interval '8 hours', now() - interval '2 hours'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deals (
  id, "dealNumber", status, "tenantId", "sellerOrgId", "buyerOrgId",
  "totalKopecks", "pricePerTonDec", "volumeTonsDec", currency,
  culture, "cropClass", region, "nextAction", "sagaState", version, "updatedAt"
)
SELECT
  'load-deal-' || lpad(g::text, 6, '0'),
  'LOAD-' || lpad(g::text, 8, '0'),
  'DRAFT', 'load-tenant', 'load-seller-org',
  'load-buyer-org-' || lpad((((g - 1) % :'buyer_count'::integer) + 1)::text, 5, '0'),
  100000000::bigint, 1000000::numeric, 100::numeric, 'RUB',
  'Пшеница', '4', 'Load Region', 'Подтвердить допуск участников', '{}'::jsonb, 0, now()
FROM generate_series(1, :'deal_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deal_participants (
  id, "dealId", "tenantId", "organizationId", "userId", role,
  "accessLevel", status, "assignedByUserId"
)
SELECT
  'load-buyer-participant-' || lpad(g::text, 6, '0'),
  'load-deal-' || lpad(g::text, 6, '0'), 'load-tenant',
  'load-buyer-org-' || lpad((((g - 1) % :'buyer_count'::integer) + 1)::text, 5, '0'),
  'load-buyer-user-' || lpad((((g - 1) % :'buyer_count'::integer) + 1)::text, 5, '0'),
  'BUYER', 'WORK', 'ACTIVE', 'load-farmer-user-001'
FROM generate_series(1, :'deal_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deal_participants (
  id, "dealId", "tenantId", "organizationId", "userId", role,
  "accessLevel", status, "assignedByUserId"
)
SELECT
  'load-compliance-participant-' || lpad(g::text, 6, '0'),
  'load-deal-' || lpad(g::text, 6, '0'), 'load-tenant', 'load-compliance-org',
  'load-compliance-user-' || lpad((((g - 1) % :'compliance_count'::integer) + 1)::text, 3, '0'),
  'COMPLIANCE_OFFICER', 'APPROVE', 'ACTIVE', 'load-farmer-user-001'
FROM generate_series(1, :'deal_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

-- Independent settlement fixtures for duplicate callback storms.
INSERT INTO public.deals (
  id, "dealNumber", status, "tenantId", "sellerOrgId", "buyerOrgId",
  "totalKopecks", currency, "nextAction", "sagaState", version, "updatedAt"
)
SELECT
  'load-bank-deal-' || lpad(g::text, 5, '0'),
  'LOAD-BANK-' || lpad(g::text, 6, '0'),
  'RESERVE_REQUESTED', 'load-tenant', 'load-seller-org',
  'load-buyer-org-' || lpad((((g - 1) % :'buyer_count'::integer) + 1)::text, 5, '0'),
  1000000::bigint, 'RUB', 'Ожидается подтверждение резерва банка', '{}'::jsonb, 6, now()
FROM generate_series(1, :'bank_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO settlement.payment_terms (
  id, tenant_id, deal_id, version, currency, reserve_amount_minor,
  release_basis, status, command_id, idempotency_key, request_fingerprint,
  created_by_user_id, created_by_org_id
)
SELECT
  'load-bank-terms-' || lpad(g::text, 5, '0'), 'load-tenant',
  'load-bank-deal-' || lpad(g::text, 5, '0'), 1, 'RUB', 1000000,
  '{}'::jsonb, 'ISSUED', 'load-bank-terms-command-' || g,
  'load-bank-terms-idem-' || g, repeat('a', 64),
  'load-buyer-user-' || lpad((((g - 1) % :'buyer_count'::integer) + 1)::text, 5, '0'),
  'load-buyer-org-' || lpad((((g - 1) % :'buyer_count'::integer) + 1)::text, 5, '0')
FROM generate_series(1, :'bank_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO settlement.payments (
  id, tenant_id, deal_id, payment_terms_id, status, currency,
  pending_reserved_minor, version
)
SELECT
  'load-bank-payment-' || lpad(g::text, 5, '0'), 'load-tenant',
  'load-bank-deal-' || lpad(g::text, 5, '0'),
  'load-bank-terms-' || lpad(g::text, 5, '0'),
  'RESERVE_PENDING', 'RUB', 1000000, 0
FROM generate_series(1, :'bank_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO settlement.bank_operations (
  id, tenant_id, deal_id, payment_id, payment_terms_id, operation_type,
  status, amount_minor, currency, required_partner_id, request_fingerprint,
  command_id, idempotency_key, expected_payment_version, request_payload,
  initiated_by_user_id
)
SELECT
  'load-bank-operation-' || lpad(g::text, 5, '0'), 'load-tenant',
  'load-bank-deal-' || lpad(g::text, 5, '0'),
  'load-bank-payment-' || lpad(g::text, 5, '0'),
  'load-bank-terms-' || lpad(g::text, 5, '0'),
  'RESERVE', 'PENDING', 1000000, 'RUB', 'safe-deals', repeat('b', 64),
  'load-bank-command-' || g, 'load-bank-operation-idem-' || g, 0,
  jsonb_build_object('source', 'target-load-acceptance'),
  'load-buyer-user-' || lpad((((g - 1) % :'buyer_count'::integer) + 1)::text, 5, '0')
FROM generate_series(1, :'bank_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO auction.lots (
  id, tenant_id, seller_org_id, seller_user_id, title, culture, grade,
  volume_tons, start_price_rub_per_ton, step_price_rub_per_ton,
  start_price_kopecks_per_ton, step_price_kopecks_per_ton,
  region, address, status, auction_ends_at, source_type,
  source_external_id, source_verified_at, admission_status,
  auto_extend_enabled, auto_extend_window_minutes, auto_extend_minutes, version
) VALUES (
  'load-hot-lot', 'load-tenant', 'load-seller-org', 'load-farmer-user-001',
  'Target load hot lot', 'Пшеница', '4', 1000000,
  10000, 1, 1000000, 100,
  'Load Region', 'Load address', 'BIDDING',
  now() + (:'auction_end_delay'::integer * interval '1 second'),
  'ERP', 'load-hot-lot-source', now(), 'ADMITTED', false, 0, 0, 1
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auction.admissions (
  id, tenant_id, lot_id, participant_org_id, participant_user_id,
  participant_role, status, valid_until, reason, decided_by_actor_id
)
SELECT
  'load-hot-admission-' || lpad(g::text, 5, '0'), 'load-tenant', 'load-hot-lot',
  'load-buyer-org-' || lpad(g::text, 5, '0'),
  'load-buyer-user-' || lpad(g::text, 5, '0'),
  'BUYER', 'ADMITTED', now() + interval '8 hours',
  'Target-load verified admission', 'load-compliance-user-001'
FROM generate_series(1, :'buyer_count'::integer) AS g
ON CONFLICT (id) DO NOTHING;
SQL

echo "[target-load] seeding $EVENT_COUNT persisted domain events in batches of $EVENT_BATCH_SIZE"
event_start=1
while (( event_start <= EVENT_COUNT )); do
  event_end=$((event_start + EVENT_BATCH_SIZE - 1))
  (( event_end > EVENT_COUNT )) && event_end="$EVENT_COUNT"
  psql_admin \
    -v event_start="$event_start" \
    -v event_end="$event_end" \
    -v deal_count="$DEAL_COUNT" \
    -v buyer_count="$BUYER_SESSIONS" <<'SQL'
SET synchronous_commit = off;
SET statement_timeout = 0;
INSERT INTO public.deal_events (
  id, "dealId", "eventType", "actorId", "actorRole", "tenantId",
  payload, hash, "prevHash", "createdAt"
)
SELECT
  'load-domain-event-' || lpad(g::text, 10, '0'),
  'load-deal-' || lpad((((g - 1) % :'deal_count'::integer) + 1)::text, 6, '0'),
  'LOAD_BASELINE',
  'load-buyer-user-' || lpad((((g - 1) % :'buyer_count'::integer) + 1)::text, 5, '0'),
  'BUYER', 'load-tenant', '{}'::jsonb, md5(g::text), NULL,
  now() - ((:'event_end'::bigint - g) * interval '1 millisecond')
FROM generate_series(:'event_start'::bigint, :'event_end'::bigint) AS g
ON CONFLICT (id) DO NOTHING;
SQL
  printf '[target-load] domain events: %s/%s\n' "$event_end" "$EVENT_COUNT"
  event_start=$((event_end + 1))
done

echo "[target-load] analyzing seeded relations"
psql_admin <<'SQL'
ANALYZE public.organizations;
ANALYZE public.users;
ANALYZE public.user_orgs;
ANALYZE auth.sessions;
ANALYZE public.deals;
ANALYZE public.deal_participants;
ANALYZE public.deal_events;
ANALYZE settlement.payments;
ANALYZE settlement.bank_operations;
ANALYZE auction.lots;
ANALYZE auction.admissions;
SQL

completed_epoch="$(date +%s)"
jq -n \
  --argjson buyers "$BUYER_SESSIONS" \
  --argjson compliance "$COMPLIANCE_SESSIONS" \
  --argjson deals "$DEAL_COUNT" \
  --argjson events "$EVENT_COUNT" \
  --argjson bankOperations "$BANK_OPERATION_COUNT" \
  --argjson seconds "$((completed_epoch - started_epoch))" \
  '{schemaVersion:1,buyerSessions:$buyers,complianceSessions:$compliance,deals:$deals,domainEvents:$events,bankOperations:$bankOperations,seedSeconds:$seconds}' \
  > "$EVIDENCE_DIR/seed-summary.json"

cat "$EVIDENCE_DIR/seed-summary.json"

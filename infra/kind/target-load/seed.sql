\set ON_ERROR_STOP on
\echo 'Seeding target-load identities, Deals, events, auction and callback operations'

SET synchronous_commit = off;
SET maintenance_work_mem = '512MB';
SET work_mem = '64MB';

BEGIN;

INSERT INTO public.organizations (
  id, inn, name, type, status, "tenantId", "verifiedAt", "kycStatus", "amlStatus", "sanctionHit", "createdAt", "updatedAt"
)
SELECT
  'org-load-' || lpad(i::text, 6, '0'),
  '88' || lpad(i::text, 10, '0'),
  'Load Organization ' || i,
  'LEGAL',
  'VERIFIED',
  CASE WHEN i > (:session_count - :isolated_count)
    THEN 'tenant-isolated-' || lpad((i - (:session_count - :isolated_count))::text, 4, '0')
    ELSE 'tenant-canonical-test'
  END,
  now(),
  'APPROVED',
  'CLEAR',
  false,
  now(),
  now()
FROM generate_series(1, :session_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (
  id, email, "passwordHash", "fullName", status, "mfaEnabled", "createdAt", "updatedAt"
)
SELECT
  'user-load-' || lpad(i::text, 6, '0'),
  'load-' || lpad(i::text, 6, '0') || '@acceptance.invalid',
  '$2b$12$IndustrialLoadIdentityIsNotLoginCapable000000000000000000000',
  'Load Actor ' || i,
  'ACTIVE',
  true,
  now(),
  now()
FROM generate_series(1, :session_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_orgs (
  id, "userId", "organizationId", role, "isDefault", "joinedAt"
)
SELECT
  'membership-load-' || lpad(i::text, 6, '0'),
  'user-load-' || lpad(i::text, 6, '0'),
  'org-load-' || lpad(i::text, 6, '0'),
  CASE
    WHEN i <= :buyer_count THEN 'BUYER'
    WHEN i > (:session_count - :isolated_count) THEN 'BUYER'
    ELSE 'COMPLIANCE_OFFICER'
  END,
  true,
  now()
FROM generate_series(1, :session_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.credential_states (
  user_id, credential_version, failed_login_count, mfa_enabled, consent_version, consent_at, created_at, updated_at
)
SELECT
  'user-load-' || lpad(i::text, 6, '0'),
  1,
  0,
  true,
  '1.2',
  now(),
  now(),
  now()
FROM generate_series(1, :session_count) AS g(i)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO auth.sessions (
  id, user_id, membership_id, organization_id, tenant_id, status,
  refresh_family_id, credential_version, mfa_level, mfa_verified_at,
  mfa_verified_method, user_agent_hash, ip_hash, last_seen_at, expires_at,
  created_at, updated_at
)
SELECT
  'session-load-' || lpad(i::text, 6, '0'),
  'user-load-' || lpad(i::text, 6, '0'),
  'membership-load-' || lpad(i::text, 6, '0'),
  'org-load-' || lpad(i::text, 6, '0'),
  CASE WHEN i > (:session_count - :isolated_count)
    THEN 'tenant-isolated-' || lpad((i - (:session_count - :isolated_count))::text, 4, '0')
    ELSE 'tenant-canonical-test'
  END,
  'ACTIVE',
  'family-load-' || lpad(i::text, 6, '0'),
  1,
  'TOTP',
  now(),
  'TOTP',
  md5('load-agent-' || i::text),
  md5('load-ip-' || i::text),
  now(),
  now() + interval '6 hours',
  now(),
  now()
FROM generate_series(1, :session_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deal_participants (
  id, "dealId", "tenantId", "organizationId", "userId", role,
  "accessLevel", status, "assignedAt"
)
SELECT
  'participant-load-canonical-' || lpad(i::text, 6, '0'),
  'DEAL-INDUSTRIAL-001',
  'tenant-canonical-test',
  'org-load-' || lpad(i::text, 6, '0'),
  'user-load-' || lpad(i::text, 6, '0'),
  CASE WHEN i <= :buyer_count THEN 'BUYER' ELSE 'COMPLIANCE_OFFICER' END,
  CASE WHEN i <= :buyer_count THEN 'WORK' ELSE 'APPROVE' END,
  'ACTIVE',
  now()
FROM generate_series(1, (:session_count - :isolated_count)) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deals (
  id, status, "tenantId", "sellerOrgId", "buyerOrgId",
  "volumeTonsDec", "pricePerTonDec", "totalKopecks", version,
  currency, culture, region, "nextAction", "createdAt", "updatedAt"
)
SELECT
  'DEAL-LOAD-' || lpad(i::text, 6, '0'),
  'DRAFT',
  'tenant-canonical-test',
  'org-canonical-seller',
  'org-load-' || lpad((((i - 1) % :buyer_count) + 1)::text, 6, '0'),
  100.000000,
  12000.000000,
  120000000,
  0,
  'RUB',
  'WHEAT',
  'LOAD-REGION',
  'approve_admission',
  :'deal_updated_at'::timestamptz,
  :'deal_updated_at'::timestamptz
FROM generate_series(1, :deal_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deal_participants (
  id, "dealId", "tenantId", "organizationId", "userId", role,
  "accessLevel", status, "assignedAt"
)
SELECT
  'participant-load-command-' || lpad(i::text, 6, '0'),
  'DEAL-LOAD-' || lpad(i::text, 6, '0'),
  'tenant-canonical-test',
  'org-load-' || lpad((:buyer_count + 1 + ((i - 1) % :compliance_count))::text, 6, '0'),
  'user-load-' || lpad((:buyer_count + 1 + ((i - 1) % :compliance_count))::text, 6, '0'),
  'COMPLIANCE_OFFICER',
  'APPROVE',
  'ACTIVE',
  now()
FROM generate_series(1, :deal_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

DELETE FROM auction.admissions WHERE tenant_id = 'tenant-canonical-test' AND lot_id = 'lot-load-hot';
DELETE FROM auction.bids WHERE tenant_id = 'tenant-canonical-test' AND lot_id = 'lot-load-hot';
DELETE FROM auction.lots WHERE tenant_id = 'tenant-canonical-test' AND id = 'lot-load-hot';

INSERT INTO auction.lots (
  id, tenant_id, seller_org_id, seller_user_id, title, culture, grade,
  volume_tons, start_price_rub_per_ton, step_price_rub_per_ton,
  start_price_kopecks_per_ton, step_price_kopecks_per_ton,
  region, address, status, auction_ends_at, source_type,
  source_external_id, source_certificate_id, source_verified_at,
  admission_status, auto_extend_enabled, auto_extend_window_minutes,
  auto_extend_minutes, version, created_at, updated_at
) VALUES (
  'lot-load-hot', 'tenant-canonical-test', 'org-canonical-seller', 'farmer-e2e',
  'Industrial hot-lot acceptance', 'WHEAT', '3', 1000000.000000,
  12000, 100, 1200000, 10000, 'LOAD-REGION', 'LOAD-ADDRESS',
  'BIDDING', now() + interval '4 hours', 'MANUAL_VERIFIED',
  'load-source-hot-lot', 'load-certificate-hot-lot', now(), 'ADMITTED',
  false, 0, 0, 1, now(), now()
);

INSERT INTO auction.admissions (
  id, tenant_id, lot_id, participant_org_id, participant_user_id,
  participant_role, status, valid_until, reason, decided_by_actor_id,
  version, created_at, updated_at
)
SELECT
  'admission-load-' || lpad(i::text, 6, '0'),
  'tenant-canonical-test',
  'lot-load-hot',
  'org-load-' || lpad(i::text, 6, '0'),
  'user-load-' || lpad(i::text, 6, '0'),
  'BUYER', 'ADMITTED', now() + interval '4 hours',
  'Industrial target-load acceptance', 'compliance-e2e', 1, now(), now()
FROM generate_series(1, :buyer_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

COMMIT;

\echo 'Seeding callback-authoritative payment operations'
BEGIN;
INSERT INTO settlement.payment_terms (
  id, tenant_id, deal_id, version, currency, reserve_amount_minor,
  release_basis, status, command_id, idempotency_key, request_fingerprint,
  created_by_user_id, created_by_org_id, created_at
)
SELECT
  'terms-load-' || lpad(i::text, 6, '0'),
  'tenant-canonical-test',
  'DEAL-LOAD-' || lpad(i::text, 6, '0'),
  1, 'RUB', 100000,
  '{}'::jsonb, 'ACTIVE',
  'terms-command-load-' || lpad(i::text, 6, '0'),
  'terms-idem-load-' || lpad(i::text, 6, '0'),
  md5('terms-load-' || i::text) || md5('terms-load-b-' || i::text),
  'user-load-' || lpad((:buyer_count + 1 + ((i - 1) % :compliance_count))::text, 6, '0'),
  'org-load-' || lpad((:buyer_count + 1 + ((i - 1) % :compliance_count))::text, 6, '0'),
  now()
FROM generate_series(1, :callback_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO settlement.payments (
  id, tenant_id, deal_id, payment_terms_id, status, currency,
  confirmed_reserved_minor, pending_reserved_minor,
  confirmed_released_minor, pending_released_minor,
  confirmed_refunded_minor, pending_refunded_minor,
  active_hold_minor, reconciliation_status, version, created_at, updated_at
)
SELECT
  'payment-load-' || lpad(i::text, 6, '0'),
  'tenant-canonical-test',
  'DEAL-LOAD-' || lpad(i::text, 6, '0'),
  'terms-load-' || lpad(i::text, 6, '0'),
  'RESERVE_PENDING', 'RUB',
  0, 100000, 0, 0, 0, 0, 0, 'UNRECONCILED', 0, now(), now()
FROM generate_series(1, :callback_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO settlement.bank_operations (
  id, tenant_id, deal_id, payment_id, payment_terms_id, operation_type,
  status, amount_minor, currency, required_partner_id, request_fingerprint,
  command_id, idempotency_key, expected_payment_version, request_payload,
  initiated_by_user_id, created_at
)
SELECT
  'operation-load-' || lpad(i::text, 6, '0'),
  'tenant-canonical-test',
  'DEAL-LOAD-' || lpad(i::text, 6, '0'),
  'payment-load-' || lpad(i::text, 6, '0'),
  'terms-load-' || lpad(i::text, 6, '0'),
  'RESERVE', 'PENDING', 100000, 'RUB', 'safe-deals',
  md5('operation-load-' || i::text) || md5('operation-load-b-' || i::text),
  'operation-command-load-' || lpad(i::text, 6, '0'),
  'operation-idem-load-' || lpad(i::text, 6, '0'),
  0,
  jsonb_build_object('operation', 'RESERVE', 'amountMinor', '100000'),
  'user-load-' || lpad((:buyer_count + 1 + ((i - 1) % :compliance_count))::text, 6, '0'),
  now()
FROM generate_series(1, :callback_count) AS g(i)
ON CONFLICT (id) DO NOTHING;
COMMIT;

\echo 'Seeding 10,000,000 domain/audit/outbox events'
INSERT INTO public.deal_events (
  id, "dealId", "eventType", "actorId", "actorRole", "tenantId",
  payload, hash, "prevHash", "createdAt"
)
SELECT
  'load-deal-event-' || lpad(i::text, 8, '0'),
  'DEAL-LOAD-' || lpad((((i - 1) % :deal_count) + 1)::text, 6, '0'),
  'LOAD_ACCEPTANCE_EVENT',
  'user-load-' || lpad((:buyer_count + 1 + ((i - 1) % :compliance_count))::text, 6, '0'),
  'COMPLIANCE_OFFICER',
  'tenant-canonical-test',
  jsonb_build_object('sequence', i, 'source', 'target-load'),
  md5('deal-event-a-' || i::text) || md5('deal-event-b-' || i::text),
  NULL,
  now() - ((:domain_event_count - i)::text || ' milliseconds')::interval
FROM generate_series(1, :domain_event_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_events (
  id, action, "actorUserId", "actorRole", "tenantId", "orgId", "dealId",
  "objectType", "objectId", "afterState", outcome, metadata,
  "correlationId", hash, "prevHash", "createdAt"
)
SELECT
  'load-audit-event-' || lpad(i::text, 8, '0'),
  'load.acceptance.event',
  'user-load-' || lpad((:buyer_count + 1 + ((i - 1) % :compliance_count))::text, 6, '0'),
  'COMPLIANCE_OFFICER',
  'tenant-canonical-test',
  'org-load-' || lpad((:buyer_count + 1 + ((i - 1) % :compliance_count))::text, 6, '0'),
  'DEAL-LOAD-' || lpad((((i - 1) % :deal_count) + 1)::text, 6, '0'),
  'DEAL',
  'DEAL-LOAD-' || lpad((((i - 1) % :deal_count) + 1)::text, 6, '0'),
  jsonb_build_object('sequence', i),
  'SUCCESS',
  jsonb_build_object('source', 'target-load'),
  'load-correlation-' || lpad(i::text, 8, '0'),
  md5('audit-event-a-' || i::text) || md5('audit-event-b-' || i::text),
  NULL,
  now() - ((:audit_event_count - i)::text || ' milliseconds')::interval
FROM generate_series(1, :audit_event_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.outbox_entries (
  id, type, "dealId", payload, status, "triggeredByUserId",
  "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
  "correlationId", "createdAt", "sentAt", "confirmedAt"
)
SELECT
  'load-outbox-event-' || lpad(i::text, 8, '0'),
  'load.acceptance.persisted',
  'DEAL-LOAD-' || lpad((((i - 1) % :deal_count) + 1)::text, 6, '0'),
  jsonb_build_object('sequence', i, 'source', 'target-load'),
  'SENT',
  'user-load-' || lpad((:buyer_count + 1 + ((i - 1) % :compliance_count))::text, 6, '0'),
  'load-outbox-idem-' || lpad(i::text, 8, '0'),
  5, 0, now(),
  'load-outbox-correlation-' || lpad(i::text, 8, '0'),
  now() - ((:outbox_event_count - i)::text || ' milliseconds')::interval,
  now(), now()
FROM generate_series(1, :outbox_event_count) AS g(i)
ON CONFLICT (id) DO NOTHING;

ANALYZE public.organizations;
ANALYZE public.users;
ANALYZE public.user_orgs;
ANALYZE auth.sessions;
ANALYZE public.deals;
ANALYZE public.deal_participants;
ANALYZE public.deal_events;
ANALYZE public.audit_events;
ANALYZE public.outbox_entries;
ANALYZE auction.lots;
ANALYZE auction.admissions;
ANALYZE settlement.payment_terms;
ANALYZE settlement.payments;
ANALYZE settlement.bank_operations;

\echo 'Target-load seed complete'

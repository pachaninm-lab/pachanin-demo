\set ON_ERROR_STOP 0
\pset pager off
\pset footer off

-- ============================================================================
-- P0.3 acceptance: seller A (tenant t-sell) and buyers B1/B2 (tenants t-buy1,
-- t-buy2) are separate organizations in separate tenants, exactly as production
-- registration creates them. Runs as a NON-superuser so RLS is enforced.
-- ============================================================================

INSERT INTO public."organizations" (id, inn, ogrn, name, type, status, "tenantId", "kycStatus", "amlStatus", "sanctionHit", "createdAt", "updatedAt")
VALUES
  ('o-sell', '7710000001', '1', 'Agro Seller LLC', 'LEGAL', 'VERIFIED', 't-sell', 'APPROVED', 'CLEAR', false, now(), now()),
  ('o-buy1', '7710000002', '2', 'Grain Buyer One', 'LEGAL', 'VERIFIED', 't-buy1', 'APPROVED', 'CLEAR', false, now(), now()),
  ('o-buy2', '7710000003', '3', 'Grain Buyer Two', 'LEGAL', 'VERIFIED', 't-buy2', 'APPROVED', 'CLEAR', false, now(), now())
ON CONFLICT DO NOTHING;

INSERT INTO public."users" (id, email, "passwordHash", "fullName", status, "createdAt", "updatedAt")
VALUES
  ('u-sell','s@t.local','x','Seller','ACTIVE',now(),now()),
  ('u-adm','a@t.local','x','Admin','ACTIVE',now(),now()),
  ('u-buy1','b1@t.local','x','Buyer1','ACTIVE',now(),now()),
  ('u-buy2','b2@t.local','x','Buyer2','ACTIVE',now(),now()),
  ('u-sbuy','sb@t.local','x','SelfBuy','ACTIVE',now(),now())
ON CONFLICT DO NOTHING;

INSERT INTO public."user_orgs" (id, "userId", "organizationId", role, "joinedAt")
VALUES
  ('m-sell','u-sell','o-sell','FARMER',now()),
  ('m-adm','u-adm','o-sell','ADMIN',now()),
  ('m-buy1','u-buy1','o-buy1','BUYER',now()),
  ('m-buy2','u-buy2','o-buy2','BUYER',now()),
  -- BUYER membership inside the SELLER organization: the self-bid path.
  ('m-sbuy','u-sbuy','o-sell','BUYER',now())
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.p (k text primary key, v text);
DELETE FROM public.p;
GRANT ALL ON public.p TO app_probe;

CREATE OR REPLACE FUNCTION public.lotv() RETURNS bigint LANGUAGE sql SECURITY DEFINER AS
$$ SELECT version FROM auction.lots WHERE id = (SELECT v FROM public.p WHERE k='lot') $$;
GRANT EXECUTE ON FUNCTION public.lotv() TO app_probe;

SET ROLE app_probe;

\echo ''
\echo '=== 1. Seller registers a verified lot in its own tenant ==='
SELECT set_config('app.current_user_id','u-sell',false), set_config('app.current_org_id','o-sell',false),
       set_config('app.current_tenant_id','t-sell',false), set_config('app.current_role','FARMER',false),
       set_config('app.current_session_id','x',false) \g /dev/null
INSERT INTO public.p SELECT 'lot', (auction.register_verified_lot(
  'Wheat 3rd class','WHEAT','3', 500.0, 1500000, 10000, 'Rostov', 'Warehouse 7, Rostov',
  now() + interval '2 hours', 'FGIS','FGIS-SDIZ-99','CERT-99', true, 10, 10, 'c-reg','i-reg') ->> 'lotId');
SELECT v AS lot_id FROM public.p WHERE k='lot';

\echo ''
\echo '=== 2. NEGATIVE: buyer B1 sees nothing and cannot bid before any grant ==='
SELECT set_config('app.current_user_id','u-buy1',false), set_config('app.current_org_id','o-buy1',false),
       set_config('app.current_tenant_id','t-buy1',false), set_config('app.current_role','BUYER',false),
       set_config('app.current_session_id','x',false) \g /dev/null
SELECT count(*) AS showcase_rows_expect_0 FROM auction.lot_showcase;
SELECT count(*) AS base_lots_expect_0 FROM auction.lots;
\echo '-- bid without grant (expect AUCTION_LOT_NOT_FOUND) --'
SELECT auction.place_bid((SELECT v FROM public.p WHERE k='lot'), 1600000, 100.0, public.lotv(), 'c-x','i-x');

\echo ''
\echo '=== 3. Seller-tenant ADMIN grants participation to B1 and B2 ==='
SELECT set_config('app.current_user_id','u-adm',false), set_config('app.current_org_id','o-sell',false),
       set_config('app.current_tenant_id','t-sell',false), set_config('app.current_role','ADMIN',false),
       set_config('app.current_session_id','x',false) \g /dev/null
SELECT auction.grant_participation((SELECT v FROM public.p WHERE k='lot'),'o-buy1',
  ARRAY['VIEW_LOT','PLACE_BID'], now()+interval '2 hours','AUTH-1','counterparty admitted',
  public.lotv(),'c-g1','i-g1') ->> 'status' AS grant_b1;
SELECT auction.grant_participation((SELECT v FROM public.p WHERE k='lot'),'o-buy2',
  ARRAY['VIEW_LOT','PLACE_BID'], now()+interval '2 hours','AUTH-2','counterparty admitted',
  public.lotv(),'c-g2','i-g2') ->> 'status' AS grant_b2;
\echo '-- NEGATIVE: grant to the seller itself (expect SELF_PARTICIPATION_DENIED) --'
SELECT auction.grant_participation((SELECT v FROM public.p WHERE k='lot'),'o-sell',
  ARRAY['VIEW_LOT','PLACE_BID'], now()+interval '2 hours','AUTH-3','self', public.lotv(),'c-g3','i-g3');

\echo ''
\echo '=== 4. Admin admits both cross-tenant buyers ==='
SELECT auction.record_admission((SELECT v FROM public.p WHERE k='lot'),'o-buy1','u-buy1','ADMITTED',
  now()+interval '2 hours','kyc ok', public.lotv(),'c-a1','i-a1') ->> 'buyerTenantId' AS b1_admitted_tenant;
SELECT auction.record_admission((SELECT v FROM public.p WHERE k='lot'),'o-buy2','u-buy2','ADMITTED',
  now()+interval '2 hours','kyc ok', public.lotv(),'c-a2','i-a2') ->> 'buyerTenantId' AS b2_admitted_tenant;

\echo ''
\echo '=== 5. Buyer B1 sees the lot through the showcase only ==='
SELECT set_config('app.current_user_id','u-buy1',false), set_config('app.current_org_id','o-buy1',false),
       set_config('app.current_tenant_id','t-buy1',false), set_config('app.current_role','BUYER',false),
       set_config('app.current_session_id','x',false) \g /dev/null
SELECT seller_org_name, culture, volume_tons, start_price_kopecks_per_ton,
       source_type, source_verified, may_place_bid, is_own_lot
FROM auction.lot_showcase;
\echo '-- base table still closed to the counterparty (expect 0) --'
SELECT count(*) AS base_lots_expect_0 FROM auction.lots;
\echo '-- withheld columns absent from the showcase contract (expect empty) --'
SELECT coalesce(string_agg(column_name, ', '), '(none)') AS withheld_columns_present
FROM information_schema.columns
WHERE table_schema='auction' AND table_name='lot_showcase'
  AND column_name IN ('source_external_id','source_certificate_id','seller_user_id','address');

\echo ''
\echo '=== 6. B1 bids, then B2 outbids ==='
SELECT auction.place_bid((SELECT v FROM public.p WHERE k='lot'),1600000,100.0,public.lotv(),'c-b1','i-b1') ->> 'bidStatus' AS b1_status;
SELECT set_config('app.current_user_id','u-buy2',false), set_config('app.current_org_id','o-buy2',false),
       set_config('app.current_tenant_id','t-buy2',false), set_config('app.current_role','BUYER',false),
       set_config('app.current_session_id','x',false) \g /dev/null
SELECT auction.place_bid((SELECT v FROM public.p WHERE k='lot'),1700000,100.0,public.lotv(),'c-b2','i-b2') ->> 'bidStatus' AS b2_status;

\echo ''
\echo '=== 7. B2 sees only its own bid, never B1s ==='
SELECT count(*) AS bids_visible_to_b2, count(*) FILTER (WHERE buyer_org_id <> 'o-buy2') AS rival_bids_expect_0
FROM auction.bids;
\echo '-- but B2 does see the leading price it must beat --'
SELECT leading_amount_kopecks_per_ton, bid_count FROM auction.lot_showcase;

\echo ''
\echo '=== 8. NEGATIVE: self-bid by a BUYER inside the SELLER organization ==='
SELECT set_config('app.current_user_id','u-sbuy',false), set_config('app.current_org_id','o-sell',false),
       set_config('app.current_tenant_id','t-sell',false), set_config('app.current_role','BUYER',false),
       set_config('app.current_session_id','x',false) \g /dev/null
SELECT auction.place_bid((SELECT v FROM public.p WHERE k='lot'),1800000,100.0,public.lotv(),'c-sb','i-sb');

\echo ''
\echo '=== 9. NEGATIVE: revocation takes effect immediately ==='
SELECT set_config('app.current_user_id','u-adm',false), set_config('app.current_org_id','o-sell',false),
       set_config('app.current_tenant_id','t-sell',false), set_config('app.current_role','ADMIN',false),
       set_config('app.current_session_id','x',false) \g /dev/null
SELECT auction.revoke_participation((SELECT v FROM public.p WHERE k='lot'),'o-buy1','compliance hold','c-rv','i-rv') ->> 'status' AS b1_grant;
SELECT set_config('app.current_user_id','u-buy1',false), set_config('app.current_org_id','o-buy1',false),
       set_config('app.current_tenant_id','t-buy1',false), set_config('app.current_role','BUYER',false),
       set_config('app.current_session_id','x',false) \g /dev/null
SELECT count(*) AS b1_showcase_after_revoke_expect_0 FROM auction.lot_showcase;
\echo '-- B1 bid after revocation (expect AUCTION_LOT_NOT_FOUND) --'
SELECT auction.place_bid((SELECT v FROM public.p WHERE k='lot'),1900000,100.0,public.lotv(),'c-b1r','i-b1r');

\echo ''
\echo '=== 10. Idempotency: replaying B2s bid returns the original receipt ==='
SELECT set_config('app.current_user_id','u-buy2',false), set_config('app.current_org_id','o-buy2',false),
       set_config('app.current_tenant_id','t-buy2',false), set_config('app.current_role','BUYER',false),
       set_config('app.current_session_id','x',false) \g /dev/null
SELECT (auction.place_bid((SELECT v FROM public.p WHERE k='lot'),1700000,100.0,
        (SELECT (result->>'lotVersion')::bigint - 1 FROM auction.command_receipts WHERE idempotency_key='i-b2'),
        'c-b2','i-b2') ->> 'duplicate') AS replay_flagged_duplicate;

\echo ''
\echo '=== 11. Close the auction: exactly one award, winner = B2 ==='
RESET ROLE;
UPDATE auction.lots SET auction_ends_at = now() - interval '1 minute'
WHERE id = (SELECT v FROM public.p WHERE k='lot');
SET ROLE app_probe;
SELECT set_config('app.current_user_id','u-sell',false), set_config('app.current_org_id','o-sell',false),
       set_config('app.current_tenant_id','t-sell',false), set_config('app.current_role','FARMER',false),
       set_config('app.current_session_id','x',false) \g /dev/null
SELECT auction.close_lot((SELECT v FROM public.p WHERE k='lot'), public.lotv(),'c-cl','i-cl')
  ->> 'lotStatus' AS lot_status;

RESET ROLE;
\echo '-- award count and winner --'
SELECT count(*) AS awards_expect_1 FROM auction.awards;
SELECT b.buyer_org_id AS winner_org, b.buyer_tenant_id AS winner_tenant, b.amount_kopecks_per_ton
FROM auction.awards a JOIN auction.bids b ON b.id = a.winning_bid_id;
\echo '-- the emitted deal basis carries both tenants --'
SELECT "requestPayload"->>'sellerOrgId' AS seller, "requestPayload"->>'sellerTenantId' AS seller_tenant,
       "requestPayload"->>'buyerOrgId' AS buyer, "requestPayload"->>'buyerTenantId' AS buyer_tenant,
       "requestPayload"->>'totalKopecks' AS total_kopecks
FROM public."integration_events" WHERE "adapterName"='auction';

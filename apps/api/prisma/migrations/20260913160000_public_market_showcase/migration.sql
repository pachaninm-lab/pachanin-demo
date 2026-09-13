BEGIN;

CREATE SCHEMA IF NOT EXISTS market;
REVOKE ALL ON SCHEMA market FROM PUBLIC;

DO $roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_market_showcase_authority'
  ) THEN
    CREATE ROLE pc_market_showcase_authority
      NOLOGIN NOINHERIT NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  ALTER ROLE pc_market_showcase_authority WITH
    NOLOGIN NOINHERIT NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles role_row ON role_row.oid = membership.roleid
    WHERE role_row.rolname = 'pc_market_showcase_authority'
  ) THEN
    RAISE EXCEPTION 'pc_market_showcase_authority must remain memberless';
  END IF;
END
$roles$;

REVOKE ALL ON SCHEMA auction FROM pc_market_showcase_authority;
GRANT USAGE ON SCHEMA auction TO pc_market_showcase_authority;
REVOKE ALL PRIVILEGES ON TABLE auction.lots FROM pc_market_showcase_authority;
GRANT SELECT (
  id,
  culture,
  grade,
  volume_tons,
  region,
  start_price_kopecks_per_ton,
  auction_ends_at,
  status,
  admission_status,
  source_external_id,
  source_verified_at,
  created_at
) ON TABLE auction.lots TO pc_market_showcase_authority;

DROP FUNCTION IF EXISTS market.list_public_lots(integer);
CREATE FUNCTION market.list_public_lots(p_limit integer DEFAULT 12)
RETURNS TABLE (
  lot_id text,
  culture text,
  grade text,
  volume_tons numeric,
  region text,
  start_price_kopecks_per_ton bigint,
  auction_ends_at timestamptz,
  verification_level text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auction
AS $function$
  SELECT
    lot.id AS lot_id,
    lot.culture,
    lot.grade,
    lot.volume_tons,
    lot.region,
    lot.start_price_kopecks_per_ton,
    lot.auction_ends_at,
    'VERIFIED'::text AS verification_level
  FROM auction.lots AS lot
  WHERE lot.status = 'BIDDING'
    AND lot.admission_status = 'ADMITTED'
    AND lot.source_verified_at IS NOT NULL
    AND NULLIF(btrim(lot.source_external_id), '') IS NOT NULL
    AND lot.start_price_kopecks_per_ton IS NOT NULL
    AND lot.auction_ends_at > statement_timestamp()
    AND char_length(lot.culture) BETWEEN 1 AND 80
    AND char_length(lot.region) BETWEEN 1 AND 120
    AND lot.culture !~ '[[:cntrl:]]'
    AND lot.region !~ '[[:cntrl:]]'
    AND (lot.grade IS NULL OR (char_length(lot.grade) <= 80 AND lot.grade !~ '[[:cntrl:]]'))
    AND lot.culture !~* '(@|https?://|www\\.|t\\.me|telegram|whatsapp|контакт|телефон|phone)'
    AND lot.region !~* '(@|https?://|www\\.|t\\.me|telegram|whatsapp|контакт|телефон|phone)'
    AND (lot.grade IS NULL OR lot.grade !~* '(@|https?://|www\\.|t\\.me|telegram|whatsapp|контакт|телефон|phone)')
    AND lot.culture !~ '[0-9]{6,}'
    AND lot.region !~ '[0-9]{6,}'
    AND (lot.grade IS NULL OR lot.grade !~ '[0-9]{6,}')
  ORDER BY lot.created_at DESC, lot.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 24)
$function$;

ALTER FUNCTION market.list_public_lots(integer) OWNER TO pc_market_showcase_authority;
REVOKE ALL ON FUNCTION market.list_public_lots(integer) FROM PUBLIC;

DO $runtime_grants$
DECLARE
  runtime_role text;
BEGIN
  FOREACH runtime_role IN ARRAY ARRAY['app_runtime', 'app_service', 'app_deal', 'one_deal_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = runtime_role) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA market TO %I', runtime_role);
      EXECUTE format('GRANT EXECUTE ON FUNCTION market.list_public_lots(integer) TO %I', runtime_role);
    END IF;
  END LOOP;
END
$runtime_grants$;

COMMENT ON FUNCTION market.list_public_lots(integer) IS
  'Bounded anonymous public market projection. Exposes no tenant, seller, address, contacts, source identifiers or certificates.';

COMMIT;

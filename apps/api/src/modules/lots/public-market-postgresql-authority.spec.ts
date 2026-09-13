import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const read = (relativePath: string) => readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
const migration = read('apps/api/prisma/migrations/20260913160000_public_market_showcase/migration.sql');
const service = read('apps/api/src/modules/lots/public-market.service.ts');
const controller = read('apps/api/src/modules/lots/lots.controller.ts');

describe('public market PostgreSQL authority', () => {
  it('uses a memberless no-login projection authority and never grants public execution', () => {
    expect(migration).toContain('CREATE ROLE pc_market_showcase_authority');
    expect(migration).toContain('NOLOGIN NOINHERIT NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE');
    expect(migration).toContain('pc_market_showcase_authority must remain memberless');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('ALTER FUNCTION market.list_public_lots(integer) OWNER TO pc_market_showcase_authority');
    expect(migration).toContain('REVOKE ALL ON FUNCTION market.list_public_lots(integer) FROM PUBLIC');
  });

  it('publishes only admitted active verified bidding lots and bounds the result set', () => {
    for (const predicate of [
      "lot.status = 'BIDDING'",
      "lot.admission_status = 'ADMITTED'",
      'lot.source_verified_at IS NOT NULL',
      "NULLIF(btrim(lot.source_external_id), '') IS NOT NULL",
      'lot.auction_ends_at > statement_timestamp()',
      'LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 24)',
    ]) expect(migration).toContain(predicate);
  });

  it('keeps canonical identifiers, identity and contact-bearing fields outside the return contract', () => {
    const returns = migration.slice(
      migration.indexOf('RETURNS TABLE ('),
      migration.indexOf('LANGUAGE sql'),
    );
    expect(returns).not.toMatch(/lot_id|\bid\b|tenant|seller|address|contact|source_external|certificate|user_id|organization/i);
    expect(returns).toContain('culture text');
    expect(returns).toContain('region text');
    expect(migration).toContain("lot.culture !~* '(@|https?://|www[.]|t[.]me|");
    expect(migration).toContain("lot.region !~* '(@|https?://|www[.]|t[.]me|");
    expect(migration).not.toMatch(/GRANT SELECT \(\s*id,/u);
  });

  it('exposes the projection through a dedicated public service rather than reviving legacy LotsService', () => {
    expect(service).toContain('FROM market.list_public_lots(12)');
    expect(service).toContain("visibility: 'ANONYMIZED'");
    expect(service).not.toContain('lotId');
    expect(service).not.toContain('LotsService');
    expect(controller).toMatch(/@Public\(\)\s+@Get\('market'\)/);
    expect(controller).toContain('return this.publicMarket.list();');
  });
});

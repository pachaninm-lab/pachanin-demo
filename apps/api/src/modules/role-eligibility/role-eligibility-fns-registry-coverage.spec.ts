import fs from 'node:fs';
import path from 'node:path';
import { RoleEligibilityFnsRegistryCoverageService } from './role-eligibility-fns-registry-coverage.service';

const root = path.resolve(__dirname, '../../../../..');
const coverageMigration = fs.readFileSync(
  path.join(root, 'apps/api/prisma/migrations/20260906180000_role_eligibility_fns_registry_coverage_authority/migration.sql'),
  'utf8',
);
const postgresSmoke = fs.readFileSync(path.join(root, 'scripts/role-eligibility-postgres-smoke.sh'), 'utf8');

function createService(rows: unknown[] = []) {
  const queryRaw = jest.fn().mockResolvedValue(rows);
  const service = new RoleEligibilityFnsRegistryCoverageService({ $queryRaw: queryRaw } as any);
  return { service, queryRaw };
}

function sqlText(query: unknown): string {
  return (query as { strings?: readonly string[] }).strings?.join('?') || String(query);
}

describe('RoleEligibilityFnsRegistryCoverageService', () => {
  it.each([new Date(Number.NaN), null, '2026-09-07'])('rejects an invalid decision time %s before querying', async (decisionAt) => {
    const { service, queryRaw } = createService();
    await expect(service.resolveEgrulInn('7707083893', decisionAt as Date))
      .rejects.toThrow('FNS_EGRUL_DECISION_TIME_INVALID');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('rejects an empty PostgreSQL result rather than inventing a verdict', async () => {
    const { service } = createService([]);
    await expect(service.resolveEgrulInn('7707083893'))
      .rejects.toThrow('FNS_EGRUL_COVERAGE_RESOLUTION_EMPTY');
  });

  it('rejects an ambiguous PostgreSQL result rather than choosing its first row', async () => {
    const row = { state: 'FOUND', generation_id: 'g', generation: 'g', authority_token: null, matched_records: 1n, matched_ogrns: 1n };
    const { service } = createService([row, row]);
    await expect(service.resolveEgrulInn('7707083893'))
      .rejects.toThrow('FNS_EGRUL_COVERAGE_RESOLUTION_AMBIGUOUS');
  });

  it('rejects an invalid legal-entity INN before touching PostgreSQL', async () => {
    const { service, queryRaw } = createService();
    await expect(service.resolveEgrulInn('7707083892')).resolves.toMatchObject({
      state: 'INVALID_IDENTIFIER',
      matchedRecords: 0,
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    'FOUND',
    'REVIEW_REQUIRED',
    'SOURCE_UNAVAILABLE',
    'STALE',
    'COVERAGE_NOT_PROVEN',
    'COVERAGE_NOT_FINAL',
    'AUTHORITATIVE_NOT_FOUND',
  ] as const)('preserves the server decision %s from one coherent query', async (state) => {
    const { service } = createService([{
      state,
      generation_id: 'elg-test',
      generation: '2026-09-07T00:00:00.000Z:aabbccddeeff0011',
      authority_token: 'a'.repeat(64),
      matched_records: state === 'FOUND' ? 1n : 0n,
      matched_ogrns: state === 'FOUND' ? 1n : 0n,
    }]);
    await expect(service.resolveEgrulInn('7707083893')).resolves.toMatchObject({ state });
  });

  it('binds EGRUL generation, health, lookup, coverage and finality in one SQL statement', async () => {
    const { service, queryRaw } = createService([{
      state: 'COVERAGE_NOT_FINAL',
      generation_id: 'elg-test',
      generation: 'g1',
      authority_token: 'a'.repeat(64),
      matched_records: 0n,
      matched_ogrns: 0n,
    }]);
    await service.resolveEgrulInn('7707083893', new Date('2026-09-07T00:00:00.000Z'));

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const text = sqlText(queryRaw.mock.calls[0][0]);
    expect(text).toContain('FROM eligibility.resolve_fns_egrul_inn(');
    expect(text).toContain('state,generation_id,generation,authority_token,matched_records,matched_ogrns');
    expect(text).not.toContain('registry_generations');
    expect(text).not.toContain('COALESCE');
  });

  it('delegates authority semantics to the single canonical PostgreSQL resolver instead of duplicating predicate SQL', async () => {
    const { service, queryRaw } = createService([{
      state: 'SOURCE_UNAVAILABLE',
      generation_id: 'elg-test',
      generation: 'g1',
      authority_token: null,
      matched_records: 0n,
      matched_ogrns: 0n,
    }]);
    await service.resolveEgrulInn('7707083893');
    const text = sqlText(queryRaw.mock.calls[0][0]);
    expect(text).toContain('eligibility.resolve_fns_egrul_inn');
    expect(text).not.toContain('source_health');
    expect(text).not.toContain('registry_generation_authority');
  });

  it('does not invent an authority token when no accepted authority row exists', async () => {
    const { service } = createService([{
      state: 'COVERAGE_NOT_PROVEN',
      generation_id: 'elg-test',
      generation: 'g1',
      authority_token: null,
      matched_records: 0n,
      matched_ogrns: 0n,
    }]);
    await expect(service.resolveEgrulInn('7707083893')).resolves.toMatchObject({
      state: 'COVERAGE_NOT_PROVEN',
      authorityToken: null,
    });
  });

  it('derives complete coverage/finality only from immutable evidence through the bounded verifier', () => {
    expect(coverageMigration).toContain('CREATE TABLE eligibility.registry_generation_authority_evidence');
    expect(coverageMigration).toContain('CREATE OR REPLACE FUNCTION eligibility.record_fns_egrul_authority_evidence');
    expect(coverageMigration).toContain('CREATE OR REPLACE FUNCTION eligibility.materialize_fns_egrul_registry_authority');
    expect(coverageMigration).toContain('NEW.acquisition_complete := FALSE;');
    expect(coverageMigration).toContain('NEW.source_finality := FALSE;');
    expect(coverageMigration).toContain("e.evidence_kind='ACQUISITION_COMPLETE'");
    expect(coverageMigration).toContain("e.evidence_kind='SOURCE_FINALITY'");
    expect(coverageMigration).toContain('s.acquisition_evidence_valid IS DISTINCT FROM TRUE');
    expect(coverageMigration).toContain('s.source_finality_evidence_valid IS DISTINCT FROM TRUE');
    expect(coverageMigration).toContain('s.authority_token_valid IS DISTINCT FROM TRUE');
    expect(postgresSmoke).toContain('SET ROLE pc_role_eligibility_authority;');
    expect(postgresSmoke).toContain("SELECT eligibility.materialize_fns_egrul_registry_authority('elg_egrul_final');");
  });

  it('binds continuity and finality to immutable accepted policy identities', () => {
    expect(coverageMigration).toContain('CREATE TABLE eligibility.registry_authority_policy_catalog');
    expect(coverageMigration).toContain("'FNS','EGRUL','CONTINUITY','fns-egrul-continuity-v1'");
    expect(coverageMigration).toContain("'FNS','EGRUL','FINALITY','fns-egrul-finality-v1'");
    expect(coverageMigration).toContain('continuity policy identity is not accepted for registry authority');
    expect(coverageMigration).toContain('finality policy identity is not accepted for registry authority');
    expect(coverageMigration).toContain('s.continuity_policy_accepted IS DISTINCT FROM TRUE');
    expect(coverageMigration).toContain('s.finality_policy_accepted IS DISTINCT FROM TRUE');
    expect(postgresSmoke).toContain('ARBITRARY_POLICY_UNEXPECTEDLY_ACCEPTED');
  });

  it('fails closed when DAILY_EFFECTIVE has no exact persisted composition lineage', () => {
    expect(coverageMigration).toMatch(
      /IF NEW\.generation_mode = 'DAILY_EFFECTIVE' THEN[\s\S]*?IF NOT FOUND THEN[\s\S]*?daily EGRUL authority requires persisted composition lineage/,
    );
    expect(coverageMigration).toContain('physical.predecessor_generation_id IS DISTINCT FROM NEW.predecessor_generation_id');
    expect(coverageMigration).toContain('physical.update_package_sha256 IS DISTINCT FROM NEW.update_package_sha256');
    expect(coverageMigration).toContain('s.lineage_valid IS DISTINCT FROM TRUE');
    expect(coverageMigration).toContain('SELECT c.predecessor_generation_id INTO baseline_generation_id');
    expect(coverageMigration).toContain('FROM chain AS c ORDER BY c.depth DESC LIMIT 1;');
    expect(postgresSmoke).toContain("SELECT eligibility.record_fns_egrul_predecessor('elg_egrul_b','elg_egrul_a');");
  });

});

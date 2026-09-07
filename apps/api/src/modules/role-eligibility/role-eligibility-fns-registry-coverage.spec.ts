import { RoleEligibilityFnsRegistryCoverageService } from './role-eligibility-fns-registry-coverage.service';

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
});

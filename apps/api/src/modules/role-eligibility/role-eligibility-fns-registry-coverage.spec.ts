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
    expect(text).toContain("g.source='FNS' AND g.registry_domain='EGRUL' AND g.status='ACTIVE'");
    expect(text).toContain("h.registry_domain='EGRUL'");
    expect(text).toContain('a.generation_id=g.id');
    expect(text).toContain('r.generation_id=g.id');
    expect(text).toContain("s.coverage_kind NOT IN ('COMPLETE_NATIONAL_CORPUS','COMPLETE_EFFECTIVE_CORPUS')");
    expect(text).toContain('s.effective_cutoff <');
    expect(text).toContain('s.source_finality IS DISTINCT FROM TRUE');
    expect(text).toContain("THEN 'COVERAGE_NOT_FINAL'");
    expect(text).toContain("ELSE 'AUTHORITATIVE_NOT_FOUND'");
    expect(text).toContain('s.authority_token,');
    expect(text).not.toContain('COALESCE(s.authority_token,s.content_sha256)');
  });

  it('requires healthy exact-generation coherence before any positive or negative assertion', async () => {
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
    expect(text).toContain("s.health_status IS DISTINCT FROM 'HEALTHY'");
    expect(text).toContain("s.circuit_state IS DISTINCT FROM 'CLOSED'");
    expect(text).toContain('s.active_generation IS DISTINCT FROM s.generation');
    expect(text).toContain('s.health_parser_version IS DISTINCT FROM s.parser_version');
    expect(text).toContain('s.health_schema_version IS DISTINCT FROM s.schema_version');
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

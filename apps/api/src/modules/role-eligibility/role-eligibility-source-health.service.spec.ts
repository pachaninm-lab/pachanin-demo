import { RoleEligibilitySourceHealthService } from './role-eligibility-source-health.service';

function sqlText(query: unknown): string {
  return (query as { strings?: readonly string[] }).strings?.join('?') || String(query);
}

function createService(queryResponses: unknown[][] = []) {
  const queryRaw = jest.fn();
  for (const response of queryResponses) queryRaw.mockResolvedValueOnce(response);
  const executeRaw = jest.fn().mockResolvedValue(1);
  const tx = { $queryRaw: queryRaw, $executeRaw: executeRaw };
  const transaction = jest.fn(async (task: (client: typeof tx) => Promise<unknown>) => task(tx));
  const service = new RoleEligibilitySourceHealthService({ $transaction: transaction } as any);
  return { service, queryRaw, executeRaw };
}

describe('RoleEligibilitySourceHealthService domain authority', () => {
  it('lists source health with registry domain in deterministic order', async () => {
    const { service, queryRaw } = createService([[]]);
    await service.list();
    const text = sqlText(queryRaw.mock.calls[0][0]);
    expect(text).toContain('registry_domain AS "registryDomain"');
    expect(text).toContain('ORDER BY source,registry_domain');
  });

  it('defaults legacy FNS callers to the EGRUL health domain', async () => {
    const egrul = {
      source: 'FNS', registryDomain: 'EGRUL', status: 'HEALTHY', circuitState: 'CLOSED',
      activeGeneration: 'g1', parserVersion: 'fns-egrul-v1', schemaVersion: 'EGRUL_408',
      lastSuccessAt: null, lastFailureAt: null, checkedAt: new Date(), freshUntil: new Date(Date.now() + 60_000),
      consecutiveFailures: 0, lastErrorCode: null,
    };
    const egrip = { ...egrul, registryDomain: 'EGRIP', activeGeneration: 'g2', schemaVersion: 'EGRIP_407' };
    const { service } = createService([[egrip, egrul]]);
    await expect(service.get('FNS')).resolves.toMatchObject({ registryDomain: 'EGRUL', activeGeneration: 'g1' });
  });

  it('writes health under the composite source/domain key', async () => {
    const { service, executeRaw } = createService();
    await service.success('FNS', {
      registryDomain: 'EGRUL',
      generation: 'g1',
      parserVersion: 'fns-egrul-v1',
      schemaVersion: 'EGRUL_408',
      freshUntil: new Date(Date.now() + 60_000),
    });
    const text = sqlText(executeRaw.mock.calls[0][0]);
    expect(text).toContain('source,registry_domain,status');
    expect(text).toContain('ON CONFLICT (source,registry_domain)');
  });

  it('refuses unresolved generic FNS schema on a successful authority write', async () => {
    const { service, executeRaw } = createService();
    await expect(service.success('FNS', {
      generation: 'g1',
      parserVersion: 'x',
      schemaVersion: 'FNS_GENERIC_V1',
      freshUntil: new Date(Date.now() + 60_000),
    })).rejects.toThrow('ROLE_ELIGIBILITY_FNS_HEALTH_DOMAIN_UNRESOLVED');
    expect(executeRaw).not.toHaveBeenCalled();
  });
});

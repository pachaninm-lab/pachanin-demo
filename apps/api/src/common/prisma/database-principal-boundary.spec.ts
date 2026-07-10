import {
  DatabasePrincipalSnapshot,
  evaluateAuthPrincipalBoundary,
  evaluateDealPrincipalBoundary,
  resolveAuthDatabaseUrl,
  shouldEnforceDatabasePrincipalBoundary,
} from './database-principal-boundary';

const safeSnapshot: DatabasePrincipalSnapshot = {
  currentUser: 'safe',
  superuser: false,
  bypassRls: false,
  ownsDeals: false,
  dealsRlsEnabled: true,
  dealsForceRls: true,
  rowSecurity: 'on',
  dealSelect: true,
  dealInsert: true,
  dealUpdate: true,
  dealDelete: true,
  authSchemaUsage: true,
  usersSelect: true,
  usersInsert: true,
  usersUpdate: true,
  userOrgsSelect: true,
  userOrgsInsert: true,
  userOrgsUpdate: true,
  organizationsSelect: true,
  organizationsInsert: true,
  organizationsUpdate: true,
  authTablesReadWrite: true,
  authAuditReadInsert: true,
};

describe('database principal boundaries', () => {
  it('accepts a least-privilege FORCE-RLS deal principal', () => {
    expect(evaluateDealPrincipalBoundary(safeSnapshot)).toEqual([]);
  });

  it('rejects a deal principal that owns tables or bypasses RLS', () => {
    expect(evaluateDealPrincipalBoundary({
      ...safeSnapshot,
      superuser: true,
      bypassRls: true,
      ownsDeals: true,
      dealsForceRls: false,
      rowSecurity: 'off',
    })).toEqual(expect.arrayContaining([
      expect.stringMatching(/SUPERUSER/),
      expect.stringMatching(/BYPASSRLS/),
      expect.stringMatching(/must not own/),
      expect.stringMatching(/FORCE RLS/),
      expect.stringMatching(/row_security/),
    ]));
  });

  it('accepts an auth principal only when it cannot access deals', () => {
    const authSnapshot: DatabasePrincipalSnapshot = {
      ...safeSnapshot,
      currentUser: 'auth_runtime',
      bypassRls: true,
      dealSelect: false,
      dealInsert: false,
      dealUpdate: false,
      dealDelete: false,
    };
    expect(evaluateAuthPrincipalBoundary(authSnapshot)).toEqual([]);
  });

  it('rejects an auth principal with deal privileges or incomplete identity grants', () => {
    expect(evaluateAuthPrincipalBoundary({
      ...safeSnapshot,
      bypassRls: true,
      dealSelect: true,
      usersInsert: false,
      authTablesReadWrite: false,
      authAuditReadInsert: false,
    })).toEqual(expect.arrayContaining([
      expect.stringMatching(/no privileges on public\.deals/),
      expect.stringMatching(/public\.users/),
      expect.stringMatching(/persistent auth state/),
      expect.stringMatching(/auth\.audit_events/),
    ]));
  });

  it('requires separate auth and deal URLs in production', () => {
    expect(() => resolveAuthDatabaseUrl({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://same@db/platform',
      AUTH_DATABASE_URL: 'postgresql://same@db/platform',
    })).toThrow(/different PostgreSQL principal/);

    expect(resolveAuthDatabaseUrl({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://deal@db/platform',
      AUTH_DATABASE_URL: 'postgresql://auth@db/platform',
    })).toBe('postgresql://auth@db/platform');
  });

  it('allows non-production fallback but enforces boundaries when explicitly requested', () => {
    expect(resolveAuthDatabaseUrl({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://dev@db/platform' }))
      .toBe('postgresql://dev@db/platform');
    expect(shouldEnforceDatabasePrincipalBoundary({ NODE_ENV: 'test' })).toBe(false);
    expect(shouldEnforceDatabasePrincipalBoundary({
      NODE_ENV: 'test',
      DB_PRINCIPAL_BOUNDARY_ENFORCED: 'true',
    })).toBe(true);
  });
});

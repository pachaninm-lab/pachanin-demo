import fs from 'node:fs';
import path from 'node:path';

type Sources = Readonly<{
  schema: string;
  policy: string;
  rollback: string;
  verifier: string;
  rehearsal: string;
}>;

function repositoryRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), '../..'),
    process.cwd(),
    path.resolve(__dirname, '../../../../../'),
  ];

  const root = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'apps/api/prisma/schema.prisma')),
  );

  if (!root) throw new Error('Repository root not found for RLS contract test.');
  return root;
}

function loadSources(): Sources {
  const root = repositoryRoot();
  return {
    schema: fs.readFileSync(path.join(root, 'apps/api/prisma/schema.prisma'), 'utf8'),
    policy: fs.readFileSync(path.join(root, 'infra/sql/production-rls-policies.sql'), 'utf8'),
    rollback: fs.readFileSync(path.join(root, 'infra/sql/production-rls-policies.rollback.sql'), 'utf8'),
    verifier: fs.readFileSync(path.join(root, 'scripts/platform-v7-rls-verify.mjs'), 'utf8'),
    rehearsal: fs.readFileSync(path.join(root, 'scripts/platform-v7-rls-rehearsal.sh'), 'utf8'),
  };
}

function executableSql(source: string): string {
  return source.replace(/^\s*--.*$/gm, '');
}

const physicalTables = [
  'deals',
  'organizations',
  'audit_events',
  'ledger_entries',
  'integration_events',
  'outbox_entries',
  'deal_workspace_runtime_snapshots',
  'deal_workspace_runtime_transaction_attempts',
] as const;

describe('VP-3.45 physical PostgreSQL RLS policy contract', () => {
  const source = loadSources();
  const policy = executableSql(source.policy);
  const rollback = executableSql(source.rollback);

  it('uses canonical physical Prisma table names and forces RLS', () => {
    for (const table of physicalTables) {
      expect(source.schema).toContain(`@@map("${table}")`);
      expect(policy).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(policy).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      expect(rollback).toContain(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }

    for (const modelName of ['"Deal"', '"AuditEvent"', '"LedgerEntry"', '"IntegrationEvent"', '"OutboxEntry"']) {
      expect(policy).not.toContain(modelName);
    }
  });

  it('keeps context tenant-scoped, service-bound and fail-closed', () => {
    expect(policy).toContain("current_setting('app.current_tenant_id', true)");
    expect(policy).toContain("current_setting('app.current_org_id', true)");
    expect(policy).toContain("current_setting('app.current_user_id', true)");
    expect(policy).toContain("current_setting('app.current_role', true)");
    expect(policy).toContain("current_user = 'app_service'");
    expect(policy).not.toContain('CREATE POLICY IF NOT EXISTS');
    expect(policy).not.toContain('CREATE OR REPLACE FUNCTION set_app_context');
    expect(policy).not.toContain('set_config(');
    expect(policy).not.toContain('$executeRawUnsafe');
    expect(policy).not.toContain('ACCOUNTING');
  });

  it('preserves append-only audit, ledger and runtime attempt evidence', () => {
    expect(policy).toContain('CREATE POLICY audit_events_update_denied');
    expect(policy).toContain('CREATE POLICY audit_events_delete_denied');
    expect(policy).toContain('CREATE POLICY ledger_entries_update_denied');
    expect(policy).toContain('CREATE POLICY ledger_entries_delete_denied');
    expect(policy).toContain('CREATE POLICY runtime_attempts_update_denied');
    expect(policy).toContain('CREATE POLICY runtime_attempts_delete_denied');
  });

  it('provides complete non-destructive rollback coverage', () => {
    const policyNames = [...policy.matchAll(/CREATE POLICY\s+([a-z0-9_]+)/gi)]
      .map((match) => match[1]);

    expect(policyNames.length).toBeGreaterThanOrEqual(24);
    for (const policyName of policyNames) {
      expect(rollback).toContain(`DROP POLICY IF EXISTS ${policyName}`);
    }

    for (const destructive of ['DROP TABLE', 'DROP COLUMN', 'TRUNCATE', 'DELETE FROM']) {
      expect(rollback).not.toContain(destructive);
    }
  });

  it('blocks rehearsal without explicit non-production identity and exact database match', () => {
    expect(source.rehearsal).toContain('ALLOW_NON_PRODUCTION_RLS_REHEARSAL');
    expect(source.rehearsal).toContain('RLS_REHEARSAL_DATABASE_NAME');
    expect(source.rehearsal).toContain('RLS_REHEARSAL_ENVIRONMENT');
    expect(source.rehearsal).toContain('NODE_ENV=production');
    expect(source.rehearsal).toContain('SELECT current_database()');
    expect(source.rehearsal).toContain('trap rollback EXIT');
    expect(source.verifier).toContain('productionDatabaseModified: false');
  });
});

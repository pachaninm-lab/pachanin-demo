import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

const canonicalSeedPath = 'apps/api/src/modules/deals/canonical-test-deal.seed.ts';
const industrialHarnessPath = 'apps/api/test/industrial/harness.ts';
const finalizeMigrationPath =
  'apps/api/prisma/migrations/20260713121000_labs_postgresql_authority/migration.sql';
const prismaRepositoryPath = 'apps/api/src/modules/labs/prisma-lab.repository.ts';
const postgresDealCommandPath =
  'apps/api/src/modules/deals/postgresql-deal-command.service.ts';
const industrialE2ePath =
  'apps/api/test/industrial/labs-postgresql-authority.e2e-spec.ts';

describe('IR-10.3 laboratory PostgreSQL authority cannot be bypassed', () => {
  it.each([canonicalSeedPath, industrialHarnessPath])(
    '%s never disables PostgreSQL constraints, triggers or RLS',
    (relativePath) => {
      const source = readRepoFile(relativePath);

      expect(source).not.toMatch(/session_replication_role\s*=\s*replica/i);
      expect(source).not.toMatch(/DISABLE\s+TRIGGER/i);
      expect(source).not.toMatch(/BYPASSRLS/i);
    },
  );

  it.each([canonicalSeedPath, industrialHarnessPath])(
    '%s never deletes confirmed laboratory facts to reseed them',
    (relativePath) => {
      const source = readRepoFile(relativePath);

      expect(source).not.toMatch(/labTest\.deleteMany\s*\(/);
      expect(source).not.toMatch(/DELETE\s+FROM\s+(?:public\.)?["']?lab_tests/i);
    },
  );

  it('does not permit a legacy PENDING sample to jump directly to FINALIZED', () => {
    const migration = readRepoFile(finalizeMigrationPath);

    expect(migration).not.toContain(
      `OLD."status" IN ('PENDING','ANALYSIS_IN_PROGRESS') AND NEW."status" = 'FINALIZED'`,
    );
    expect(migration).toContain(
      `OLD."status" = 'ANALYSIS_IN_PROGRESS' AND NEW."status" = 'FINALIZED'`,
    );
  });

  it('fails loudly when confirmed laboratory facts are changed or appended late', () => {
    const migration = readRepoFile(finalizeMigrationPath);

    expect(migration).not.toMatch(
      /IF\s+TG_OP\s*=\s*'DELETE'\s+THEN\s+RETURN\s+NULL/si,
    );
    expect(migration).not.toMatch(
      /sample_record\."status"\s*=\s*'FINALIZED'\s+THEN\s+RETURN\s+NULL/si,
    );
    expect(migration).toMatch(/append-only/);
    expect(migration).toMatch(/RAISE\s+EXCEPTION/i);
  });

  it('requires a dedicated SIGNATORY for protocol finalization', () => {
    const migration = readRepoFile(finalizeMigrationPath);

    expect(migration).not.toContain(`actor.actor_type IN ('ANALYST','SIGNATORY')`);
    expect(migration).toMatch(/actor\.actor_type\s*=\s*'SIGNATORY'/);
  });

  it('derives finalization time on the server instead of trusting arbitrary client time', () => {
    const command = readRepoFile(postgresDealCommandPath);

    expect(command).not.toMatch(/requiredDate\(clientPayload,\s*'finalizedAt'\)/);
  });

  it('enforces operation-specific laboratory actor types in the production repository', () => {
    const repository = readRepoFile(prismaRepositoryPath);

    for (const actorType of [
      'SAMPLER',
      'COURIER',
      'RECEIVER',
      'ANALYST',
      'SIGNATORY',
    ]) {
      expect(repository).toContain(actorType);
    }
  });

  it('ships an exact PostgreSQL exploitation suite for Labs authority', () => {
    const absoluteE2ePath = resolve(REPO_ROOT, industrialE2ePath);
    expect(existsSync(absoluteE2ePath)).toBe(true);

    const e2e = readFileSync(absoluteE2ePath, 'utf8');
    for (const proofMarker of [
      'cross-tenant',
      'same-tenant outsider',
      'two-instance',
      'expired accreditation',
      'expired calibration',
      'correction',
      'rollback',
      'idempotency',
    ]) {
      expect(e2e.toLowerCase()).toContain(proofMarker);
    }
  });
});

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres('P0.2-2A FGIS commodity PostgreSQL authority', () => {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  beforeAll(async () => {
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('creates all seven canonical authority tables with FORCE RLS', async () => {
    const rows = await db.$queryRaw<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'fgis_commodity'
        AND c.relkind = 'r'
      ORDER BY c.relname
    `;

    expect(rows.map((row) => row.relname)).toEqual([
      'lot_passports',
      'organization_connections',
      'party_current',
      'party_snapshots',
      'reconciliation_cases',
      'reservations',
      'sync_runs',
    ]);
    expect(rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  it('uses exact numeric authority for all commodity volumes', async () => {
    const rows = await db.$queryRaw<Array<{ table_name: string; column_name: string; data_type: string; numeric_precision: number; numeric_scale: number }>>`
      SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'fgis_commodity'
        AND column_name IN ('amount_original', 'amount_available', 'authoritative_amount', 'volume')
      ORDER BY table_name, column_name
    `;

    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const row of rows) {
      expect(row.data_type).toBe('numeric');
      expect(Number(row.numeric_precision)).toBe(24);
      expect(Number(row.numeric_scale)).toBe(6);
    }
  });

  it('does not grant direct table mutations to production application roles', async () => {
    const rows = await db.$queryRaw<Array<{ grantee: string; privilege_type: string }>>`
      SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'fgis_commodity'
        AND grantee IN ('app_deal', 'app_service', 'app_runtime')
        AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    `;
    expect(rows).toEqual([]);
  });

  it('enforces same-tenant and same-organization foreign-key bindings', async () => {
    const constraints = await db.$queryRaw<Array<{ conname: string; definition: string }>>`
      SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'fgis_commodity'
        AND con.contype = 'f'
      ORDER BY con.conname
    `;

    expect(constraints.length).toBeGreaterThanOrEqual(10);
    for (const constraint of constraints) {
      expect(constraint.definition).toContain('tenant_id');
      expect(constraint.definition).toContain('organization_id');
    }
  });

  it('rejects mutation of an accepted party snapshot', async () => {
    const tenantId = `tenant-${randomUUID()}`;
    const organizationId = `org-${randomUUID()}`;
    await db.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, false)`, tenantId);
    await db.$executeRawUnsafe(`SELECT set_config('app.organization_id', $1, false)`, organizationId);

    const connectionId = randomUUID();
    const syncRunId = randomUUID();
    const snapshotId = randomUUID();
    const digest = 'a'.repeat(64);

    await db.$executeRawUnsafe(
      `INSERT INTO fgis_commodity.organization_connections
       (id, tenant_id, organization_id, provider_configuration_id, status, adapter_version, created_by)
       VALUES ($1::uuid, $2, $3, $4::uuid, 'DRAFT', 'test-adapter', 'test-user')`,
      connectionId,
      tenantId,
      organizationId,
      randomUUID(),
    );
    await db.$executeRawUnsafe(
      `INSERT INTO fgis_commodity.sync_runs
       (id, tenant_id, organization_id, connection_id, correlation_id, initiated_by)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5, 'test-user')`,
      syncRunId,
      tenantId,
      organizationId,
      connectionId,
      `FGIS-${randomUUID()}`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO fgis_commodity.party_snapshots
       (id, tenant_id, organization_id, connection_id, sync_run_id,
        external_party_id, adapter_version, contract_version, owner_reference,
        amount_available, external_status, source_updated_at, payload_hash, critical_hash)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5::uuid,
        'external-party-1', 'test-adapter', '1.0.23', 'owner-reference',
        100.000000, 'SUBSCRIBED', clock_timestamp(), $6, $6)`,
      snapshotId,
      tenantId,
      organizationId,
      connectionId,
      syncRunId,
      digest,
    );

    await expect(
      db.$executeRawUnsafe(
        `UPDATE fgis_commodity.party_snapshots SET amount_available = 99 WHERE id = $1::uuid`,
        snapshotId,
      ),
    ).rejects.toThrow(/FGIS_COMMODITY_IMMUTABLE_EVIDENCE/);
  });

  it.todo('accepts exact snapshot replay and creates a new immutable version for divergent provider state');
  it.todo('serializes 50 reservation attempts and never exceeds authoritative volume');
  it.todo('returns the same reservation for exact idempotency replay and rejects divergent replay');
  it.todo('proves release, expire, freeze and convert transitions');
  it.todo('creates an immutable passport bound to the exact snapshot and reservation');
  it.todo('creates idempotent reconciliation cases');
  it.todo('rolls back domain state when audit or canonical outbox persistence fails');
});

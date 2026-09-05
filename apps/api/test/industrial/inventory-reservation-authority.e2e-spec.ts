import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { InventoryRepository } from '../../src/modules/inventory/inventory.repository';
import type { InventoryCommand, InventoryReceipt } from '../../src/modules/inventory/inventory.contract';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? '');
const APP_URL = String(process.env.ONE_DEAL_APP_URL ?? '');
const RUN = `inventory-${randomUUID()}`;
const PROFILE = `${RUN}-profile`;
const VERSION = `${RUN}-version`;
const units = [
  { code: 'KG', dimension: 'MASS', symbol: 'kg', isBase: true, precision: 3, numeratorToBase: '1', denominatorToBase: '1', sourceRef: 'test:si' },
  { code: 'TON', dimension: 'MASS', symbol: 't', isBase: false, precision: 6, numeratorToBase: '1000', denominatorToBase: '1', sourceRef: 'test:si' },
  { code: 'PACK', dimension: 'COUNT', symbol: 'pack', isBase: true, precision: 0, numeratorToBase: '1', denominatorToBase: '1', sourceRef: 'test:pack' },
];
const actors: RequestUser[] = ['a', 'b', 'c', 'd'].map((suffix, index) => ({
  id: `${RUN}-user-${suffix}`, email: `${RUN}-${suffix}@inventory.test`, role: Role.ADMIN,
  tenantId: `${RUN}-tenant-${index === 1 ? 'b' : 'a'}`, orgId: `${RUN}-org-${index === 3 ? 'a' : suffix}`,
  membershipId: `${RUN}-member-${suffix}`, isOrgAdmin: index !== 3, sessionId: `${RUN}-session-${suffix}`,
}));
const [actor, foreign, outsider, member] = actors as [RequestUser, RequestUser, RequestUser, RequestUser];
const LOT_A = `${RUN}-lot-a`; const LOT_B = `${RUN}-lot-b`; const LOT_C = `${RUN}-lot-c`;
const common = (suffix: string, expectedVersion = '0') => ({ commandId: `${RUN}-command-${suffix}`, idempotencyKey: `${RUN}-key-${suffix}`, correlationId: `${RUN}-correlation-${suffix}`, expectedVersion, reason: `Inventory acceptance command for ${suffix}.` });
const declaration = (suffix: string, quantity = '100'): InventoryCommand => ({ ...common(suffix), action: 'DECLARE', stockKey: `stock-${suffix}`, profileVersionId: VERSION, sourceType: 'MANUAL', sourceReference: `own-register:${suffix}`, unitCode: 'TON', quantity });
const reserve = (suffix: string, positionId: string, version: string, quantity = '60', lotId = LOT_A): InventoryCommand => ({ ...common(suffix, version), action: 'RESERVE', positionId, lotId, unitCode: 'TON', quantity });
const release = (suffix: string, receipt: InventoryReceipt): InventoryCommand => ({ ...common(suffix, receipt.position.stateVersion), action: 'RELEASE', positionId: receipt.position.positionId, reservationId: receipt.reservation!.id });

const describeAuthority = ADMIN_URL && APP_URL ? describe : describe.skip;
describeAuthority('Inventory PostgreSQL authority at READ COMMITTED', () => {
  const admin = new PrismaService({ datasources: { db: { url: ADMIN_URL } } });
  const app = new PrismaService({ datasources: { db: { url: APP_URL } } });
  const rls = new RlsTransactionService(app);
  const inventory = new InventoryRepository(rls);
  const raw = (user: RequestUser, command: unknown) => rls.withTrustedContext(user, (tx) => tx.$queryRaw<Array<{ receipt: InventoryReceipt }>>(Prisma.sql`SELECT inventory.execute_command(${JSON.stringify(command)}::jsonb) AS receipt`), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxConflictRetries: 0 });
  const stored = (id: string) => admin.$queryRaw<Array<{ state_version: bigint; declared_quantity: bigint; available_quantity: bigint; reserved_quantity: bigint }>>(Prisma.sql`SELECT state_version, declared_quantity, available_quantity, reserved_quantity FROM inventory.positions WHERE id = ${id}`);

  beforeAll(async () => {
    await Promise.all([admin.$connect(), app.$connect()]);
    const timestamp = Date.now().toString().slice(-8);
    await admin.organization.createMany({ data: actors.slice(0, 3).map((user, i) => ({ id: user.orgId!, tenantId: user.tenantId!, name: `Inventory ${i}`, inn: `${81 + i}${timestamp}`, status: 'ACTIVE' })) });
    await admin.user.createMany({ data: actors.map((user) => ({ id: user.id, email: user.email, fullName: 'Inventory acceptance actor', passwordHash: 'test-not-a-login-secret' })) });
    await admin.userOrg.createMany({ data: actors.map((user) => ({ id: user.membershipId!, userId: user.id, organizationId: user.orgId!, role: user.role, status: 'ACTIVE', isOrgAdmin: user.isOrgAdmin })) });
    await admin.commodityProfile.create({ data: { id: PROFILE, canonicalCode: `TEST.${randomUUID().replaceAll('-', '').toUpperCase()}`, archetype: 'DRY_BULK', authoritativeNameRu: 'Тестовые единицы количества', createdByUserId: actor.id, updatedByUserId: actor.id } });
    const content = { canonicalCode: 'TEST.INVENTORY', units, qualityIndicators: [] };
    await admin.commodityProfileVersion.create({ data: { id: VERSION, profileId: PROFILE, sequence: 1, content, contentHash: createHash('sha256').update(JSON.stringify(content)).digest('hex'), createdByUserId: actor.id, updatedByUserId: actor.id } });
    for (const status of ['REVIEW', 'APPROVED', 'EFFECTIVE']) {
      await admin.$executeRaw(Prisma.sql`UPDATE public.commodity_profile_versions SET status = ${status}, version = version + 1,
        "approvedByUserId" = ${actor.id}, "approvedAt" = clock_timestamp(), "approvalReason" = 'Isolated inventory unit acceptance',
        "effectiveFrom" = clock_timestamp() - interval '1 minute', "updatedAt" = greatest(clock_timestamp(), "updatedAt" + interval '1 millisecond') WHERE id = ${VERSION}`);
    }
    for (const [id, owner] of [[LOT_A, actor], [LOT_B, actor], [LOT_C, outsider]] as const) {
      await admin.$executeRaw(Prisma.sql`INSERT INTO auction.lots(id,tenant_id,seller_org_id,title,culture,volume_tons,start_price_rub_per_ton,step_price_rub_per_ton,
        start_price_kopecks_per_ton,step_price_kopecks_per_ton,region,status,auction_ends_at,source_type)
        VALUES(${id},${owner.tenantId},${owner.orgId},'Inventory fixture lot','test-crop',100,100,1,10000,100,'test-region','OPEN',clock_timestamp()+interval '1 day','OTHER')`);
    }
  });
  // The isolated database is retained for the subsequent backup/restore proof.
  // No authority trigger or RLS policy is disabled to construct/clean fixtures.
  afterAll(async () => { await Promise.allSettled([app.$disconnect(), admin.$disconnect()]); });

  it('uses six FORCE-RLS tables and a memberless non-login, non-bypass command owner', async () => {
    const tables = await app.$queryRaw<Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>>(Prisma.sql`SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='inventory' AND c.relkind='r'`);
    expect(tables).toHaveLength(6); expect(tables.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
    const role = await app.$queryRaw<Array<{ rolcanlogin: boolean; rolbypassrls: boolean; rolsuper: boolean; rolinherit: boolean; edges: bigint }>>(Prisma.sql`SELECT rolcanlogin,rolbypassrls,rolsuper,rolinherit,(SELECT count(*) FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid) AS edges FROM pg_roles r WHERE rolname='pc_inventory_authority'`);
    expect(role[0]).toEqual({ rolcanlogin: false, rolbypassrls: false, rolsuper: false, rolinherit: false, edges: 0n });
    await expect(app.$executeRawUnsafe('SET ROLE pc_inventory_authority')).rejects.toBeDefined();
  });

  it('declares stock once without creating independent facts and binds durable replay', async () => {
    const command = declaration('declare'); const first = await inventory.execute(actor, command);
    expect(first.position).toMatchObject({ declaredQuantity: '100000000', confirmedQuantity: '0', availableQuantity: '100000000', reservedQuantity: '0', stateVersion: '1', verificationStatus: 'DECLARED', baseUnitCode: 'KG', baseUnitPrecision: 3, policyVersion: '1' });
    expect(await inventory.execute(actor, command)).toEqual({ ...first, replayed: true });
    await expect(raw(actor, { ...command, quantity: '101' })).rejects.toBeDefined();
    await expect(raw(actor, { ...command, ...common('duplicate-physical-key') })).rejects.toBeDefined();
    expect((await stored(first.position.positionId))[0]?.declared_quantity).toBe(100000000n);
  });

  it('preserves exact atoms above Number.MAX_SAFE_INTEGER', async () => {
    const command = { ...declaration('exact-big'), unitCode: 'KG', quantity: '9007199254740.993' } as InventoryCommand;
    expect((await inventory.execute(actor, command)).position.availableQuantity).toBe('9007199254740993');
  });

  it('serializes two lots sharing a physical position under raw READ COMMITTED commands', async () => {
    const position = (await inventory.execute(actor, declaration('race'))).position.positionId;
    const results = await Promise.allSettled([raw(actor, reserve('race-a', position, '1')), raw(actor, reserve('race-b', position, '1', '60', LOT_B))]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await stored(position))[0]).toMatchObject({ reserved_quantity: 60000000n, available_quantity: 40000000n, state_version: 2n });
    await expect(raw(actor, reserve('too-much-current-version', position, '2', '60', LOT_B))).rejects.toBeDefined();
    const last = (await raw(actor, reserve('exact-remainder', position, '2', '40', LOT_B)))[0]!.receipt;
    expect(last.position).toMatchObject({ availableQuantity: '0', reservedQuantity: '100000000', stateVersion: '3' });
  });

  it('accepts one effect for concurrent exact replay and releases only once', async () => {
    const position = (await inventory.execute(actor, declaration('replay-race'))).position.positionId;
    const command = reserve('same-race-command', position, '1');
    const receipts = await Promise.all(Array.from({ length: 8 }, () => inventory.execute(actor, command)));
    expect(new Set(receipts.map((item) => item.reservation!.id)).size).toBe(1);
    expect(receipts.filter((item) => !item.replayed)).toHaveLength(1);
    const releaseCommand = release('release-race', receipts[0]!);
    const freed = await Promise.all([inventory.execute(actor, releaseCommand), inventory.execute(actor, releaseCommand)]);
    expect(freed[0]?.position).toMatchObject({ availableQuantity: '100000000', reservedQuantity: '0', stateVersion: '3' });
    await expect(raw(actor, { ...releaseCommand, ...common('second-release', '3') })).rejects.toBeDefined();
  });

  it('denies cross-tenant, same-tenant outsiders, forged context and forged admin claims', async () => {
    const position = (await inventory.execute(actor, declaration('isolation'))).position.positionId;
    for (const denied of [foreign, outsider, { ...outsider, orgId: actor.orgId }, { ...actor, tenantId: foreign.tenantId }, { ...member, isOrgAdmin: true }]) {
      await expect(raw(denied, reserve(`denied-${randomUUID()}`, position, '1', '1'))).rejects.toBeDefined();
    }
    for (const reader of [foreign, outsider, { ...outsider, orgId: actor.orgId }]) {
      expect((await inventory.listOwn(reader)).items).toEqual([]);
    }
    await expect(raw(actor, reserve('foreign-lot', position, '1', '1', LOT_C))).rejects.toBeDefined();
    expect((await stored(position))[0]?.state_version).toBe(1n);
  });

  it('denies direct DML, evidence mutation, destructive commands and authority-shaped JSON', async () => {
    const position = (await inventory.execute(actor, declaration('bypass'))).position.positionId;
    await expect(rls.withTrustedContext(actor, (tx) => tx.$executeRaw(Prisma.sql`UPDATE inventory.positions SET declared_quantity=200000000,available_quantity=200000000 WHERE id=${position}`))).rejects.toBeDefined();
    await expect(rls.withTrustedContext(actor, (tx) => tx.$executeRaw(Prisma.sql`DELETE FROM inventory.command_events WHERE position_id=${position}`))).rejects.toBeDefined();
    await expect(app.$executeRawUnsafe('TRUNCATE inventory.positions CASCADE')).rejects.toBeDefined();
    for (const extra of [{ confirmedQuantity: '100' }, { verified: true }, { organizationId: actor.orgId }, { expectedVersion: null }]) {
      await expect(raw(actor, { ...reserve(`bypass-${randomUUID()}`, position, '1', '1'), ...extra })).rejects.toBeDefined();
    }
    expect((await stored(position))[0]?.state_version).toBe(1n);
  });

  it('permits superuser reset while denying runtime truncation even with accidental table grants', async () => {
    const position = (await inventory.execute(actor, declaration('maintenance'))).position.positionId;
    const roles = await app.$queryRaw<Array<{ name: string; superuser: boolean }>>(Prisma.sql`
      SELECT current_user AS name, rolsuper AS superuser FROM pg_catalog.pg_roles WHERE rolname=current_user`);
    expect(roles[0]?.superuser).toBe(false);
    const appRole = roles[0]!.name;
    const missing = await admin.$queryRaw<Array<{ table_name: string }>>(Prisma.sql`
      SELECT c.relname AS table_name FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='inventory' AND c.relkind='r'
        AND NOT has_table_privilege(${appRole}, c.oid, 'TRUNCATE')`);
    const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
    try {
      for (const row of missing) await admin.$executeRawUnsafe(`GRANT TRUNCATE ON inventory.${quoteIdentifier(row.table_name)} TO ${quoteIdentifier(appRole)}`);
      await expect(app.$executeRawUnsafe('TRUNCATE inventory.positions CASCADE')).rejects.toThrow('INVENTORY_DIRECT_MUTATION_DENIED');
    } finally {
      for (const row of missing) await admin.$executeRawUnsafe(`REVOKE TRUNCATE ON inventory.${quoteIdentifier(row.table_name)} FROM ${quoteIdentifier(appRole)}`);
    }
    const rollback = new Error('inventory maintenance proof rollback');
    await expect(admin.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('TRUNCATE inventory.positions CASCADE');
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*) FROM inventory.positions`);
      expect(rows[0]?.count).toBe(0n);
      throw rollback;
    })).rejects.toBe(rollback);
    expect((await stored(position))[0]?.state_version).toBe(1n);
  });

  it.each(['audit', 'outbox', 'event'] as const)('rolls back all quantities and evidence on %s insertion failure', async (kind) => {
    const position = (await inventory.execute(actor, declaration(`rollback-${kind}`))).position.positionId;
    const table = { audit: 'public.audit_events', outbox: 'public.outbox_entries', event: 'inventory.command_events' }[kind]!;
    const command = reserve(`failed-${kind}`, position, '1', '10');
    await admin.$executeRawUnsafe(`CREATE FUNCTION inventory.acceptance_force_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'inventory acceptance forced failure'; END $$`);
    await admin.$executeRawUnsafe(`CREATE TRIGGER inventory_acceptance_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION inventory.acceptance_force_failure()`);
    try { await expect(inventory.execute(actor, command)).rejects.toThrow('inventory acceptance forced failure'); }
    finally {
      await admin.$executeRawUnsafe(`DROP TRIGGER inventory_acceptance_failure ON ${table}`);
      await admin.$executeRawUnsafe('DROP FUNCTION inventory.acceptance_force_failure()');
    }
    expect((await stored(position))[0]).toMatchObject({ reserved_quantity: 0n, available_quantity: 100000000n, state_version: 1n });
    const evidence = await admin.$queryRaw<Array<{ events: bigint; reservations: bigint; snapshots: bigint; audits: bigint; outbox: bigint }>>(Prisma.sql`SELECT
      (SELECT count(*) FROM inventory.command_events WHERE position_id=${position}) AS events,
      (SELECT count(*) FROM inventory.reservations WHERE position_id=${position}) AS reservations,
      (SELECT count(*) FROM inventory.availability_snapshots WHERE position_id=${position}) AS snapshots,
      (SELECT count(*) FROM public.audit_events WHERE "correlationId"=${command.correlationId}) AS audits,
      (SELECT count(*) FROM public.outbox_entries WHERE "correlationId"=${command.correlationId}) AS outbox`);
    expect(evidence[0]).toEqual({ events: 1n, reservations: 0n, snapshots: 1n, audits: 0n, outbox: 0n });
    expect((await inventory.execute(actor, command)).position.stateVersion).toBe('2');
  });

  it('rejects deferred evidence failure before acknowledging a command', async () => {
    const position = (await inventory.execute(actor, declaration('deferred'))).position.positionId;
    await admin.$executeRawUnsafe("CREATE FUNCTION inventory.acceptance_deferred_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'inventory deferred evidence failure'; END $$");
    await admin.$executeRawUnsafe('CREATE CONSTRAINT TRIGGER inventory_acceptance_deferred AFTER INSERT ON inventory.command_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory.acceptance_deferred_failure()');
    const command = reserve('deferred-failure', position, '1', '10');
    try { await expect(inventory.execute(actor, command)).rejects.toThrow('inventory deferred evidence failure'); }
    finally {
      await admin.$executeRawUnsafe('DROP TRIGGER inventory_acceptance_deferred ON inventory.command_events');
      await admin.$executeRawUnsafe('DROP FUNCTION inventory.acceptance_deferred_failure()');
    }
    expect((await stored(position))[0]).toMatchObject({ state_version: 1n, reserved_quantity: 0n });
    expect((await inventory.execute(actor, command)).position.stateVersion).toBe('2');
  });

  it('rechecks current membership before replay and never trusts a revoked admin claim', async () => {
    const command = declaration('revoked-replay'); await inventory.execute(actor, command);
    await admin.userOrg.update({ where: { id: actor.membershipId }, data: { status: 'REVOKED' } });
    try { await expect(inventory.execute(actor, command)).rejects.toBeDefined(); }
    finally { await admin.userOrg.update({ where: { id: actor.membershipId }, data: { status: 'ACTIVE' } }); }
  });

  it('pins units and permits release after a profile is revoked without admitting a new reservation', async () => {
    const position = (await inventory.execute(actor, declaration('profile-revoke'))).position.positionId;
    const held = await inventory.execute(actor, reserve('before-profile-revoke', position, '1', '1'));
    await admin.$executeRaw(Prisma.sql`UPDATE public.commodity_profile_versions SET status='REVOKED',version=version+1,
      "updatedAt"=greatest(clock_timestamp(),"updatedAt"+interval '1 millisecond') WHERE id=${VERSION}`);
    await expect(raw(actor, reserve('after-profile-revoke', position, '2', '1'))).rejects.toBeDefined();
    const freed = await inventory.execute(actor, release('release-revoked-profile', held));
    expect(freed.position).toMatchObject({ availableQuantity: '100000000', reservedQuantity: '0', baseUnitCode: 'KG', baseUnitPrecision: 3 });
  });
});

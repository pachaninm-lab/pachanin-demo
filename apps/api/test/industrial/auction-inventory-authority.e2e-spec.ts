import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import { AuctionAuthorityService } from '../../src/modules/auctions/auction-authority.service';
import { AuctionCommandService, type RegisterAuctionLotInput } from '../../src/modules/auctions/auction-command.service';
import { AuctionsController } from '../../src/modules/auctions/auctions.controller';
import { InventoryRepository } from '../../src/modules/inventory/inventory.repository';
import type { InventoryCommand } from '../../src/modules/inventory/inventory.contract';
import { FgisLegacyQuarantineAuditService } from '../../src/modules/regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.audit';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? process.env.TEST_ADMIN_DATABASE_URL ?? '');
const EXPLICIT_APP_URL = String(process.env.ONE_DEAL_APP_URL ?? process.env.TEST_APPLICATION_DATABASE_URL ?? '');
const APP_URL = EXPLICIT_APP_URL || String(process.env.DATABASE_URL ?? ADMIN_URL);
const RESTORE = process.env.AUCTION_INVENTORY_RESTORE_PROOF === '1';
const RUN = 'auction-inventory-authority';
const TENANT = `${RUN}-tenant`;
const PROFILE_VERSION = `${RUN}-profile-version`;
const RESTORE_KEY = 'register:restore-survivor';
const CULTURE = 'TEST.AUCTION.INVENTORY';
const LEGACY_FUNCTION = 'auction.register_verified_lot(text,text,text,numeric,bigint,bigint,text,text,timestamptz,text,text,text,boolean,integer,integer,text,text)';
const units = [
  { code: 'KG', dimension: 'MASS', symbol: 'kg', isBase: true, precision: 3, numeratorToBase: '1', denominatorToBase: '1', sourceRef: 'test:si' },
  { code: 'TON', dimension: 'MASS', symbol: 't', isBase: false, precision: 6, numeratorToBase: '1000', denominatorToBase: '1', sourceRef: 'test:si' },
  { code: 'PACK', dimension: 'COUNT', symbol: 'pack', isBase: true, precision: 0, numeratorToBase: '1', denominatorToBase: '1', sourceRef: 'test:count' },
];
const actors: RequestUser[] = ['seller', 'foreign', 'outsider', 'member', 'buyer'].map((suffix, index) => ({
  id: `${RUN}-${suffix}`, email: `${RUN}-${suffix}@example.test`, role: index === 4 ? Role.BUYER : Role.FARMER,
  orgId: `${RUN}-org-${index === 3 ? 'seller' : suffix}`, tenantId: index === 1 ? `${TENANT}-foreign` : TENANT,
  membershipId: `${RUN}-membership-${suffix}`, isOrgAdmin: index !== 3, sessionId: `${RUN}-session-${suffix}`,
}));
const [seller, foreign, outsider, member, buyer] = actors as [RequestUser, RequestUser, RequestUser, RequestUser, RequestUser];
type Json = Record<string, unknown>;
type Binding = { id: string; positionId: string; reservationId: string; profileVersionId: string; profileContentHash: string; canonicalCode: string; quantityAtoms: string; baseUnitCode: string; baseUnitPrecision: number; inventoryStateVersion: string };
type Receipt = Json & { lotId: string; duplicate: boolean; binding: Binding };
const common = (key: string, expectedVersion = '0') => ({
  commandId: `${RUN}-command:${key}`, idempotencyKey: `${RUN}-key:${key}`, correlationId: `${RUN}-correlation:${key}`,
  expectedVersion, reason: `Isolated auction inventory acceptance for ${key}.`,
});
function registration(key: string, positionId: string, overrides: Partial<RegisterAuctionLotInput> = {}): RegisterAuctionLotInput {
  return {
    title: `Declared inventory auction ${key}`, culture: CULTURE, grade: null, volumeTons: '10.000000',
    startPriceKopecksPerTon: '10000', stepPriceKopecksPerTon: '100', region: 'Acceptance region', address: null,
    auctionEndsAt: new Date(Date.now() + 86_400_000).toISOString(), sourceType: 'OTHER', sourceExternalId: `own-register:${key}`,
    sourceCertificateId: null, autoExtendEnabled: false, autoExtendWindowMinutes: 10, autoExtendMinutes: 10,
    inventoryPositionId: positionId, inventoryExpectedVersion: '1', profileVersionId: PROFILE_VERSION, unitCode: 'TON', quantity: '10.000000',
    correlationId: `${RUN}-register:${key}`, reason: `Offer declared physical stock for ${key}.`, idempotencyKey: `register:${key}`, ...overrides,
  };
}

const describeAuthority = ADMIN_URL && APP_URL ? describe : describe.skip;
describeAuthority(RESTORE ? 'Auction inventory restored PostgreSQL authority' : 'Auction inventory PostgreSQL authority', () => {
  const admin = new PrismaService({ datasources: { db: { url: ADMIN_URL } } });
  let app: PrismaService;
  let rls: RlsTransactionService;
  let inventory: InventoryRepository;
  let commands: AuctionCommandService;
  let createdRuntimeRole: string | undefined;
  const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const raw = async (user: RequestUser, input: RegisterAuctionLotInput | Json): Promise<Receipt> => {
    const rows = await rls.withTrustedContext(user, async (tx) => {
      const result = await tx.$queryRaw<Array<{ result: Receipt }>>(Prisma.sql`
        SELECT auction.register_inventory_lot(${JSON.stringify({ ...input, commandId: `auction-command:${randomUUID()}` })}::jsonb) AS result`);
      await tx.$executeRaw(Prisma.sql`SET CONSTRAINTS ALL IMMEDIATE`);
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxConflictRetries: 0 });
    return rows[0]!.result;
  };
  const rawInventory = (user: RequestUser, command: InventoryCommand) => rls.withTrustedContext(user, (tx) => tx.$queryRaw(Prisma.sql`SELECT inventory.execute_command(${JSON.stringify(command)}::jsonb)`), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxConflictRetries: 0 });
  const declare = async (key: string, quantity = '100', profileVersionId = PROFILE_VERSION, unitCode = 'TON') => inventory.execute(seller, {
    ...common(`declare:${key}`), action: 'DECLARE', stockKey: `stock:${key}`, profileVersionId, sourceType: 'MANUAL', sourceReference: `own-register:${key}`, unitCode, quantity,
  });
  const release = (key: string, binding: Binding): InventoryCommand => ({
    ...common(`release:${key}`, binding.inventoryStateVersion), action: 'RELEASE', positionId: binding.positionId, reservationId: binding.reservationId,
  });
  const effects = async (positionId: string) => (await admin.$queryRaw<Array<Json>>(Prisma.sql`SELECT
    (SELECT to_jsonb(p) FROM inventory.positions p WHERE p.id=${positionId}) AS position,
    (SELECT count(*)::text FROM auction.lots WHERE tenant_id=${TENANT}) AS lots,
    (SELECT count(*)::text FROM auction.inventory_bindings WHERE tenant_id=${TENANT}) AS bindings,
    (SELECT count(*)::text FROM auction.command_receipts WHERE tenant_id=${TENANT}) AS receipts,
    (SELECT count(*)::text FROM inventory.reservations WHERE position_id=${positionId}) AS reservations,
    (SELECT count(*)::text FROM inventory.command_events WHERE position_id=${positionId}) AS inventory_events,
    (SELECT count(*)::text FROM inventory.availability_snapshots WHERE position_id=${positionId}) AS snapshots,
    (SELECT count(*)::text FROM public.audit_events WHERE "tenantId"=${TENANT}) AS audits,
    (SELECT count(*)::text FROM public.outbox_entries) AS outbox`))[0]!;
  const evidence = async (binding: Binding) => {
    const rows = await admin.$queryRaw<Array<Json>>(Prisma.sql`SELECT b.id,b.reservation_id,b.quantity_atoms::text,
      l.inventory_binding_id,l.source_verified_at,l.source_type,l.culture,
      r.quantity::text AS reservation_quantity,r.status AS reservation_status,
      p.reserved_quantity::text,p.confirmed_quantity::text,
      e.id AS inventory_event_id,e.receipt->'reservation'->>'id' AS event_reservation_id,
      (e.receipt->'position'=s.snapshot) AS snapshot_matches,
      (s.content_hash=encode(digest(convert_to(s.snapshot::text,'UTF8'),'sha256'),'hex')) AS snapshot_hash_matches,
      (io.payload->'receipt'=e.receipt) AS inventory_outbox_matches,
      (ia."afterState"=s.snapshot) AS inventory_audit_matches,
      aa."objectId" AS auction_audit_lot,ao.payload->>'lotId' AS auction_outbox_lot,
      cr.result->'binding'->>'id' AS receipt_binding_id
      FROM auction.inventory_bindings b JOIN auction.lots l ON l.id=b.lot_id
      JOIN inventory.reservations r ON r.id=b.reservation_id JOIN inventory.positions p ON p.id=b.inventory_position_id
      JOIN inventory.command_events e ON e.id=b.inventory_event_id JOIN inventory.availability_snapshots s ON s.id=e.snapshot_id
      JOIN public.audit_events ia ON ia.id=e.audit_id JOIN public.outbox_entries io ON io.id=e.outbox_id
      JOIN public.audit_events aa ON aa.id=b.auction_audit_id JOIN public.outbox_entries ao ON ao.id=b.auction_outbox_id
      JOIN auction.command_receipts cr ON cr.command_id=b.registration_command_id AND cr.command_type='REGISTER_LOT'
      WHERE b.id=${binding.id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: binding.id, reservation_id: binding.reservationId, quantity_atoms: binding.quantityAtoms,
      inventory_binding_id: binding.id, source_verified_at: null, source_type: 'OTHER', culture: CULTURE,
      reservation_quantity: binding.quantityAtoms, reservation_status: 'RESERVED', reserved_quantity: binding.quantityAtoms, confirmed_quantity: '0',
      event_reservation_id: binding.reservationId, snapshot_matches: true, snapshot_hash_matches: true,
      inventory_outbox_matches: true, inventory_audit_matches: true, receipt_binding_id: binding.id });
    expect(rows[0]!.auction_audit_lot).toBe(rows[0]!.auction_outbox_lot);
  };
  const confinement = async () => {
    const runtime = await app.$queryRaw<Array<Json>>(Prisma.sql`SELECT r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,
      (SELECT count(*)::text FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid) AS memberships,
      (SELECT count(*)::text FROM pg_class WHERE relowner=r.oid AND relnamespace IN ('auction'::regnamespace,'inventory'::regnamespace)) AS owned_tables
      FROM pg_roles r WHERE r.rolname=current_user`);
    expect(runtime).toEqual([{ rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, memberships: '0', owned_tables: '0' }]);
    const proof = await app.$queryRaw<Array<Json>>(Prisma.sql`SELECT
      p.prosecdef,pg_get_userbyid(p.proowner) AS owner,
      r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcreatedb,r.rolcreaterole,
      (SELECT count(*)::text FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid) AS memberships,
      c.relrowsecurity,c.relforcerowsecurity,
      has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS binding_write,
      has_function_privilege(current_user,${LEGACY_FUNCTION},'EXECUTE') AS legacy_execute
      FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
      JOIN pg_class c ON c.oid='auction.inventory_bindings'::regclass
      WHERE p.oid='auction.register_inventory_lot(jsonb)'::regprocedure`);
    expect(proof).toEqual([{ prosecdef: true, owner: 'pc_inventory_authority', rolcanlogin: false, rolsuper: false,
      rolbypassrls: false, rolinherit: false, rolcreatedb: false, rolcreaterole: false, memberships: '0', relrowsecurity: true, relforcerowsecurity: true,
      binding_write: false, legacy_execute: false }]);
    await expect(app.$executeRawUnsafe('SET ROLE pc_inventory_authority')).rejects.toBeDefined();
  };

  beforeAll(async () => {
    await admin.$connect();
    let runtimeUrl = EXPLICIT_APP_URL;
    if (!runtimeUrl) {
      // The generic industrial runner supplies its migration administrator as
      // DATABASE_URL. Exercise the same restricted proofs through a separate
      // connection, without changing that runner's environment or shared roles.
      const role = `auction_inventory_test_${randomUUID().replaceAll('-', '')}`;
      const password = randomUUID().replaceAll('-', '');
      await admin.$executeRawUnsafe(`CREATE ROLE ${quoteIdentifier(role)} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'`);
      createdRuntimeRole = role;
      const database = (await admin.$queryRaw<Array<{ name: string }>>(Prisma.sql`SELECT current_database() AS name`))[0]!.name;
      await admin.$executeRawUnsafe(`GRANT CONNECT ON DATABASE ${quoteIdentifier(database)} TO ${quoteIdentifier(role)}`);
      await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public,auction,inventory TO ${quoteIdentifier(role)}`);
      await admin.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA auction,inventory TO ${quoteIdentifier(role)}`);
      await admin.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION auction.register_inventory_lot(jsonb),inventory.execute_command(jsonb),inventory.position_view(inventory.positions) TO ${quoteIdentifier(role)}`);
      const url = new URL(ADMIN_URL);
      url.username = role;
      url.password = password;
      runtimeUrl = url.toString();
    }
    app = new PrismaService({ datasources: { db: { url: runtimeUrl } } });
    await app.$connect();
    rls = new RlsTransactionService(app);
    inventory = new InventoryRepository(rls);
    commands = new AuctionCommandService(rls, new FgisLegacyQuarantineAuditService(app));
    if (RESTORE) return;
    await admin.organization.createMany({ data: actors.filter((_user, index) => index !== 3).map((user, index) => ({
      id: user.orgId!, tenantId: user.tenantId!, inn: `980000010${index}`, name: `Auction inventory ${index}`,
      status: 'ACTIVE', kycStatus: 'APPROVED', amlStatus: 'CLEAR', sanctionHit: false,
    })) });
    await admin.user.createMany({ data: actors.map((user) => ({ id: user.id, email: user.email, fullName: 'Auction inventory acceptance', passwordHash: 'test-not-a-login-secret', status: 'ACTIVE' })) });
    await admin.userOrg.createMany({ data: actors.map((user) => ({ id: user.membershipId!, userId: user.id, organizationId: user.orgId!, role: user.role, status: 'ACTIVE', isOrgAdmin: user.isOrgAdmin })) });
    await seedProfile(admin, PROFILE_VERSION);
  });
  // Keep the committed corpus for pg_dump/pg_restore; no authority trigger is disabled.
  afterAll(async () => {
    try { await app?.$disconnect(); }
    finally {
      try {
        if (createdRuntimeRole) {
          const owned = await admin.$queryRaw<Array<{ objects: string }>>(Prisma.sql`SELECT (
            (SELECT count(*) FROM pg_class WHERE relowner=${createdRuntimeRole}::regrole)
            +(SELECT count(*) FROM pg_proc WHERE proowner=${createdRuntimeRole}::regrole)
            +(SELECT count(*) FROM pg_namespace WHERE nspowner=${createdRuntimeRole}::regrole)
          )::text AS objects`);
          expect(owned).toEqual([{ objects: '0' }]);
          // Only the uniquely created disposable role is removed. It owns no
          // objects, so DROP OWNED restores its temporary grants exclusively.
          await admin.$executeRawUnsafe(`DROP OWNED BY ${quoteIdentifier(createdRuntimeRole)}`);
          await admin.$executeRawUnsafe(`DROP ROLE ${quoteIdentifier(createdRuntimeRole)}`);
        }
      } finally { await admin.$disconnect(); }
    }
  });

  if (RESTORE) {
    it('restores confined binding authority with durable replay and held stock', async () => {
      await confinement();
      const keeper = await admin.$queryRaw<Array<{ result: Receipt; auction_ends_at: Date }>>(Prisma.sql`
        SELECT cr.result,l.auction_ends_at FROM auction.command_receipts cr
        JOIN auction.lots l ON l.id=cr.result->>'lotId'
        WHERE cr.tenant_id=${TENANT} AND cr.actor_id=${seller.id} AND cr.command_type='REGISTER_LOT' AND cr.idempotency_key=${RESTORE_KEY}`);
      expect(keeper).toHaveLength(1);
      const original = keeper[0]!.result;
      await evidence(original.binding);
      const before = await effects(original.binding.positionId);
      const replay = await raw(seller, registration('restore-survivor', original.binding.positionId, { auctionEndsAt: keeper[0]!.auction_ends_at.toISOString() }));
      expect(replay).toMatchObject({ lotId: original.lotId, duplicate: true, binding: original.binding,
        verificationStatus: 'DECLARED', tradePermission: 'PUBLIC_ALLOWED', independentVerification: null });
      await expect(rawInventory(seller, release('restored-denial', original.binding))).rejects.toThrow('AUCTION_BOUND_RESERVATION_RELEASE_DENIED');
      expect(await effects(original.binding.positionId)).toEqual(before);
      process.stdout.write('AUCTION_INVENTORY_RESTORE_AUTHORITY_PASS\n');
    });
    return;
  }

  it('confines the command owner and FORCE-RLS binding table', confinement);

  it('binds declared stock and complete immutable evidence without independent verification', async () => {
    const stock = await declare('restore-survivor');
    const result = await raw(seller, registration('restore-survivor', stock.position.positionId));
    expect(result).toMatchObject({ duplicate: false, bindingState: 'INVENTORY_BOUND', verificationStatus: 'DECLARED', tradePermission: 'PUBLIC_ALLOWED', independentVerification: null,
      binding: { positionId: stock.position.positionId, profileVersionId: PROFILE_VERSION, canonicalCode: CULTURE, quantityAtoms: '10000000', baseUnitCode: 'KG', baseUnitPrecision: 3, inventoryStateVersion: '2' } });
    await evidence(result.binding);
  });

  it('preserves exact quantity atoms above the JavaScript safe integer limit', async () => {
    const stock = await declare('exact-large', '9007199254.740993');
    const result = await raw(seller, registration('exact-large', stock.position.positionId, { quantity: '9007199254.740993', volumeTons: '9007199254.740993' }));
    expect(result.binding.quantityAtoms).toBe('9007199254740993');
    const exact = await admin.$queryRaw<Array<{ available: string; reserved: string }>>(Prisma.sql`SELECT available_quantity::text AS available,reserved_quantity::text AS reserved FROM inventory.positions WHERE id=${stock.position.positionId}`);
    expect(exact).toEqual([{ available: '0', reserved: '9007199254740993' }]);
  });

  it('serializes competing raw READ COMMITTED lots against one physical position', async () => {
    const stock = await declare('position-race');
    const results = await Promise.allSettled(['race-one', 'race-two'].map((key) => raw(seller, registration(key, stock.position.positionId, { quantity: '60', volumeTons: '60' }))));
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((item): item is PromiseRejectedResult => item.status === 'rejected');
    expect(String(rejected?.reason)).toContain('INVENTORY_STALE_VERSION');
    const rows = await admin.$queryRaw<Array<Json>>(Prisma.sql`SELECT p.available_quantity::text,p.reserved_quantity::text,p.state_version::text,
      (SELECT count(*)::text FROM auction.inventory_bindings b WHERE b.inventory_position_id=p.id) AS bindings,
      (SELECT count(*)::text FROM auction.command_receipts WHERE tenant_id=${TENANT} AND idempotency_key IN ('register:race-one','register:race-two')) AS receipts
      FROM inventory.positions p WHERE p.id=${stock.position.positionId}`);
    expect(rows).toEqual([{ available_quantity: '40000000', reserved_quantity: '60000000', state_version: '2', bindings: '1', receipts: '1' }]);
    const before = await effects(stock.position.positionId);
    await expect(raw(seller, registration('race-over-capacity', stock.position.positionId, { quantity: '60', volumeTons: '60', inventoryExpectedVersion: '2' }))).rejects.toThrow('INVENTORY_CAPACITY_EXCEEDED');
    expect(await effects(stock.position.positionId)).toEqual(before);
  });

  it('returns one effect for concurrent replay and rejects changed payloads', async () => {
    const stock = await declare('idempotency-race');
    const input = registration('idempotency-race', stock.position.positionId);
    const receipts = await Promise.all(Array.from({ length: 4 }, () => raw(seller, input)));
    expect(receipts.filter((item) => !item.duplicate)).toHaveLength(1);
    expect(new Set(receipts.map((item) => item.lotId)).size).toBe(1);
    expect(new Set(receipts.map((item) => item.binding.reservationId)).size).toBe(1);
    const before = await effects(stock.position.positionId);
    await expect(raw(seller, { ...input, quantity: '11', volumeTons: '11' })).rejects.toThrow('AUCTION_IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(await effects(stock.position.positionId)).toEqual(before);
  });

  it('rechecks the auction deadline after waiting for the inventory position lock', async () => {
    const stock = await declare('deadline-lock');
    const before = await effects(stock.position.positionId);
    let signalLocked!: () => void;
    let releaseLock!: () => void;
    const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
    const release = new Promise<void>((resolve) => { releaseLock = resolve; });
    const holder = admin.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM inventory.positions WHERE id=${stock.position.positionId} FOR UPDATE`);
      signalLocked();
      await release;
    }, { timeout: 15_000 });
    await Promise.race([locked, holder]);
    const deadline = Date.now() + 3_000;
    const pending = raw(seller, registration('deadline-lock', stock.position.positionId, { auctionEndsAt: new Date(deadline).toISOString() }))
      .then((value) => ({ value, error: null as unknown }), (error: unknown) => ({ value: null, error }));
    try {
      let observedWait = false;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const waiting = await admin.$queryRaw<Array<{ waiting: boolean }>>(Prisma.sql`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()
            AND wait_event_type='Lock' AND query LIKE '%auction.register_inventory_lot%'
        ) AS waiting`);
        if (waiting[0]?.waiting) { observedWait = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(observedWait).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, deadline - Date.now() + 100)));
      releaseLock();
      await holder;
      const outcome = await pending;
      expect(outcome.value).toBeNull();
      expect(String(outcome.error)).toContain('AUCTION_END_MUST_BE_FUTURE');
    } finally {
      releaseLock();
      await Promise.allSettled([holder, pending]);
    }
    expect(await effects(stock.position.positionId)).toEqual(before);
  });

  it('rejects stale versions and mismatched profile culture quantity and units atomically', async () => {
    const stock = await declare('mismatch');
    const before = await effects(stock.position.positionId);
    for (const [key, override] of [
      ['version', { inventoryExpectedVersion: '2' }], ['profile', { profileVersionId: 'unknown-profile-version' }],
      ['culture', { culture: 'BROWSER.INVENTED.CROP' }], ['quantity', { quantity: '11' }], ['unit', { unitCode: 'PACK' }],
    ] as const) {
      await expect(raw(seller, registration(`mismatch-${key}`, stock.position.positionId, override))).rejects.toBeDefined();
      expect(await effects(stock.position.positionId)).toEqual(before);
    }
    for (const field of ['tenantId', 'verified', 'tradePermission', 'confirmedQuantity']) {
      await expect(raw(seller, { ...registration(`raw-authority-${field}`, stock.position.positionId), [field]: 'forged' })).rejects.toBeDefined();
      expect(await effects(stock.position.positionId)).toEqual(before);
    }
  });

  it('denies foreign tenants outsiders and forged administrator claims', async () => {
    const stock = await declare('identity');
    const own = await raw(seller, registration('identity-visible', stock.position.positionId));
    const before = await effects(stock.position.positionId);
    for (const user of [foreign, outsider, { ...outsider, orgId: seller.orgId }, { ...seller, tenantId: foreign.tenantId }, { ...member, isOrgAdmin: true }]) {
      await expect(raw(user, registration(`identity-${randomUUID()}`, stock.position.positionId))).rejects.toBeDefined();
    }
    const visible = await rls.withTrustedContext(outsider, (tx) => tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM auction.inventory_bindings WHERE organization_id=${seller.orgId}`));
    expect(visible).toEqual([]);
    const buyerLots = await new AuctionAuthorityService(rls).listAccessibleLots(buyer);
    expect(buyerLots.items.find((item) => item.id === own.lotId)).toMatchObject({
      bindingState: 'INVENTORY_BOUND', binding: own.binding, verificationStatus: 'DECLARED',
      tradePermission: 'PUBLIC_ALLOWED', sourceVerifiedAt: null,
    });
    const privateStock = await rls.withTrustedContext(buyer, (tx) => tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT id FROM inventory.positions WHERE id=${stock.position.positionId}`));
    expect(privateStock).toEqual([]);
    expect(await effects(stock.position.positionId)).toEqual(before);
  });

  it('rechecks revoked membership before command and durable replay', async () => {
    const stock = await declare('membership-revoke');
    const input = registration('membership-revoke', stock.position.positionId);
    await raw(seller, input);
    const before = await effects(stock.position.positionId);
    await admin.userOrg.update({ where: { id: seller.membershipId }, data: { status: 'REVOKED' } });
    try {
      await expect(raw(seller, input)).rejects.toBeDefined();
      await expect(raw(seller, { ...input, idempotencyKey: 'register:after-membership-revoke', inventoryExpectedVersion: '2' })).rejects.toBeDefined();
    } finally { await admin.userOrg.update({ where: { id: seller.membershipId }, data: { status: 'ACTIVE' } }); }
    expect(await effects(stock.position.positionId)).toEqual(before);
  });

  it('rejects profile revocation without leaving a partial lot or reservation', async () => {
    const version = `${RUN}-revoked-version`;
    await seedProfile(admin, version);
    const stock = await declare('profile-revoke', '100', version);
    const before = await effects(stock.position.positionId);
    await admin.$executeRaw(Prisma.sql`UPDATE public.commodity_profile_versions SET status='REVOKED',version=version+1,
      "updatedAt"=greatest(clock_timestamp(),"updatedAt"+interval '1 millisecond') WHERE id=${version}`);
    await expect(raw(seller, registration('profile-revoke', stock.position.positionId, { profileVersionId: version }))).rejects.toThrow('INVENTORY_PROFILE_NOT_EFFECTIVE');
    expect(await effects(stock.position.positionId)).toEqual(before);
  });

  it('denies legacy registration even after accidental execute regrant', async () => {
    const stock = await declare('legacy-denial');
    const before = await effects(stock.position.positionId);
    const callLegacy = () => rls.withTrustedContext(seller, (tx) => tx.$queryRaw(Prisma.sql`SELECT auction.register_verified_lot(
      'Legacy bypass','TEST.AUCTION.INVENTORY',NULL,10::numeric,10000::bigint,100::bigint,'test',NULL,
      clock_timestamp()+interval '1 day','OTHER','own-register:legacy',NULL,false,10,10,'legacy-command','legacy-key')`));
    await expect(callLegacy()).rejects.toBeDefined();
    const runtime = (await app.$queryRaw<Array<{ role: string }>>(Prisma.sql`SELECT current_user AS role`))[0]!.role;
    const quoted = `"${runtime.replaceAll('"', '""')}"`;
    try {
      await admin.$executeRawUnsafe(`GRANT EXECUTE ON FUNCTION ${LEGACY_FUNCTION} TO ${quoted}`);
      await expect(callLegacy()).rejects.toThrow('AUCTION_INVENTORY_BINDING_REQUIRED');
    } finally { await admin.$executeRawUnsafe(`REVOKE EXECUTE ON FUNCTION ${LEGACY_FUNCTION} FROM ${quoted}`); }
    expect(await effects(stock.position.positionId)).toEqual(before);
  });

  it('denies direct binding mutation and release or reuse of active stock', async () => {
    const stock = await declare('binding-denial');
    const result = await raw(seller, registration('binding-denial', stock.position.positionId));
    const before = await effects(stock.position.positionId);
    await expect(rls.withTrustedContext(seller, (tx) => tx.$executeRaw(Prisma.sql`UPDATE auction.inventory_bindings SET quantity_atoms=1 WHERE id=${result.binding.id}`))).rejects.toBeDefined();
    await expect(rls.withTrustedContext(seller, (tx) => tx.$executeRaw(Prisma.sql`UPDATE auction.lots SET inventory_binding_id=NULL WHERE id=${result.lotId}`))).rejects.toBeDefined();
    await expect(rls.withTrustedContext(seller, (tx) => tx.$executeRaw(Prisma.sql`DELETE FROM inventory.command_events WHERE id=(SELECT inventory_event_id FROM auction.inventory_bindings WHERE id=${result.binding.id})`))).rejects.toBeDefined();
    await expect(rawInventory(seller, release('active', result.binding))).rejects.toThrow('AUCTION_BOUND_RESERVATION_RELEASE_DENIED');
    await expect(rawInventory(seller, { ...common('reserve:bound-again', '2'), action: 'RESERVE', positionId: result.binding.positionId, lotId: result.lotId, unitCode: 'TON', quantity: '1' })).rejects.toThrow('AUCTION_BOUND_RESERVATION_REUSE_DENIED');
    expect(await effects(stock.position.positionId)).toEqual(before);
  });

  it.each(['audit', 'outbox', 'binding'] as const)('rolls back lot inventory and receipts on %s insertion failure', async (kind) => {
    const stock = await declare(`rollback-${kind}`);
    const before = await effects(stock.position.positionId);
    const table = { audit: 'public.audit_events', outbox: 'public.outbox_entries', binding: 'auction.inventory_bindings' }[kind];
    const condition = kind === 'audit' ? "NEW.action = 'auction.lot.register'" : kind === 'outbox' ? "NEW.type = 'auction.lot.registered'" : 'true';
    await admin.$executeRawUnsafe(`CREATE FUNCTION auction.acceptance_binding_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'auction inventory acceptance forced failure'; END IF; RETURN NEW; END $$`);
    await admin.$executeRawUnsafe(`CREATE TRIGGER auction_inventory_acceptance_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION auction.acceptance_binding_failure()`);
    const input = registration(`rollback-${kind}`, stock.position.positionId);
    try { await expect(raw(seller, input)).rejects.toThrow('auction inventory acceptance forced failure'); }
    finally {
      await admin.$executeRawUnsafe(`DROP TRIGGER auction_inventory_acceptance_failure ON ${table}`);
      await admin.$executeRawUnsafe('DROP FUNCTION auction.acceptance_binding_failure()');
    }
    expect(await effects(stock.position.positionId)).toEqual(before);
    await evidence((await raw(seller, input)).binding);
  });

  it('rejects deferred evidence failure before the service acknowledges registration', async () => {
    const stock = await declare('deferred-failure');
    const before = await effects(stock.position.positionId);
    await admin.$executeRawUnsafe("CREATE FUNCTION auction.acceptance_binding_deferred() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'auction inventory deferred failure'; END $$");
    await admin.$executeRawUnsafe('CREATE CONSTRAINT TRIGGER auction_inventory_acceptance_deferred AFTER INSERT ON auction.inventory_bindings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION auction.acceptance_binding_deferred()');
    try { await expect(commands.registerLot(registration('deferred-failure', stock.position.positionId), seller)).rejects.toBeDefined(); }
    finally {
      await admin.$executeRawUnsafe('DROP TRIGGER auction_inventory_acceptance_deferred ON auction.inventory_bindings');
      await admin.$executeRawUnsafe('DROP FUNCTION auction.acceptance_binding_deferred()');
    }
    expect(await effects(stock.position.positionId)).toEqual(before);
  });

  it('executes HTTP registration against PostgreSQL and rejects caller authority fields', async () => {
    const stock = await declare('http');
    const moduleRef = await Test.createTestingModule({ controllers: [AuctionsController], providers: [
      { provide: AuctionCommandService, useValue: commands },
      { provide: AuctionAuthorityService, useValue: new AuctionAuthorityService(rls) },
    ] }).compile();
    const http: INestApplication = moduleRef.createNestApplication();
    http.use((req: { user?: RequestUser }, _res: unknown, next: () => void) => { req.user = seller; next(); });
    http.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
    http.setGlobalPrefix('api');
    await http.init();
    try {
      const input = registration('http', stock.position.positionId);
      const before = await effects(stock.position.positionId);
      for (const field of ['tenantId', 'verified', 'tradePermission', 'commandId']) {
        await request(http.getHttpServer()).post('/api/auctions/lots').send({ ...input, [field]: 'forged' }).expect(422);
      }
      await request(http.getHttpServer()).post('/api/auctions/lots').send({ ...input, quantity: 10 }).expect(400);
      expect(await effects(stock.position.positionId)).toEqual(before);
      const response = await request(http.getHttpServer()).post('/api/auctions/lots').send(input).expect(201);
      expect(response.body).toMatchObject({ bindingState: 'INVENTORY_BOUND', verificationStatus: 'DECLARED', tradePermission: 'PUBLIC_ALLOWED', independentVerification: null });
      await evidence(response.body.binding as Binding);
    } finally { await http.close(); }
  });
});

async function seedProfile(admin: PrismaService, versionId: string): Promise<void> {
  const profileId = `${versionId}-profile`;
  const content = { canonicalCode: CULTURE, units, qualityIndicators: [] };
  await admin.commodityProfile.create({ data: { id: profileId, canonicalCode: `TEST.AUCTION.${randomUUID().replaceAll('-', '').toUpperCase()}`, archetype: 'DRY_BULK', authoritativeNameRu: 'Тестовая партия аукциона', createdByUserId: seller.id, updatedByUserId: seller.id } });
  await admin.commodityProfileVersion.create({ data: { id: versionId, profileId, sequence: 1, content, contentHash: createHash('sha256').update(JSON.stringify(content)).digest('hex'), createdByUserId: seller.id, updatedByUserId: seller.id } });
  for (const status of ['REVIEW', 'APPROVED', 'EFFECTIVE']) {
    await admin.$executeRaw(Prisma.sql`UPDATE public.commodity_profile_versions SET status=${status},version=version+1,
      "approvedByUserId"=${seller.id},"approvedAt"=clock_timestamp(),"approvalReason"='Isolated auction inventory acceptance',
      "effectiveFrom"=clock_timestamp()-interval '1 minute',"updatedAt"=greatest(clock_timestamp(),"updatedAt"+interval '1 millisecond') WHERE id=${versionId}`);
  }
}

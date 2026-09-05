import { ConflictException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import {
  serviceMarketplaceDigest,
  type ServiceMarketplaceCommand,
} from '../../src/modules/service-marketplace/service-marketplace.contract';
import { ServiceMarketplaceRepository } from '../../src/modules/service-marketplace/service-marketplace.repository';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? '');
const APP_URL = String(process.env.ONE_DEAL_APP_URL ?? '');
const RUN_ID = `service-marketplace-${randomUUID()}`;
const TENANT = `${RUN_ID}-tenant`;
const OTHER_TENANT = `${RUN_ID}-other-tenant`;
const REQUESTER_ORG = `${RUN_ID}-requester-org`;
const PROVIDER_ORG = `${RUN_ID}-provider-org`;
const ALT_PROVIDER_ORG = `${RUN_ID}-alt-provider-org`;
const PAYER_ORG = `${RUN_ID}-payer-org`;
const OUTSIDER_ORG = `${RUN_ID}-outsider-org`;
const OTHER_ORG = `${RUN_ID}-other-org`;
const REQUESTER_USER = `${RUN_ID}-requester-user`;
const PROVIDER_USER = `${RUN_ID}-provider-user`;
const ALT_PROVIDER_USER = `${RUN_ID}-alt-provider-user`;
const PAYER_USER = `${RUN_ID}-payer-user`;
const OUTSIDER_USER = `${RUN_ID}-outsider-user`;
const OTHER_USER = `${RUN_ID}-other-user`;
const REQUESTER_MEMBERSHIP = `${RUN_ID}-requester-membership`;
const PROVIDER_MEMBERSHIP = `${RUN_ID}-provider-membership`;
const ALT_PROVIDER_MEMBERSHIP = `${RUN_ID}-alt-provider-membership`;
const PAYER_MEMBERSHIP = `${RUN_ID}-payer-membership`;
const OUTSIDER_MEMBERSHIP = `${RUN_ID}-outsider-membership`;
const OTHER_MEMBERSHIP = `${RUN_ID}-other-membership`;
const PROVIDER_ID = `${RUN_ID}-provider`;
const CAPABILITY_ID = `${RUN_ID}-capability`;
const OFFERING_ID = `${RUN_ID}-offering`;
const ALT_PROVIDER_ID = `${RUN_ID}-alt-provider`;
const ALT_CAPABILITY_ID = `${RUN_ID}-alt-capability`;
const ALT_OFFERING_ID = `${RUN_ID}-alt-offering`;

function actor(
  id: string,
  orgId: string,
  tenantId: string,
  membershipId: string,
  role: Role,
): RequestUser {
  return {
    id,
    email: `${id}@industrial.test`,
    role,
    orgId,
    tenantId,
    membershipId,
    isOrgAdmin: role === Role.ADMIN,
    sessionId: `${id}-session`,
  };
}

const requester = actor(REQUESTER_USER, REQUESTER_ORG, TENANT, REQUESTER_MEMBERSHIP, Role.BUYER);
const provider = actor(PROVIDER_USER, PROVIDER_ORG, TENANT, PROVIDER_MEMBERSHIP, Role.LOGISTICIAN);
const altProvider = actor(
  ALT_PROVIDER_USER, ALT_PROVIDER_ORG, TENANT, ALT_PROVIDER_MEMBERSHIP, Role.LOGISTICIAN,
);
const payer = actor(PAYER_USER, PAYER_ORG, TENANT, PAYER_MEMBERSHIP, Role.ACCOUNTING);
const outsider = actor(OUTSIDER_USER, OUTSIDER_ORG, TENANT, OUTSIDER_MEMBERSHIP, Role.ADMIN);
const otherTenant = actor(OTHER_USER, OTHER_ORG, OTHER_TENANT, OTHER_MEMBERSHIP, Role.ADMIN);

function base(
  requestId: string,
  action: ServiceMarketplaceCommand['action'],
  expectedStateVersion: string,
  suffix: string,
) {
  return {
    requestId,
    action,
    commandId: `${RUN_ID}-command-${suffix}`,
    idempotencyKey: `${RUN_ID}-idempotency-${suffix}`,
    correlationId: `${RUN_ID}-correlation-${suffix}`,
    expectedStateVersion,
    reason: `Service marketplace acceptance command for ${suffix}.`,
  } as const;
}

function createRequest(requestId: string, suffix: string): ServiceMarketplaceCommand {
  return {
    ...base(requestId, 'CREATE_REQUEST', '0', suffix),
    action: 'CREATE_REQUEST',
    category: 'LOGISTICS',
    serviceStage: 'DISPATCH',
    subjectType: 'DEAL',
    subjectId: `${RUN_ID}-deal-${suffix}`,
    description: `Controlled logistics request used by the industrial ${suffix} scenario.`,
    targetRegion: 'Tambov region',
  };
}

function deterministicId(prefix: string, material: string): string {
  return `${prefix}-${serviceMarketplaceDigest(material).slice(0, 32)}`;
}

const describeAuthority = ADMIN_URL && APP_URL ? describe : describe.skip;

describeAuthority('Service Marketplace PostgreSQL authority', () => {
  const admin = new PrismaService({ datasources: { db: { url: ADMIN_URL } } });
  const app = new PrismaService({ datasources: { db: { url: APP_URL } } });
  const rls = new RlsTransactionService(app);
  const marketplace = new ServiceMarketplaceRepository(rls);

  beforeAll(async () => {
    await Promise.all([admin.$connect(), app.$connect()]);
    const seed = Date.now().toString().slice(-7);
    await admin.organization.createMany({ data: [
      { id: REQUESTER_ORG, tenantId: TENANT, inn: `71${seed}1`, name: 'Marketplace requester', status: 'ACTIVE' },
      { id: PROVIDER_ORG, tenantId: TENANT, inn: `72${seed}2`, name: 'Marketplace provider', status: 'ACTIVE' },
      { id: ALT_PROVIDER_ORG, tenantId: TENANT, inn: `76${seed}6`, name: 'Marketplace alternate provider', status: 'ACTIVE' },
      { id: PAYER_ORG, tenantId: TENANT, inn: `73${seed}3`, name: 'Marketplace payer', status: 'ACTIVE' },
      { id: OUTSIDER_ORG, tenantId: TENANT, inn: `74${seed}4`, name: 'Marketplace outsider', status: 'ACTIVE' },
      { id: OTHER_ORG, tenantId: OTHER_TENANT, inn: `75${seed}5`, name: 'Marketplace other tenant', status: 'ACTIVE' },
    ] });
    await admin.user.createMany({ data: [requester, provider, altProvider, payer, outsider, otherTenant].map((entry) => ({
      id: entry.id,
      email: entry.email,
      passwordHash: 'industrial-not-a-login-secret',
      fullName: `Marketplace ${entry.role}`,
    })) });
    await admin.userOrg.createMany({ data: [
      { id: REQUESTER_MEMBERSHIP, userId: REQUESTER_USER, organizationId: REQUESTER_ORG, role: Role.BUYER, status: 'ACTIVE' },
      { id: PROVIDER_MEMBERSHIP, userId: PROVIDER_USER, organizationId: PROVIDER_ORG, role: Role.LOGISTICIAN, status: 'ACTIVE' },
      { id: ALT_PROVIDER_MEMBERSHIP, userId: ALT_PROVIDER_USER, organizationId: ALT_PROVIDER_ORG, role: Role.LOGISTICIAN, status: 'ACTIVE' },
      { id: PAYER_MEMBERSHIP, userId: PAYER_USER, organizationId: PAYER_ORG, role: Role.ACCOUNTING, status: 'ACTIVE' },
      { id: OUTSIDER_MEMBERSHIP, userId: OUTSIDER_USER, organizationId: OUTSIDER_ORG, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
      { id: OTHER_MEMBERSHIP, userId: OTHER_USER, organizationId: OTHER_ORG, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
    ] });
    // These are staff-verified upstream facts, not marketplace commands. The
    // fixture seeds them through the migration principal while replication
    // triggers are locally disabled; the marketplace runtime remains confined.
    await admin.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await tx.provider.create({ data: {
        id: PROVIDER_ID,
        tenantId: TENANT,
        organizationId: PROVIDER_ORG,
        status: 'ACTIVE',
        createdByMembershipId: PROVIDER_MEMBERSHIP,
        updatedByMembershipId: PROVIDER_MEMBERSHIP,
      } });
      await tx.providerCapability.create({ data: {
        id: CAPABILITY_ID,
        tenantId: TENANT,
        organizationId: PROVIDER_ORG,
        providerId: PROVIDER_ID,
        category: 'LOGISTICS',
        legalRole: 'carrier',
        status: 'ACTIVE',
        effectiveFrom: new Date(Date.now() - 1_000),
        createdByMembershipId: PROVIDER_MEMBERSHIP,
        updatedByMembershipId: PROVIDER_MEMBERSHIP,
      } });
      await tx.serviceOffering.create({ data: {
        id: OFFERING_ID,
        tenantId: TENANT,
        organizationId: PROVIDER_ORG,
        providerId: PROVIDER_ID,
        capabilityId: CAPABILITY_ID,
        offeringKey: 'industrial-logistics',
        category: 'LOGISTICS',
        title: 'Industrial logistics',
        description: 'Active logistics offering for service marketplace authority tests.',
        regions: ['Tambov region'],
        cultures: ['WHEAT'],
        stages: ['DISPATCH'],
        status: 'ACTIVE',
        createdByMembershipId: PROVIDER_MEMBERSHIP,
        updatedByMembershipId: PROVIDER_MEMBERSHIP,
      } });
      await tx.provider.create({ data: {
        id: ALT_PROVIDER_ID,
        tenantId: TENANT,
        organizationId: ALT_PROVIDER_ORG,
        status: 'ACTIVE',
        createdByMembershipId: ALT_PROVIDER_MEMBERSHIP,
        updatedByMembershipId: ALT_PROVIDER_MEMBERSHIP,
      } });
      await tx.providerCapability.create({ data: {
        id: ALT_CAPABILITY_ID,
        tenantId: TENANT,
        organizationId: ALT_PROVIDER_ORG,
        providerId: ALT_PROVIDER_ID,
        category: 'LOGISTICS',
        legalRole: 'carrier',
        status: 'ACTIVE',
        effectiveFrom: new Date(Date.now() - 1_000),
        createdByMembershipId: ALT_PROVIDER_MEMBERSHIP,
        updatedByMembershipId: ALT_PROVIDER_MEMBERSHIP,
      } });
      await tx.serviceOffering.create({ data: {
        id: ALT_OFFERING_ID,
        tenantId: TENANT,
        organizationId: ALT_PROVIDER_ORG,
        providerId: ALT_PROVIDER_ID,
        capabilityId: ALT_CAPABILITY_ID,
        offeringKey: 'industrial-logistics-alternate',
        category: 'LOGISTICS',
        title: 'Industrial logistics alternate',
        description: 'Alternate active logistics offering for replay authority tests.',
        regions: ['Tambov region'],
        cultures: ['WHEAT'],
        stages: ['DISPATCH'],
        status: 'ACTIVE',
        createdByMembershipId: ALT_PROVIDER_MEMBERSHIP,
        updatedByMembershipId: ALT_PROVIDER_MEMBERSHIP,
      } });
    });
  });

  afterAll(async () => {
    if (ADMIN_URL) {
      await admin.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
        for (const table of [
          'service_marketplace_events', 'service_marketplace_quotes', 'service_marketplace_requests',
          'service_offerings', 'provider_capabilities', 'providers',
        ]) {
          await tx.$executeRawUnsafe(`DELETE FROM public."${table}" WHERE "tenantId" IN ('${TENANT}', '${OTHER_TENANT}')`);
        }
      });
      await admin.outboxEntry.deleteMany({ where: { correlationId: { startsWith: RUN_ID } } });
      await admin.auditEvent.deleteMany({ where: { correlationId: { startsWith: RUN_ID } } });
      await admin.userOrg.deleteMany({ where: { id: { in: [
        REQUESTER_MEMBERSHIP, PROVIDER_MEMBERSHIP, ALT_PROVIDER_MEMBERSHIP,
        PAYER_MEMBERSHIP, OUTSIDER_MEMBERSHIP, OTHER_MEMBERSHIP,
      ] } } });
      await admin.user.deleteMany({ where: { id: { in: [
        REQUESTER_USER, PROVIDER_USER, ALT_PROVIDER_USER, PAYER_USER, OUTSIDER_USER, OTHER_USER,
      ] } } });
      await admin.organization.deleteMany({ where: { id: { in: [
        REQUESTER_ORG, PROVIDER_ORG, ALT_PROVIDER_ORG, PAYER_ORG, OUTSIDER_ORG, OTHER_ORG,
      ] } } });
    }
    await Promise.allSettled([admin.$disconnect(), app.$disconnect()]);
  });

  it('forces RLS and removes destructive runtime privileges', async () => {
    const authority = await app.$queryRaw<Array<{
      table_name: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>>(Prisma.sql`
      SELECT relname AS table_name, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE oid IN ('public.service_marketplace_requests'::regclass,
         'public.service_marketplace_quotes'::regclass, 'public.service_marketplace_events'::regclass)
       ORDER BY relname
    `);
    expect(authority).toHaveLength(3);
    expect(authority.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
    const grants = await app.$queryRaw<Array<{ eventUpdate: boolean; requestDelete: boolean; quoteUpdate: boolean }>>(Prisma.sql`
      SELECT has_table_privilege(current_user, 'public.service_marketplace_events', 'UPDATE') AS "eventUpdate",
        has_table_privilege(current_user, 'public.service_marketplace_requests', 'DELETE') AS "requestDelete",
        has_table_privilege(current_user, 'public.service_marketplace_quotes', 'UPDATE') AS "quoteUpdate"
    `);
    expect(grants[0]).toEqual({ eventUpdate: false, requestDelete: false, quoteUpdate: false });
  });

  it('executes the complete lifecycle with separate payer consent and non-financial settlement', async () => {
    const requestId = `${RUN_ID}-request-complete`;
    const create = createRequest(requestId, 'complete');
    expect(await marketplace.execute(requester, create)).toMatchObject({
      requestId,
      status: 'REQUESTED',
      stateVersion: '1',
      createsFinancialObligation: false,
      replayed: false,
    });
    expect(await marketplace.execute(requester, create)).toMatchObject({ replayed: true, stateVersion: '1' });
    expect((await marketplace.listOwn(payer)).items).toEqual([]);

    const quoteId = `${RUN_ID}-quote-complete`;
    expect(await marketplace.execute(provider, {
      ...base(requestId, 'SUBMIT_QUOTE', '1', 'quote'),
      action: 'SUBMIT_QUOTE',
      quoteId,
      serviceOfferingId: OFFERING_ID,
      serviceOfferingVersion: '1',
      quoteType: 'MANUAL_QUOTE',
      commercialDecisionId: null,
      amountKopecks: '125000',
      currency: 'RUB',
      payerMode: 'REQUIRES_CONFIRMATION',
      termsHash: serviceMarketplaceDigest({ scope: 'transport', price: '125000' }),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })).toMatchObject({ status: 'QUOTED', stateVersion: '2', quoteId });
    await expect(marketplace.listSelectableQuotes(outsider, requestId))
      .rejects.toMatchObject({ response: { code: 'SERVICE_MARKETPLACE_REQUEST_NOT_FOUND' } });
    expect(await marketplace.listSelectableQuotes(requester, requestId)).toMatchObject({
      requestId,
      requestStatus: 'QUOTED',
      stateVersion: '2',
      authority: 'POSTGRESQL',
      items: [{
        id: quoteId,
        providerOrganizationId: PROVIDER_ORG,
        serviceOfferingId: OFFERING_ID,
        amountKopecks: '125000',
        currency: 'RUB',
      }],
    });

    await expect(marketplace.execute(provider, {
      ...base(requestId, 'SELECT_PROVIDER', '2', 'forged-selection'), action: 'SELECT_PROVIDER', quoteId,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(await marketplace.execute(requester, {
      ...base(requestId, 'SELECT_PROVIDER', '2', 'selection'), action: 'SELECT_PROVIDER', quoteId,
    })).toMatchObject({ status: 'PROVIDER_SELECTED', stateVersion: '3', quoteId });

    const payerAssignmentId = `${RUN_ID}-payer-assignment`;
    expect(await marketplace.execute(requester, {
      ...base(requestId, 'ASSIGN_PAYER', '3', 'assign-payer'), action: 'ASSIGN_PAYER', payerAssignmentId,
      payerOrganizationId: PAYER_ORG, payerMembershipId: PAYER_MEMBERSHIP,
    })).toMatchObject({ status: 'PAYER_ASSIGNED', stateVersion: '4', payerAssignmentId });
    await expect(marketplace.execute(requester, {
      ...base(requestId, 'CONFIRM_PAYER', '4', 'forged-confirmation'), action: 'CONFIRM_PAYER', payerAssignmentId,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(await marketplace.execute(payer, {
      ...base(requestId, 'CONFIRM_PAYER', '4', 'payer-confirmation'), action: 'CONFIRM_PAYER', payerAssignmentId,
    })).toMatchObject({ status: 'PAYER_CONFIRMED', stateVersion: '5' });
    expect((await marketplace.listOwn(payer)).items).toHaveLength(1);

    expect(await marketplace.execute(provider, {
      ...base(requestId, 'START_EXECUTION', '5', 'execution'), action: 'START_EXECUTION',
      executionReference: `${RUN_ID}/execution/1`,
    })).toMatchObject({ status: 'EXECUTING', stateVersion: '6' });
    expect(await marketplace.execute(provider, {
      ...base(requestId, 'SUBMIT_EVIDENCE', '6', 'evidence'), action: 'SUBMIT_EVIDENCE',
      evidenceReference: `${RUN_ID}/evidence/1`, evidenceHash: serviceMarketplaceDigest({ proof: 'delivery' }),
    })).toMatchObject({ status: 'EVIDENCE_SUBMITTED', stateVersion: '7' });
    expect(await marketplace.execute(requester, {
      ...base(requestId, 'ACCEPT_SERVICE', '7', 'acceptance'), action: 'ACCEPT_SERVICE',
      acceptanceNote: 'Service evidence was reviewed and accepted by the requester.',
    })).toMatchObject({ status: 'ACCEPTED', stateVersion: '8' });
    const settled = await marketplace.execute(payer, {
      ...base(requestId, 'RECORD_SETTLEMENT', '8', 'settlement'), action: 'RECORD_SETTLEMENT',
      settlementReferenceType: 'LEDGER_PENDING', settlementReference: `${RUN_ID}/ledger/pending/1`,
    });
    expect(settled).toMatchObject({
      status: 'SETTLEMENT_RECORDED', stateVersion: '9', createsFinancialObligation: false,
    });

    const evidence = await admin.$queryRaw<Array<{ events: bigint; audits: bigint; outbox: bigint; nonfinancial: boolean }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."service_marketplace_events" WHERE "requestId" = ${requestId})::bigint AS events,
        (SELECT count(*) FROM public."audit_events" WHERE "objectId" = ${requestId})::bigint AS audits,
        (SELECT count(*) FROM public."outbox_entries" WHERE "correlationId" LIKE ${`${RUN_ID}%`}
          AND "payload" #>> '{event,requestId}' = ${requestId})::bigint AS outbox,
        NOT (SELECT "createsFinancialObligation" FROM public."service_marketplace_requests" WHERE "id" = ${requestId}) AS nonfinancial
    `);
    expect(evidence[0]).toEqual({ events: 9n, audits: 9n, outbox: 9n, nonfinancial: true });
  });

  it('isolates same-tenant outsiders and other tenants', async () => {
    const requestId = `${RUN_ID}-request-isolation`;
    await marketplace.execute(requester, createRequest(requestId, 'isolation'));
    expect((await marketplace.listOwn(outsider)).items).toEqual([]);
    expect((await marketplace.listOwn(otherTenant)).items).toEqual([]);
    await expect(marketplace.execute(outsider, {
      ...base(requestId, 'ASSIGN_PAYER', '1', 'outsider'), action: 'ASSIGN_PAYER',
      payerAssignmentId: `${RUN_ID}-forged-assignment`, payerOrganizationId: OUTSIDER_ORG,
      payerMembershipId: OUTSIDER_MEMBERSHIP,
    })).rejects.toMatchObject({ response: { code: 'SERVICE_MARKETPLACE_REQUEST_NOT_FOUND' } });
  });

  it('rejects stale races, payload-changing replay, and expired quotes', async () => {
    const requestId = `${RUN_ID}-request-race`;
    const create = createRequest(requestId, 'race');
    await marketplace.execute(requester, create);
    await expect(marketplace.execute(requester, { ...create, description: 'A different idempotent payload must never replay successfully.' }))
      .rejects.toBeInstanceOf(ConflictException);
    const quote = (targetRequestId: string, suffix: string, quoteId: string, expiresAt: string): ServiceMarketplaceCommand => ({
      ...base(targetRequestId, 'SUBMIT_QUOTE', '1', suffix), action: 'SUBMIT_QUOTE', quoteId,
      serviceOfferingId: OFFERING_ID, serviceOfferingVersion: '1', quoteType: 'MANUAL_QUOTE', commercialDecisionId: null,
      amountKopecks: '9000', currency: 'RUB', payerMode: 'BUYER',
      termsHash: serviceMarketplaceDigest({ suffix }), expiresAt,
    });
    const first = quote(requestId, 'race-a', `${RUN_ID}-quote-race-a`, new Date(Date.now() + 3_600_000).toISOString());
    const second = quote(requestId, 'race-b', `${RUN_ID}-quote-race-b`, new Date(Date.now() + 3_600_000).toISOString());
    const results = await Promise.allSettled([
      marketplace.execute(provider, first), marketplace.execute(provider, second),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason)
      .toBeInstanceOf(ConflictException);

    const expiredRequestId = `${RUN_ID}-request-expired`;
    await marketplace.execute(requester, createRequest(expiredRequestId, 'expired'));
    await expect(marketplace.execute(provider, quote(
      expiredRequestId, 'expired', `${RUN_ID}-quote-expired`, new Date(Date.now() - 1_000).toISOString(),
    ))).rejects.toBeDefined();
  });

  it('preserves exact replay for a provider whose quote was not selected', async () => {
    const requestId = `${RUN_ID}-request-losing-provider-replay`;
    await marketplace.execute(requester, createRequest(requestId, 'losing-provider-replay'));
    const losing = {
      ...base(requestId, 'SUBMIT_QUOTE', '1', 'losing-provider-quote'),
      action: 'SUBMIT_QUOTE' as const,
      quoteId: `${RUN_ID}-quote-losing-provider`,
      serviceOfferingId: OFFERING_ID,
      serviceOfferingVersion: '1',
      quoteType: 'MANUAL_QUOTE' as const,
      commercialDecisionId: null,
      amountKopecks: '125000',
      currency: 'RUB' as const,
      payerMode: 'BUYER',
      termsHash: serviceMarketplaceDigest({ provider: 'losing' }),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    await marketplace.execute(provider, losing);
    const selectedQuoteId = `${RUN_ID}-quote-selected-provider`;
    await marketplace.execute(altProvider, {
      ...base(requestId, 'SUBMIT_QUOTE', '2', 'selected-provider-quote'),
      action: 'SUBMIT_QUOTE',
      quoteId: selectedQuoteId,
      serviceOfferingId: ALT_OFFERING_ID,
      serviceOfferingVersion: '1',
      quoteType: 'MANUAL_QUOTE',
      commercialDecisionId: null,
      amountKopecks: '115000',
      currency: 'RUB',
      payerMode: 'BUYER',
      termsHash: serviceMarketplaceDigest({ provider: 'selected' }),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect((await marketplace.listSelectableQuotes(requester, requestId)).items.map((quote) => quote.id))
      .toEqual([selectedQuoteId, losing.quoteId]);
    await marketplace.execute(requester, {
      ...base(requestId, 'SELECT_PROVIDER', '3', 'select-alternate-provider'),
      action: 'SELECT_PROVIDER',
      quoteId: selectedQuoteId,
    });
    await expect(marketplace.execute(provider, losing)).resolves.toMatchObject({
      requestId,
      status: 'QUOTED',
      stateVersion: '2',
      quoteId: losing.quoteId,
      replayed: true,
    });
  });

  it('rolls back request, audit and event when outbox evidence is absent', async () => {
    const incomplete = new ServiceMarketplaceRepository({
      withTrustedContext: (user: RequestUser, work: Parameters<RlsTransactionService['withTrustedContext']>[1]) =>
        rls.withTrustedContext(user, (tx, context) => work(new Proxy(tx, {
          get(target, property) {
            if (property === '$executeRaw') return (query: Prisma.Sql) =>
              query.sql.includes('INSERT INTO public."outbox_entries"') ? Promise.resolve(1) : target.$executeRaw(query);
            return Reflect.get(target, property);
          },
        }), context)),
    } as RlsTransactionService);
    const command = createRequest(`${RUN_ID}-request-missing-outbox`, 'missing-outbox');
    await expect(incomplete.execute(requester, command)).rejects.toMatchObject({
      response: { code: 'PC_SERVICE_REQUEST_EVIDENCE_REQUIRED' },
    });
    const persisted = await admin.$queryRaw<Array<{ requests: bigint; events: bigint; audits: bigint }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."service_marketplace_requests" WHERE "id" = ${command.requestId})::bigint AS requests,
        (SELECT count(*) FROM public."service_marketplace_events" WHERE "commandId" = ${command.commandId})::bigint AS events,
        (SELECT count(*) FROM public."audit_events" WHERE "correlationId" = ${command.correlationId})::bigint AS audits
    `);
    expect(persisted[0]).toEqual({ requests: 0n, events: 0n, audits: 0n });
  });

  it('rolls back atomically when the outbox identifier conflicts', async () => {
    const command = createRequest(`${RUN_ID}-request-atomic`, 'atomic');
    const identity = `${TENANT}:${REQUESTER_ORG}:${command.commandId}`;
    await admin.outboxEntry.create({ data: {
      id: deterministicId('outbox-service-marketplace', identity),
      type: 'industrial.atomicity.sentinel',
      payload: { runId: RUN_ID },
      status: 'PENDING',
      correlationId: command.correlationId,
      nextRetryAt: new Date(),
    } });
    await expect(marketplace.execute(requester, command)).rejects.toBeDefined();
    const counts = await admin.$queryRaw<Array<{ requests: bigint; events: bigint }>>(Prisma.sql`
      SELECT
        (SELECT count(*) FROM public."service_marketplace_requests" WHERE "id" = ${command.requestId})::bigint AS requests,
        (SELECT count(*) FROM public."service_marketplace_events" WHERE "commandId" = ${command.commandId})::bigint AS events
    `);
    expect(counts[0]).toEqual({ requests: 0n, events: 0n });
    expect(await admin.auditEvent.count({ where: { correlationId: command.correlationId } })).toBe(0);
  });

  it('rejects direct lifecycle mutation without command evidence', async () => {
    const forgedRequestId = `${RUN_ID}-request-prefilled`;
    await expect(rls.withTrustedContext(requester, async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT set_config('app.current_command_id', ${`${RUN_ID}-prefilled-command`}, true),
               set_config('app.current_service_marketplace_action', 'CREATE_REQUEST', true)
      `);
      return tx.$executeRaw(Prisma.sql`
        INSERT INTO public."service_marketplace_requests" (
          "id", "tenantId", "requesterOrganizationId", "category", "serviceStage", "subjectType",
          "subjectId", "description", "executionReference", "createdByMembershipId",
          "updatedByMembershipId", "updatedByOrganizationId"
        ) VALUES (
          ${forgedRequestId}, ${TENANT}, ${REQUESTER_ORG}, 'LOGISTICS', 'DISPATCH', 'DEAL',
          ${`${RUN_ID}-deal-prefilled`}, 'A direct request with prefilled future state must fail.',
          ${`${RUN_ID}/forged/execution`}, ${REQUESTER_MEMBERSHIP}, ${REQUESTER_MEMBERSHIP}, ${REQUESTER_ORG}
        )
      `);
    })).rejects.toThrow(/service_request_execution_shape_check/);

    const requestId = `${RUN_ID}-request-direct-mutation`;
    await marketplace.execute(requester, createRequest(requestId, 'direct-mutation'));
    await expect(rls.withTrustedContext(requester, async (tx) => tx.$executeRaw(Prisma.sql`
      UPDATE public."service_marketplace_requests" SET "status" = 'QUOTED', "stateVersion" = 2,
        "updatedAt" = clock_timestamp(), "updatedByMembershipId" = ${REQUESTER_MEMBERSHIP},
        "updatedByOrganizationId" = ${REQUESTER_ORG} WHERE "id" = ${requestId}
    `))).rejects.toThrow(/PC_SERVICE_/);
    const rows = await admin.$queryRaw<Array<{ status: string; stateVersion: bigint; createsFinancialObligation: boolean }>>(Prisma.sql`
      SELECT "status", "stateVersion", "createsFinancialObligation"
        FROM public."service_marketplace_requests" WHERE "id" = ${requestId}
    `);
    expect(rows[0]).toEqual({ status: 'REQUESTED', stateVersion: 1n, createsFinancialObligation: false });
  });
});

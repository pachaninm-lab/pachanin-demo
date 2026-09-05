import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RlsTransactionService } from '../../src/common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../src/common/types/request-user';
import {
  commercialDigest,
  type CommercialRuleCommand,
} from '../../src/modules/commercial-rules/commercial-rules.contract';
import { CommercialRulesRepository } from '../../src/modules/commercial-rules/commercial-rules.repository';
import {
  evaluateCommercialRule,
  type CommercialRuleDefinition,
  type CommercialEvaluationFacts,
} from '../../../../packages/domain-core/src';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? '');
const APP_URL = String(process.env.ONE_DEAL_APP_URL ?? '');
const RUN_ID = `commercial-rules-${randomUUID()}`;
const TENANT_A = `${RUN_ID}-tenant-a`;
const TENANT_B = `${RUN_ID}-tenant-b`;
const ORG_A = `${RUN_ID}-org-a`;
const ORG_B = `${RUN_ID}-org-b`;
const ORG_C = `${RUN_ID}-org-c`;
const USER_A = `${RUN_ID}-user-a`;
const USER_B = `${RUN_ID}-user-b`;
const USER_C = `${RUN_ID}-user-c`;
const USER_D = `${RUN_ID}-user-d`;
const MEMBERSHIP_A = `${RUN_ID}-membership-a`;
const MEMBERSHIP_B = `${RUN_ID}-membership-b`;
const MEMBERSHIP_C = `${RUN_ID}-membership-c`;
const MEMBERSHIP_D = `${RUN_ID}-membership-d`;

const actorA: RequestUser = {
  id: USER_A, email: `${USER_A}@industrial.test`, role: Role.ADMIN,
  orgId: ORG_A, tenantId: TENANT_A, membershipId: MEMBERSHIP_A,
  isOrgAdmin: true, sessionId: `${RUN_ID}-session-a`,
};
const actorB: RequestUser = {
  id: USER_B, email: `${USER_B}@industrial.test`, role: Role.ADMIN,
  orgId: ORG_B, tenantId: TENANT_B, membershipId: MEMBERSHIP_B,
  isOrgAdmin: true, sessionId: `${RUN_ID}-session-b`,
};
const forgedNonAdmin: RequestUser = {
  id: USER_C, email: `${USER_C}@industrial.test`, role: Role.BUYER,
  orgId: ORG_A, tenantId: TENANT_A, membershipId: MEMBERSHIP_C,
  isOrgAdmin: true, sessionId: `${RUN_ID}-session-c`,
};
const sameTenantOutsider: RequestUser = {
  id: USER_D, email: `${USER_D}@industrial.test`, role: Role.ADMIN,
  orgId: ORG_C, tenantId: TENANT_A, membershipId: MEMBERSHIP_D,
  isOrgAdmin: true, sessionId: `${RUN_ID}-session-d`,
};

function createRuleSet(suffix: string, key = 'platform-fee'): Extract<CommercialRuleCommand, { action: 'CREATE_VERSION' }> {
  return {
    aggregateType: 'RULE_SET', aggregateKey: key, action: 'CREATE_VERSION',
    commandId: `${RUN_ID}-command-${suffix}`, idempotencyKey: `${RUN_ID}-idempotency-${suffix}`,
    correlationId: `${RUN_ID}-correlation-${suffix}`, expectedStateVersion: '0',
    reason: `Create controlled commercial rule version for ${suffix}.`,
    name: `Platform fee ${suffix}`, currency: 'RUB', effectiveFrom: null, effectiveTo: null,
    rules: [{
      ruleKey: 'standard-percent', kind: 'PRICING', priority: 10,
      when: { serviceCategory: 'LOGISTICS' },
      commercial: { pricingModel: 'CAPPED_PERCENT', pricing: { basisPoints: 125, capKopecks: '5000' }, payerMode: 'SPLIT', payerShares: [{ payer: 'SELLER', basisPoints: 4000 }, { payer: 'BUYER', basisPoints: 6000 }] },
    }],
  };
}

function lifecycle(
  action: 'PUBLISH' | 'RETIRE',
  aggregateType: 'RULE_SET' | 'RULE_PACK',
  aggregateKey: string,
  aggregateId: string,
  expectedStateVersion: string,
  suffix: string,
): CommercialRuleCommand {
  return {
    aggregateType, aggregateKey, aggregateId, action, expectedStateVersion,
    commandId: `${RUN_ID}-command-${suffix}`, idempotencyKey: `${RUN_ID}-idempotency-${suffix}`,
    correlationId: `${RUN_ID}-correlation-${suffix}`,
    reason: `${action === 'PUBLISH' ? 'Publish' : 'Retire'} controlled commercial version for ${suffix}.`,
  };
}

function deterministicId(prefix: string, material: string): string {
  return `${prefix}-${commercialDigest(material).slice(0, 32)}`;
}

const describeAuthority = ADMIN_URL && APP_URL ? describe : describe.skip;

describeAuthority('CommercialRules PostgreSQL authority', () => {
  const admin = new PrismaService({ datasources: { db: { url: ADMIN_URL } } });
  const app = new PrismaService({ datasources: { db: { url: APP_URL } } });
  const rls = new RlsTransactionService(app);
  const rules = new CommercialRulesRepository(rls);
  let ruleSetId = '';
  let ruleSetHash = '';
  let rulePackId = '';
  let rulePackHash = '';

  beforeAll(async () => {
    await Promise.all([admin.$connect(), app.$connect()]);
    await admin.organization.createMany({ data: [
      { id: ORG_A, tenantId: TENANT_A, inn: `85${Date.now().toString().slice(-8)}`, name: 'Commercial A', status: 'ACTIVE' },
      { id: ORG_B, tenantId: TENANT_B, inn: `86${Date.now().toString().slice(-8)}`, name: 'Commercial B', status: 'ACTIVE' },
      { id: ORG_C, tenantId: TENANT_A, inn: `87${Date.now().toString().slice(-8)}`, name: 'Commercial C', status: 'ACTIVE' },
    ] });
    await admin.user.createMany({ data: [
      { id: USER_A, email: actorA.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Commercial Admin A' },
      { id: USER_B, email: actorB.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Commercial Admin B' },
      { id: USER_C, email: forgedNonAdmin.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Commercial Member C' },
      { id: USER_D, email: sameTenantOutsider.email, passwordHash: 'industrial-not-a-login-secret', fullName: 'Commercial Admin D' },
    ] });
    await admin.userOrg.createMany({ data: [
      { id: MEMBERSHIP_A, userId: USER_A, organizationId: ORG_A, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
      { id: MEMBERSHIP_B, userId: USER_B, organizationId: ORG_B, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
      { id: MEMBERSHIP_C, userId: USER_C, organizationId: ORG_A, role: Role.BUYER, status: 'ACTIVE', isOrgAdmin: false },
      { id: MEMBERSHIP_D, userId: USER_D, organizationId: ORG_C, role: Role.ADMIN, status: 'ACTIVE', isOrgAdmin: true },
    ] });
  });

  afterAll(async () => {
    if (ADMIN_URL) {
      await admin.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
        for (const table of ['commercial_rule_events', 'commercial_decisions', 'commercial_rule_packs', 'commercial_rule_sets']) {
          await tx.$executeRawUnsafe(`DELETE FROM public."${table}" WHERE "tenantId" IN ('${TENANT_A}', '${TENANT_B}')`);
        }
      });
      await admin.outboxEntry.deleteMany({ where: { correlationId: { startsWith: RUN_ID } } });
      await admin.auditEvent.deleteMany({ where: { correlationId: { startsWith: RUN_ID } } });
      await admin.userOrg.deleteMany({ where: { id: { in: [MEMBERSHIP_A, MEMBERSHIP_B, MEMBERSHIP_C, MEMBERSHIP_D] } } });
      await admin.user.deleteMany({ where: { id: { in: [USER_A, USER_B, USER_C, USER_D] } } });
      await admin.organization.deleteMany({ where: { id: { in: [ORG_A, ORG_B, ORG_C] } } });
    }
    await Promise.allSettled([admin.$disconnect(), app.$disconnect()]);
  });

  it('forces RLS on every authority table and removes destructive app grants', async () => {
    const authority = await app.$queryRaw<Array<{ table_name: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>(Prisma.sql`
      SELECT relname AS table_name, relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE oid IN ('public.commercial_rule_sets'::regclass, 'public.commercial_rule_packs'::regclass,
         'public.commercial_decisions'::regclass, 'public.commercial_rule_events'::regclass)
       ORDER BY relname
    `);
    expect(authority).toHaveLength(4);
    expect(authority.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
    const grants = await app.$queryRaw<Array<{ decisionUpdate: boolean; versionDelete: boolean }>>(Prisma.sql`
      SELECT has_table_privilege(current_user, 'public.commercial_decisions', 'UPDATE') AS "decisionUpdate",
        has_table_privilege(current_user, 'public.commercial_rule_sets', 'DELETE') AS "versionDelete"
    `);
    expect(grants[0]).toEqual({ decisionUpdate: false, versionDelete: false });
  });

  it('creates, publishes and isolates an immutable rule-set version', async () => {
    const create = createRuleSet('initial');
    const receipt = await rules.execute(actorA, create);
    ruleSetId = receipt.aggregateId;
    ruleSetHash = receipt.contentHash;
    expect(receipt).toMatchObject({ status: 'DRAFT', version: '1', stateVersion: '1', replayed: false });
    expect(await rules.execute(actorA, create)).toMatchObject({ replayed: true, aggregateId: ruleSetId });
    await expect(rules.listOwn(forgedNonAdmin)).resolves.toMatchObject({ items: { ruleSets: [], rulePacks: [] } });
    const published = await rules.execute(actorA, lifecycle('PUBLISH', 'RULE_SET', 'platform-fee', ruleSetId, '1', 'publish'));
    expect(published).toMatchObject({ status: 'PUBLISHED', stateVersion: '2', contentHash: ruleSetHash });
    await expect(rules.listOwn(forgedNonAdmin)).resolves.toMatchObject({ items: { ruleSets: [{ aggregateId: ruleSetId }] } });
    await expect(rules.listOwn(actorB)).resolves.toMatchObject({ items: { ruleSets: [], rulePacks: [] } });
    await expect(rules.listOwn(sameTenantOutsider)).resolves.toMatchObject({ items: { ruleSets: [], rulePacks: [] } });
    await expect(rules.execute(sameTenantOutsider, lifecycle(
      'RETIRE', 'RULE_SET', 'platform-fee', ruleSetId, '2', 'same-tenant-outsider',
    ))).rejects.toMatchObject({ response: { code: 'COMMERCIAL_RULE_VERSION_NOT_FOUND' } });
    await expect(rls.withTrustedContext(sameTenantOutsider, async (tx) => tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM public."commercial_rule_sets" WHERE "id" = ${ruleSetId}
    `))).resolves.toEqual([]);
    await expect(rls.withTrustedContext(sameTenantOutsider, async (tx) => tx.$executeRaw(Prisma.sql`
      UPDATE public."commercial_rule_sets" SET "status" = 'RETIRED',
        "stateVersion" = "stateVersion" + 1, "retiredAt" = clock_timestamp(),
        "updatedByMembershipId" = ${MEMBERSHIP_D} WHERE "id" = ${ruleSetId}
    `))).resolves.toBe(0);
    await expect(rls.withTrustedContext(actorA, async (tx) => tx.$executeRaw(Prisma.sql`
      UPDATE public."commercial_rule_sets" SET "name" = 'Tampered', "stateVersion" = "stateVersion" + 1 WHERE "id" = ${ruleSetId}
    `))).rejects.toThrow(/PC_COMMERCIAL_VERSION_CONTENT_IMMUTABLE/);
  });

  it('rejects a forged in-memory admin flag using durable membership authority', async () => {
    await expect(rules.execute(forgedNonAdmin, createRuleSet('forged', 'forged-fee')))
      .rejects.toMatchObject({ response: { code: 'ORGANIZATION_ADMIN_REQUIRED' } });
  });

  it('pins a published rule set in a versioned pack and records deterministic decisions', async () => {
    const packCreate: Extract<CommercialRuleCommand, { action: 'CREATE_VERSION' }> = {
      aggregateType: 'RULE_PACK', aggregateKey: 'default-services', action: 'CREATE_VERSION',
      commandId: `${RUN_ID}-command-pack-create`, idempotencyKey: `${RUN_ID}-idempotency-pack-create`,
      correlationId: `${RUN_ID}-correlation-pack-create`, expectedStateVersion: '0',
      reason: 'Create a pack with an exact published rule-set reference.', name: 'Default services',
      effectiveFrom: null, effectiveTo: null,
      entries: [{ ruleSetId, ruleSetKey: 'platform-fee', ruleSetVersion: '1', ruleSetContentHash: ruleSetHash }],
    };
    const created = await rules.execute(actorA, packCreate);
    rulePackId = created.aggregateId;
    rulePackHash = created.contentHash;
    await rules.execute(actorA, lifecycle('PUBLISH', 'RULE_PACK', 'default-services', rulePackId, '1', 'pack-publish'));
    await expect(rules.execute(actorA, lifecycle(
      'RETIRE', 'RULE_SET', 'platform-fee', ruleSetId, '2', 'retire-pinned-rule-set',
    ))).rejects.toMatchObject({ response: { code: 'COMMERCIAL_RULE_SET_IN_USE' } });
    await expect(rls.withTrustedContext(actorA, async (tx) => tx.$executeRaw(Prisma.sql`
      UPDATE public."commercial_rule_sets" SET "status" = 'RETIRED',
        "stateVersion" = "stateVersion" + 1, "retiredAt" = clock_timestamp(),
        "updatedAt" = clock_timestamp(), "updatedByMembershipId" = ${MEMBERSHIP_A}
       WHERE "id" = ${ruleSetId}
    `))).rejects.toThrow(/PC_COMMERCIAL_RULE_SET_IN_USE/);

    const request = {
      decisionKey: `${RUN_ID}-decision-001`, correlationId: `${RUN_ID}-decision-correlation-001`,
      ruleSetId, rulePackId, ruleKey: 'standard-percent', context: { serviceCategory: 'LOGISTICS' },
      facts: { baseAmountKopecks: '1000000' },
    } as const;
    const first = await rules.evaluate(actorA, request);
    const replay = await rules.evaluate(actorA, request);
    expect(first).toMatchObject({
      replayed: false, createsFinancialObligation: false,
      decision: { status: 'CALCULATED', amountKopecks: '5000', payerAllocations: [
        { payer: 'SELLER', amountKopecks: '2000' }, { payer: 'BUYER', amountKopecks: '3000' },
      ] },
      ruleSet: { id: ruleSetId, version: '1', contentHash: ruleSetHash },
      rulePack: { id: rulePackId, version: '1' },
    });
    expect(replay).toMatchObject({ replayed: true, outputHash: first.outputHash });
    await expect(rules.evaluate(actorA, { ...request, facts: { baseAmountKopecks: '1' } }))
      .rejects.toBeInstanceOf(ConflictException);
    const unrelated = await rules.execute(actorA, createRuleSet('unrelated', 'unrelated-fee'));
    await rules.execute(actorA, lifecycle('PUBLISH', 'RULE_SET', 'unrelated-fee', unrelated.aggregateId, '1', 'unrelated-publish'));
    const forgedOutput = { status: 'CALCULATED', amountKopecks: '1', payerAllocations: [], missingFacts: [] };
    await expect(rls.withTrustedContext(actorA, async (tx) => tx.$executeRaw(Prisma.sql`
      INSERT INTO public."commercial_decisions" (
        "id", "tenantId", "organizationId", "decisionKey", "ruleSetId", "ruleSetKey",
        "ruleSetVersion", "ruleSetContentHash", "rulePackId", "rulePackKey", "rulePackVersion",
        "rulePackContentHash", "input", "inputHash", "output", "outputHash", "decisionStatus",
        "amountKopecks", "currency", "actorUserId", "actorMembershipId", "correlationId"
      ) VALUES (
        ${`${RUN_ID}-forged-decision`}, ${TENANT_A}, ${ORG_A}, ${`${RUN_ID}-forged-decision`},
        ${unrelated.aggregateId}, 'unrelated-fee', 1, ${unrelated.contentHash}, ${rulePackId},
        'default-services', 1, ${rulePackHash}, '{}'::jsonb, ${commercialDigest({})},
        ${JSON.stringify(forgedOutput)}::jsonb, ${commercialDigest(forgedOutput)}, 'CALCULATED', 1,
        'RUB', ${USER_A}, ${MEMBERSHIP_A}, ${`${RUN_ID}-forged-correlation`}
      )
    `))).rejects.toThrow(/PC_COMMERCIAL_DECISION_PACK_RULE_SET_MISMATCH/);
    await expect(app.$executeRaw(Prisma.sql`
      DELETE FROM public."commercial_decisions" WHERE "decisionKey" = ${request.decisionKey}
    `)).rejects.toBeDefined();
  });

  it('serializes publish races and rolls back version, audit and event when outbox fails', async () => {
    const raceCreated = await rules.execute(actorA, createRuleSet('race', 'race-fee'));
    const raceA = lifecycle('PUBLISH', 'RULE_SET', 'race-fee', raceCreated.aggregateId, '1', 'race-a');
    const raceB = lifecycle('PUBLISH', 'RULE_SET', 'race-fee', raceCreated.aggregateId, '1', 'race-b');
    const results = await Promise.allSettled([rules.execute(actorA, raceA), rules.execute(actorA, raceB)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

    const failing = createRuleSet('atomic', 'atomic-fee');
    const identity = `${TENANT_A}:${ORG_A}:${failing.commandId}`;
    await admin.outboxEntry.create({ data: {
      id: deterministicId('outbox-commercial-rule', identity), type: 'industrial.atomicity.sentinel',
      payload: { runId: RUN_ID }, status: 'PENDING', correlationId: failing.correlationId, nextRetryAt: new Date(),
    } });
    await expect(rules.execute(actorA, failing)).rejects.toBeDefined();
    const counts = await admin.$queryRaw<Array<{ versions: bigint; events: bigint }>>(Prisma.sql`
      SELECT (SELECT count(*) FROM public."commercial_rule_sets" WHERE "ruleSetKey" = 'atomic-fee')::bigint AS versions,
        (SELECT count(*) FROM public."commercial_rule_events" WHERE "commandId" = ${failing.commandId})::bigint AS events
    `);
    expect(counts[0]).toEqual({ versions: 0n, events: 0n });
    expect(await admin.auditEvent.count({ where: { correlationId: failing.correlationId } })).toBe(0);
  });

  it('denies direct rule-set and rule-pack transitions even with a spoofed command context', async () => {
    const draft = await rules.execute(actorA, createRuleSet('no-evidence', 'no-evidence-fee'));
    const directTransition = (table: 'commercial_rule_sets' | 'commercial_rule_packs', id: string, status: 'PUBLISHED' | 'RETIRED') =>
      rls.withTrustedContext(actorA, async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT set_config('app.current_command_id', ${`${RUN_ID}-spoofed-command`}, true)`);
        const count = await tx.$executeRaw(Prisma.sql`
          UPDATE ${Prisma.raw(`public."${table}"`)} SET "status" = ${status}, "stateVersion" = "stateVersion" + 1,
            "publishedAt" = CASE WHEN ${status} = 'PUBLISHED' THEN clock_timestamp() ELSE "publishedAt" END,
            "retiredAt" = CASE WHEN ${status} = 'RETIRED' THEN clock_timestamp() ELSE NULL END,
            "updatedByMembershipId" = ${MEMBERSHIP_A}, "updatedAt" = clock_timestamp() WHERE "id" = ${id}
        `);
        await tx.$executeRaw(Prisma.sql`
          SET CONSTRAINTS commercial_rule_set_evidence_guard, commercial_rule_pack_evidence_guard IMMEDIATE
        `);
        return count;
      });
    await expect(directTransition('commercial_rule_sets', draft.aggregateId, 'PUBLISHED'))
      .rejects.toThrow(/PC_COMMERCIAL_VERSION_EVIDENCE_REQUIRED/);
    await rules.execute(actorA, lifecycle('PUBLISH', 'RULE_SET', 'no-evidence-fee', draft.aggregateId, '1', 'no-evidence-publish'));
    await expect(directTransition('commercial_rule_sets', draft.aggregateId, 'RETIRED'))
      .rejects.toThrow(/PC_COMMERCIAL_VERSION_EVIDENCE_REQUIRED/);
    const pack = await rules.execute(actorA, {
      ...createRuleSet('no-evidence-pack', 'no-evidence-pack'), aggregateType: 'RULE_PACK', currency: undefined, rules: undefined,
      entries: [{ ruleSetId, ruleSetKey: 'platform-fee', ruleSetVersion: '1', ruleSetContentHash: ruleSetHash }],
    });
    await expect(directTransition('commercial_rule_packs', pack.aggregateId, 'PUBLISHED'))
      .rejects.toThrow(/PC_COMMERCIAL_VERSION_EVIDENCE_REQUIRED/);
    await rules.execute(actorA, lifecycle('PUBLISH', 'RULE_PACK', 'no-evidence-pack', pack.aggregateId, '1', 'no-evidence-pack-publish'));
    await expect(directTransition('commercial_rule_packs', pack.aggregateId, 'RETIRED'))
      .rejects.toThrow(/PC_COMMERCIAL_VERSION_EVIDENCE_REQUIRED/);
  });

  it('rejects a direct commit without evidence in PostgreSQL independently of the driver result', async () => {
    const draft = await rules.execute(actorA, createRuleSet('commit-proof', 'commit-proof-fee'));
    // Some driver versions drop a deferred constraint error returned by COMMIT.
    // Persisted state is the authority; both driver outcomes must leave DRAFT.
    await rls.withTrustedContext(actorA, (tx) => tx.$executeRaw(Prisma.sql`
      UPDATE public."commercial_rule_sets" SET "status" = 'PUBLISHED', "stateVersion" = 2,
        "publishedAt" = clock_timestamp(), "updatedAt" = clock_timestamp(), "updatedByMembershipId" = ${MEMBERSHIP_A}
       WHERE "id" = ${draft.aggregateId}
    `)).catch(() => undefined);
    const rows = await rls.withTrustedContext(actorA, (tx) => tx.$queryRaw<Array<{ status: string; stateVersion: bigint }>>(Prisma.sql`
      SELECT "status", "stateVersion" FROM public."commercial_rule_sets" WHERE "id" = ${draft.aggregateId}
    `));
    expect(rows).toEqual([{ status: 'DRAFT', stateVersion: 1n }]);
    await expect(rules.execute(actorA, lifecycle('PUBLISH', 'RULE_SET', 'commit-proof-fee', draft.aggregateId, '1', 'commit-proof-publish')))
      .resolves.toMatchObject({ status: 'PUBLISHED', stateVersion: '2' });
  });

  it('rolls back a complete lifecycle event when outbox insertion is silently omitted', async () => {
    const incomplete = new CommercialRulesRepository({
      withTrustedContext: (user: RequestUser, work: Parameters<RlsTransactionService['withTrustedContext']>[1]) =>
        rls.withTrustedContext(user, (tx, context) => work(new Proxy(tx, {
          get(target, property) {
            if (property === '$executeRaw') return (query: Prisma.Sql) =>
              query.sql.includes('INSERT INTO public."outbox_entries"') ? Promise.resolve(1) : target.$executeRaw(query);
            return Reflect.get(target, property);
          },
        }), context)),
    } as RlsTransactionService);
    const command = createRuleSet('missing-outbox', 'missing-outbox-fee');
    await expect(incomplete.execute(actorA, command)).rejects.toThrow(/PC_COMMERCIAL_VERSION_EVIDENCE_REQUIRED/);
    expect(await admin.auditEvent.count({ where: { correlationId: command.correlationId } })).toBe(0);
    const rows = await rls.withTrustedContext(actorA, (tx) => tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM public."commercial_rule_sets" WHERE "ruleSetKey" = 'missing-outbox-fee'
    `));
    expect(rows).toEqual([]);
  });

  it('rejects forged decision material with valid published references and correctly recomputed hashes', async () => {
    const input = {
      decisionKey: `${RUN_ID}-direct-forgery`, correlationId: `${RUN_ID}-direct-forgery-correlation`,
      ruleSetId, rulePackId, ruleKey: 'standard-percent', context: { serviceCategory: 'LOGISTICS' }, facts: { baseAmountKopecks: '1000000' },
    };
    const legitimateOutput = { status: 'CALCULATED', amountKopecks: '5000', payerAllocations: [
      { payer: 'SELLER', amountKopecks: '2000' }, { payer: 'BUYER', amountKopecks: '3000' },
    ], missingFacts: [] };
    const insert = (material: unknown, output: typeof legitimateOutput, amount: string, hashOverride: string | null = null) =>
      rls.withTrustedContext({ ...forgedNonAdmin, isOrgAdmin: false }, (tx) => tx.$executeRaw(Prisma.sql`
        INSERT INTO public."commercial_decisions" (
          "id", "tenantId", "organizationId", "decisionKey", "ruleSetId", "ruleSetKey", "ruleSetVersion", "ruleSetContentHash",
          "rulePackId", "rulePackKey", "rulePackVersion", "rulePackContentHash", "input", "inputHash", "output", "outputHash",
          "decisionStatus", "amountKopecks", "currency", "actorUserId", "actorMembershipId", "correlationId"
        ) VALUES (
          ${`${RUN_ID}-direct-forgery`}, ${TENANT_A}, ${ORG_A}, ${input.decisionKey}, ${ruleSetId}, 'platform-fee', 1, ${ruleSetHash},
          ${rulePackId}, 'default-services', 1, ${rulePackHash}, ${JSON.stringify(material)}::jsonb,
          coalesce(${hashOverride}, encode(sha256(convert_to((${JSON.stringify(material)}::jsonb)::text, 'UTF8')), 'hex')),
          ${JSON.stringify(output)}::jsonb, encode(sha256(convert_to((${JSON.stringify(output)}::jsonb)::text, 'UTF8')), 'hex'),
          ${output.status}, ${BigInt(amount)}, 'RUB', ${USER_C}, ${MEMBERSHIP_C}, ${input.correlationId}
        )
      `));
    await expect(insert(input, { ...legitimateOutput, amountKopecks: '1' }, '1')).rejects.toThrow(/PC_COMMERCIAL_DECISION_OUTPUT_MISMATCH/);
    await expect(insert(input, { ...legitimateOutput, payerAllocations: [{ payer: 'BUYER', amountKopecks: '5000' }] }, '5000'))
      .rejects.toThrow(/PC_COMMERCIAL_DECISION_OUTPUT_MISMATCH/);
    await expect(insert(input, legitimateOutput, '1')).rejects.toThrow(/PC_COMMERCIAL_DECISION_OUTPUT_MISMATCH/);
    await expect(insert(input, legitimateOutput, '5000', 'a'.repeat(64))).rejects.toThrow(/PC_COMMERCIAL_DECISION_MATERIAL_MISMATCH/);
    await expect(insert({ ...input, context: { serviceCategory: 'OTHER' } }, legitimateOutput, '5000'))
      .rejects.toThrow(/PC_COMMERCIAL_DECISION_CONDITION_MISMATCH/);
    await expect(insert({ ...input, facts: { ...input.facts, contractPayer: 'BUYER' } }, legitimateOutput, '5000'))
      .rejects.toThrow(/PC_COMMERCIAL_CONTRACT_PAYER_AUTHORITY_REQUIRED/);
    // An ordinary member still obtains the valid computed decision via the API repository.
    expect(await rules.evaluate({ ...forgedNonAdmin, isOrgAdmin: false }, input)).toMatchObject({ decision: legitimateOutput });
  });

  it('keeps unresolved contract payer non-financial and rejects request overrides', async () => {
    const draft = await rules.execute(actorA, { ...createRuleSet('contract', 'contract-fee'), rules: [{
      ruleKey: 'contract-payer', kind: 'PAYER', priority: 1, when: {},
      commercial: { pricingModel: 'FIXED', pricing: { amountKopecks: '90' }, payerMode: 'CONTRACT_RULE' },
    }] });
    await rules.execute(actorA, lifecycle('PUBLISH', 'RULE_SET', 'contract-fee', draft.aggregateId, '1', 'contract-publish'));
    const request = { decisionKey: `${RUN_ID}-contract-decision`, correlationId: `${RUN_ID}-contract-decision-correlation`,
      ruleSetId: draft.aggregateId, ruleKey: 'contract-payer', context: {}, facts: {} };
    expect(await rules.evaluate(actorA, request)).toMatchObject({
      createsFinancialObligation: false, decision: { status: 'MISSING_FACTS', amountKopecks: null, missingFacts: ['contractPayer'], payerAllocations: [] },
    });
    await expect(rules.evaluate(actorA, { ...request, facts: { contractPayer: 'SELLER' } }))
      .rejects.toThrow(/contractPayer must come from contract authority/);
  });

  it('agrees across domain and PostgreSQL for every model, payer mode and integer boundary', async () => {
    const cases: Array<[CommercialRuleDefinition, CommercialEvaluationFacts]> = [
      [{ pricingModel: 'FREE', pricing: {}, payerMode: 'SELLER' }, {}],
      [{ pricingModel: 'SUBSCRIPTION', pricing: { amountKopecks: '12500' }, payerMode: 'BUYER' }, { subscriptionPeriods: '3' }],
      [{ pricingModel: 'ACCESS_FEE', pricing: { amountKopecks: '900' }, payerMode: 'INITIATOR' }, { accessUnits: '2' }],
      [{ pricingModel: 'FIXED', pricing: { amountKopecks: '9223372036854775807' }, payerMode: 'DELIVERY_RESPONSIBLE' }, {}],
      [{ pricingModel: 'PER_TON', pricing: { rateKopecks: '1250' }, payerMode: 'BUYER' }, { quantityMilliTons: '2500' }],
      [{ pricingModel: 'PER_KM', pricing: { rateKopecks: '200' }, payerMode: 'BUYER' }, { distanceMeters: '1250' }],
      [{ pricingModel: 'PER_TRIP', pricing: { rateKopecks: '7000' }, payerMode: 'BUYER' }, { tripCount: '4' }],
      [{ pricingModel: 'PER_HOUR', pricing: { rateKopecks: '6000' }, payerMode: 'BUYER' }, { durationMinutes: '90' }],
      [{ pricingModel: 'PERCENT', pricing: { basisPoints: 1 }, payerMode: 'BUYER' }, { baseAmountKopecks: '5000' }],
      [{ pricingModel: 'SUCCESS_FEE', pricing: { amountKopecks: '5000' }, payerMode: 'BUYER' }, { success: false }],
      [{ pricingModel: 'CAPPED_PERCENT', pricing: { basisPoints: 1000, capKopecks: '8000' }, payerMode: 'BUYER' }, { baseAmountKopecks: '100000' }],
      [{ pricingModel: 'HYBRID', pricing: { fixedKopecks: '1000', basisPoints: 500, capKopecks: '2000' }, payerMode: 'BUYER' }, { baseAmountKopecks: '100000' }],
      [{ pricingModel: 'MANUAL_QUOTE', pricing: {}, payerMode: 'BUYER' }, {}],
      [{ pricingModel: 'FIXED', pricing: { amountKopecks: '101' }, payerMode: 'SPLIT', payerShares: [
        { payer: 'SELLER', basisPoints: 5000 }, { payer: 'BUYER', basisPoints: 5000 },
      ] }, {}],
      [{ pricingModel: 'FIXED', pricing: { amountKopecks: '1' }, payerMode: 'CONTRACT_RULE' }, {}],
      [{ pricingModel: 'FIXED', pricing: { amountKopecks: '1' }, payerMode: 'REQUIRES_CONFIRMATION' }, {}],
      [{ pricingModel: 'PER_TON', pricing: { rateKopecks: '1' }, payerMode: 'REQUIRES_CONFIRMATION' }, {}],
      [{ pricingModel: 'SUCCESS_FEE', pricing: { amountKopecks: '1' }, payerMode: 'BUYER' }, {}],
    ];
    for (const [definition, facts] of cases) {
      const result = await app.$queryRaw<Array<{ output: unknown }>>(Prisma.sql`
        SELECT public.app_commercial_evaluate(${JSON.stringify(definition)}::jsonb, ${JSON.stringify(facts)}::jsonb) AS output
      `);
      expect(result[0]?.output).toEqual(evaluateCommercialRule(definition, facts));
    }
    const invalid: Array<[CommercialRuleDefinition, CommercialEvaluationFacts]> = [
      [{ pricingModel: 'FIXED', pricing: { amountKopecks: '-1' }, payerMode: 'REQUIRES_CONFIRMATION' }, {}],
      [{ pricingModel: 'PERCENT', pricing: { basisPoints: 10001 }, payerMode: 'REQUIRES_CONFIRMATION' }, {}],
      [{ pricingModel: 'SUCCESS_FEE', pricing: { amountKopecks: '-1' }, payerMode: 'BUYER' }, {}],
      [{ pricingModel: 'PER_TRIP', pricing: { rateKopecks: '9223372036854775807' }, payerMode: 'BUYER' }, { tripCount: '2' }],
    ];
    for (const [definition, facts] of invalid) {
      expect(() => evaluateCommercialRule(definition, facts)).toThrow();
      await expect(app.$queryRaw(Prisma.sql`SELECT public.app_commercial_evaluate(${JSON.stringify(definition)}::jsonb, ${JSON.stringify(facts)}::jsonb)`))
        .rejects.toThrow(/PC_COMMERCIAL_/);
    }
  });
});

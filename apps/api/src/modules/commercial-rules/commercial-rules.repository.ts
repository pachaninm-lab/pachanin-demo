import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  evaluateCommercialRule,
  type CommercialEvaluation,
} from '../../../../../packages/domain-core/src';
import {
  RlsTransactionService,
  type TrustedRlsContext,
} from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import {
  commercialDigest,
  commercialRuleCommandFingerprint,
  commercialVersionContent,
  stableCommercialJson,
  validateCommercialDecisionRequest,
  validateCommercialRuleCommand,
  type CommercialDecisionRequest,
  type CommercialRuleCommand,
  type CommercialRuleCommandReceipt,
  type CommercialRulePackEntry,
  type CommercialRulePolicy,
} from './commercial-rules.contract';

type AggregateType = 'RULE_SET' | 'RULE_PACK';
type VersionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

type VersionRow = {
  id: string;
  tenantId: string;
  organizationId: string;
  aggregateKey: string;
  version: bigint;
  stateVersion: bigint;
  status: VersionStatus;
  name: string;
  currency: string | null;
  content: unknown;
  contentHash: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  publishedAt: Date | null;
  retiredAt: Date | null;
  createdByMembershipId: string;
  updatedByMembershipId: string;
  createdAt: Date;
  updatedAt: Date;
};

type ReplayRow = {
  aggregateType: AggregateType;
  aggregateId: string;
  aggregateVersion: bigint;
  action: CommercialRuleCommand['action'];
  resultStatus: VersionStatus;
  commandId: string;
  idempotencyKey: string;
  correlationId: string;
  requestFingerprint: string;
  afterState: Record<string, unknown>;
  createdAt: Date;
};

type DecisionRow = {
  id: string;
  decisionKey: string;
  ruleSetId: string;
  ruleSetKey: string;
  ruleSetVersion: bigint;
  ruleSetContentHash: string;
  rulePackId: string | null;
  rulePackKey: string | null;
  rulePackVersion: bigint | null;
  rulePackContentHash: string | null;
  inputHash: string;
  output: CommercialEvaluation;
  outputHash: string;
  decisionStatus: CommercialEvaluation['status'];
  amountKopecks: bigint | null;
  currency: string;
  correlationId: string;
  createdAt: Date;
};

function deterministicId(prefix: string, material: string): string {
  return `${prefix}-${commercialDigest(material).slice(0, 32)}`;
}

function staleVersion(current: bigint | string): ConflictException {
  return new ConflictException({
    code: 'COMMERCIAL_RULE_STALE_VERSION',
    currentVersion: current.toString(),
    refreshRequired: true,
  });
}

function databaseCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return '23505';
    if (error.code === 'P2034') return '40001';
    const meta = error.meta as Record<string, unknown> | undefined;
    if (typeof meta?.code === 'string') return meta.code;
  }
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: unknown; meta?: unknown };
  if (typeof candidate.code === 'string') return candidate.code;
  if (candidate.meta && typeof candidate.meta === 'object') {
    const meta = candidate.meta as Record<string, unknown>;
    if (typeof meta.code === 'string') return meta.code;
  }
  return null;
}

function asRules(value: unknown): readonly CommercialRulePolicy[] {
  if (!Array.isArray(value)) throw new UnprocessableEntityException({ code: 'COMMERCIAL_RULE_CONTENT_INVALID' });
  return value as CommercialRulePolicy[];
}

function asEntries(value: unknown): readonly CommercialRulePackEntry[] {
  if (!Array.isArray(value)) throw new UnprocessableEntityException({ code: 'COMMERCIAL_RULE_PACK_CONTENT_INVALID' });
  return value as CommercialRulePackEntry[];
}

function conditionMatches(condition: Readonly<Record<string, unknown>>, context: Readonly<Record<string, string | boolean>>): boolean {
  return Object.entries(condition).every(([key, expected]) => context[key] === expected);
}

@Injectable()
export class CommercialRulesRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async listOwn(user: RequestUser) {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const [ruleSets, rulePacks] = await Promise.all([
        this.listRuleSets(tx, context),
        this.listRulePacks(tx, context),
      ]);
      return {
        tenantId: context.tenantId,
        organizationId: context.orgId,
        authority: 'POSTGRESQL' as const,
        immutablePublishedVersions: true,
        items: {
          ruleSets: ruleSets.map((row) => this.versionView('RULE_SET', row)),
          rulePacks: rulePacks.map((row) => this.versionView('RULE_PACK', row)),
        },
      };
    });
  }

  async execute(user: RequestUser, command: CommercialRuleCommand): Promise<CommercialRuleCommandReceipt> {
    validateCommercialRuleCommand(command);
    if (!user.membershipId?.trim() || user.isOrgAdmin !== true) {
      throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });
    }
    const fingerprint = commercialRuleCommandFingerprint(command);
    try {
      return await this.rls.withTrustedContext(user, async (tx, context) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(
            ${`${context.tenantId}:${context.orgId}:commercial-rule:idempotency:${command.idempotencyKey}`}, 0
          )) IS NULL AS "locked"
        `);
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(
            ${`${context.tenantId}:${context.orgId}:${command.aggregateType}:${command.aggregateKey}`}, 0
          )) IS NULL AS "locked"
        `);
        await tx.$queryRaw(Prisma.sql`SELECT set_config('app.current_command_id', ${command.commandId}, true)`);
        const authority = await tx.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`
          SELECT public.app_organization_capability_is_org_admin() AS allowed
        `);
        if (authority[0]?.allowed !== true) throw new ForbiddenException({ code: 'ORGANIZATION_ADMIN_REQUIRED' });

        const replay = await this.findReplay(tx, context, command, fingerprint);
        if (replay) return replay;
        const clock = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS now`);
        const committedAt = clock[0]?.now ?? new Date();
        const before = command.action === 'CREATE_VERSION'
          ? null
          : await this.findVersionForUpdate(tx, context, command.aggregateType, command.aggregateId, command.aggregateKey);
        let after: VersionRow;
        if (command.action === 'CREATE_VERSION') {
          after = await this.createVersion(tx, context, user.membershipId!, command, committedAt);
        } else {
          if (!before) throw new NotFoundException({ code: 'COMMERCIAL_RULE_VERSION_NOT_FOUND' });
          if (before.stateVersion !== BigInt(command.expectedStateVersion)) throw staleVersion(before.stateVersion);
          const required = command.action === 'PUBLISH' ? 'DRAFT' : 'PUBLISHED';
          if (before.status !== required) {
            throw new ConflictException({ code: 'COMMERCIAL_RULE_LIFECYCLE_INVALID', currentStatus: before.status });
          }
          after = await this.transitionVersion(tx, context, user.membershipId!, command, before, committedAt);
        }
        const receipt = await this.appendCommandEvidence(tx, context, user, command, fingerprint, before, after, committedAt);
        // Surface a deferred evidence violation as a query error before the
        // driver commits. PostgreSQL still enforces the same constraint for
        // direct SQL, even if a driver discards the COMMIT error payload.
        await tx.$executeRaw(Prisma.sql`
          SET CONSTRAINTS commercial_rule_set_evidence_guard, commercial_rule_pack_evidence_guard IMMEDIATE
        `);
        return receipt;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxConflictRetries: 3 });
    } catch (error) {
      const code = databaseCode(error);
      if (code === '40001' || code === '40P01') throw staleVersion(command.expectedStateVersion);
      if (code === '23505') {
        throw new ConflictException({ code: 'COMMERCIAL_RULE_VERSION_CONFLICT', refreshRequired: true });
      }
      throw error;
    }
  }

  async evaluate(user: RequestUser, request: CommercialDecisionRequest) {
    validateCommercialDecisionRequest(request);
    if (!user.membershipId?.trim()) throw new ForbiddenException({ code: 'MEMBERSHIP_REQUIRED' });
    const input = stableCommercialJson(request);
    return this.rls.withTrustedContext(user, async (tx, context) => {
      // Decision hashes use PostgreSQL's canonical jsonb representation. The
      // insert trigger verifies these hashes and independently evaluates output.
      const hashes = await tx.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
        SELECT encode(sha256(convert_to((${JSON.stringify(input)}::jsonb)::text, 'UTF8')), 'hex') AS hash
      `);
      const inputHash = hashes[0]!.hash;
      await tx.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(
          ${`${context.tenantId}:${context.orgId}:commercial-decision:${request.decisionKey}`}, 0
        )) IS NULL AS "locked"
      `);
      const previous = await tx.$queryRaw<DecisionRow[]>(Prisma.sql`
        SELECT * FROM public."commercial_decisions"
         WHERE "tenantId" = ${context.tenantId} AND "organizationId" = ${context.orgId}
           AND "decisionKey" = ${request.decisionKey} LIMIT 1
      `);
      if (previous[0]) {
        if (previous[0].inputHash !== inputHash) {
          throw new ConflictException({ code: 'COMMERCIAL_DECISION_PAYLOAD_MISMATCH' });
        }
        return this.decisionView(previous[0], true);
      }

      const ruleSet = await this.findPublishedRuleSet(tx, context, request.ruleSetId);
      if (!ruleSet) throw new NotFoundException({ code: 'PUBLISHED_RULE_SET_NOT_FOUND' });
      const clock = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT clock_timestamp() AS now`);
      const evaluatedAt = clock[0]?.now;
      if (!evaluatedAt) throw new Error('COMMERCIAL_DECISION_CLOCK_MISSING');
      this.assertEffective(ruleSet, evaluatedAt);
      const rule = asRules(ruleSet.content).find((candidate) => candidate.ruleKey === request.ruleKey);
      if (!rule?.commercial) throw new NotFoundException({ code: 'COMMERCIAL_RULE_NOT_FOUND' });
      if (!conditionMatches(rule.when, request.context)) {
        throw new UnprocessableEntityException({ code: 'COMMERCIAL_RULE_CONDITION_NOT_MET' });
      }

      let rulePack: VersionRow | null = null;
      if (request.rulePackId) {
        rulePack = await this.findPublishedRulePack(tx, context, request.rulePackId);
        if (!rulePack) throw new NotFoundException({ code: 'PUBLISHED_RULE_PACK_NOT_FOUND' });
        this.assertEffective(rulePack, evaluatedAt);
        const pinned = asEntries(rulePack.content).some((entry) =>
          entry.ruleSetId === ruleSet.id
          && entry.ruleSetKey === ruleSet.aggregateKey
          && entry.ruleSetVersion === ruleSet.version.toString()
          && entry.ruleSetContentHash === ruleSet.contentHash);
        if (!pinned) throw new UnprocessableEntityException({ code: 'RULE_SET_NOT_PINNED_BY_PACK' });
      }

      const output = evaluateCommercialRule(rule.commercial, request.facts);
      const id = deterministicId('commercial-decision', `${context.tenantId}:${context.orgId}:${request.decisionKey}`);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public."commercial_decisions" (
          "id", "tenantId", "organizationId", "decisionKey", "ruleSetId", "ruleSetKey",
          "ruleSetVersion", "ruleSetContentHash", "rulePackId", "rulePackKey", "rulePackVersion",
          "rulePackContentHash", "input", "inputHash", "output", "outputHash", "decisionStatus",
          "amountKopecks", "currency", "actorUserId", "actorMembershipId", "correlationId"
        ) VALUES (
          ${id}, ${context.tenantId}, ${context.orgId}, ${request.decisionKey}, ${ruleSet.id}, ${ruleSet.aggregateKey},
          ${ruleSet.version}, ${ruleSet.contentHash}, ${rulePack?.id ?? null}, ${rulePack?.aggregateKey ?? null},
          ${rulePack?.version ?? null}, ${rulePack?.contentHash ?? null}, ${JSON.stringify(input)}::jsonb,
          ${inputHash}, ${JSON.stringify(output)}::jsonb,
          encode(sha256(convert_to((${JSON.stringify(output)}::jsonb)::text, 'UTF8')), 'hex'), ${output.status},
          ${output.amountKopecks === null ? null : BigInt(output.amountKopecks)}, ${ruleSet.currency!},
          ${context.userId}, ${user.membershipId!}, ${request.correlationId}
        )
      `);
      const created = (await tx.$queryRaw<DecisionRow[]>(Prisma.sql`
        SELECT * FROM public."commercial_decisions" WHERE "id" = ${id}
      `))[0];
      if (!created) throw new Error('COMMERCIAL_DECISION_COMMIT_MISSING');
      return this.decisionView(created, false);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxConflictRetries: 3 });
  }

  private async createVersion(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    command: Extract<CommercialRuleCommand, { action: 'CREATE_VERSION' }>,
    now: Date,
  ): Promise<VersionRow> {
    const versionRows = command.aggregateType === 'RULE_SET'
      ? await tx.$queryRaw<Array<{ next: bigint }>>(Prisma.sql`
          SELECT COALESCE(MAX("version"), 0)::bigint + 1 AS next FROM public."commercial_rule_sets"
           WHERE "tenantId" = ${context.tenantId} AND "organizationId" = ${context.orgId} AND "ruleSetKey" = ${command.aggregateKey}
        `)
      : await tx.$queryRaw<Array<{ next: bigint }>>(Prisma.sql`
          SELECT COALESCE(MAX("version"), 0)::bigint + 1 AS next FROM public."commercial_rule_packs"
           WHERE "tenantId" = ${context.tenantId} AND "organizationId" = ${context.orgId} AND "rulePackKey" = ${command.aggregateKey}
        `);
    const version = versionRows[0]?.next ?? 1n;
    const content = stableCommercialJson(commercialVersionContent(command));
    const contentHash = commercialDigest(content);
    const id = deterministicId(
      command.aggregateType === 'RULE_SET' ? 'commercial-rule-set' : 'commercial-rule-pack',
      `${context.tenantId}:${context.orgId}:${command.aggregateKey}:${version}`,
    );
    if (command.aggregateType === 'RULE_SET') {
      const rows = await tx.$queryRaw<VersionRow[]>(Prisma.sql`
        INSERT INTO public."commercial_rule_sets" (
          "id", "tenantId", "organizationId", "ruleSetKey", "version", "stateVersion", "status",
          "name", "currency", "rules", "contentHash", "effectiveFrom", "effectiveTo",
          "createdByMembershipId", "updatedByMembershipId", "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${context.tenantId}, ${context.orgId}, ${command.aggregateKey}, ${version}, 1, 'DRAFT',
          ${command.name.trim()}, ${command.currency!}, ${JSON.stringify(stableCommercialJson(command.rules))}::jsonb,
          ${contentHash}, ${command.effectiveFrom ? new Date(command.effectiveFrom) : null},
          ${command.effectiveTo ? new Date(command.effectiveTo) : null}, ${membershipId}, ${membershipId}, ${now}, ${now}
        ) RETURNING *, "ruleSetKey" AS "aggregateKey", "rules" AS "content"
      `);
      return rows[0]!;
    }
    await this.assertPublishedEntries(tx, context, command.entries ?? []);
    const rows = await tx.$queryRaw<VersionRow[]>(Prisma.sql`
      INSERT INTO public."commercial_rule_packs" (
        "id", "tenantId", "organizationId", "rulePackKey", "version", "stateVersion", "status",
        "name", "entries", "contentHash", "effectiveFrom", "effectiveTo",
        "createdByMembershipId", "updatedByMembershipId", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${context.tenantId}, ${context.orgId}, ${command.aggregateKey}, ${version}, 1, 'DRAFT',
        ${command.name.trim()}, ${JSON.stringify(stableCommercialJson(command.entries))}::jsonb, ${contentHash},
        ${command.effectiveFrom ? new Date(command.effectiveFrom) : null},
        ${command.effectiveTo ? new Date(command.effectiveTo) : null}, ${membershipId}, ${membershipId}, ${now}, ${now}
      ) RETURNING *, "rulePackKey" AS "aggregateKey", "entries" AS "content", NULL::text AS "currency"
    `);
    return rows[0]!;
  }

  private async transitionVersion(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    membershipId: string,
    command: Exclude<CommercialRuleCommand, { action: 'CREATE_VERSION' }>,
    before: VersionRow,
    now: Date,
  ): Promise<VersionRow> {
    if (command.action === 'PUBLISH' && command.aggregateType === 'RULE_PACK') {
      await this.assertPublishedEntries(tx, context, asEntries(before.content));
    }
    if (command.action === 'RETIRE' && command.aggregateType === 'RULE_SET') {
      await this.assertNoPublishedPackReferences(tx, context, before);
    }
    const status: VersionStatus = command.action === 'PUBLISH' ? 'PUBLISHED' : 'RETIRED';
    if (command.aggregateType === 'RULE_SET') {
      const rows = await tx.$queryRaw<VersionRow[]>(Prisma.sql`
        UPDATE public."commercial_rule_sets" SET
          "status" = ${status}, "stateVersion" = "stateVersion" + 1,
          "publishedAt" = CASE WHEN ${status} = 'PUBLISHED' THEN ${now} ELSE "publishedAt" END,
          "retiredAt" = CASE WHEN ${status} = 'RETIRED' THEN ${now} ELSE NULL END,
          "updatedByMembershipId" = ${membershipId}, "updatedAt" = ${now}
        WHERE "id" = ${before.id} AND "tenantId" = ${context.tenantId} AND "organizationId" = ${context.orgId}
          AND "stateVersion" = ${before.stateVersion}
        RETURNING *, "ruleSetKey" AS "aggregateKey", "rules" AS "content"
      `);
      if (!rows[0]) throw staleVersion(before.stateVersion);
      return rows[0];
    }
    const rows = await tx.$queryRaw<VersionRow[]>(Prisma.sql`
      UPDATE public."commercial_rule_packs" SET
        "status" = ${status}, "stateVersion" = "stateVersion" + 1,
        "publishedAt" = CASE WHEN ${status} = 'PUBLISHED' THEN ${now} ELSE "publishedAt" END,
        "retiredAt" = CASE WHEN ${status} = 'RETIRED' THEN ${now} ELSE NULL END,
        "updatedByMembershipId" = ${membershipId}, "updatedAt" = ${now}
      WHERE "id" = ${before.id} AND "tenantId" = ${context.tenantId} AND "organizationId" = ${context.orgId}
        AND "stateVersion" = ${before.stateVersion}
      RETURNING *, "rulePackKey" AS "aggregateKey", "entries" AS "content", NULL::text AS "currency"
    `);
    if (!rows[0]) throw staleVersion(before.stateVersion);
    return rows[0];
  }

  private async findVersionForUpdate(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    type: AggregateType,
    id: string,
    key: string,
  ): Promise<VersionRow | null> {
    const rows = type === 'RULE_SET'
      ? await tx.$queryRaw<VersionRow[]>(Prisma.sql`
          SELECT *, "ruleSetKey" AS "aggregateKey", "rules" AS "content"
          FROM public."commercial_rule_sets" WHERE "id" = ${id} AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId} AND "ruleSetKey" = ${key} FOR UPDATE
        `)
      : await tx.$queryRaw<VersionRow[]>(Prisma.sql`
          SELECT *, "rulePackKey" AS "aggregateKey", "entries" AS "content", NULL::text AS "currency"
          FROM public."commercial_rule_packs" WHERE "id" = ${id} AND "tenantId" = ${context.tenantId}
            AND "organizationId" = ${context.orgId} AND "rulePackKey" = ${key} FOR UPDATE
        `);
    return rows[0] ?? null;
  }

  private async assertPublishedEntries(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    entries: readonly CommercialRulePackEntry[],
  ): Promise<void> {
    for (const entry of entries) {
      const rows = await tx.$queryRaw<Array<{ matched: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1 FROM public."commercial_rule_sets" WHERE "id" = ${entry.ruleSetId}
            AND "tenantId" = ${context.tenantId} AND "organizationId" = ${context.orgId}
            AND "ruleSetKey" = ${entry.ruleSetKey} AND "version" = ${BigInt(entry.ruleSetVersion)}
            AND "contentHash" = ${entry.ruleSetContentHash} AND "status" = 'PUBLISHED'
        ) AS matched
      `);
      if (rows[0]?.matched !== true) {
        throw new UnprocessableEntityException({ code: 'RULE_PACK_ENTRY_NOT_PUBLISHED', ruleSetId: entry.ruleSetId });
      }
    }
  }

  private async assertNoPublishedPackReferences(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    ruleSet: VersionRow,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ referenced: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM public."commercial_rule_packs" pack,
          LATERAL jsonb_array_elements(pack."entries") entry
         WHERE pack."tenantId" = ${context.tenantId} AND pack."organizationId" = ${context.orgId}
           AND pack."status" = 'PUBLISHED' AND entry ->> 'ruleSetId' = ${ruleSet.id}
           AND entry ->> 'ruleSetKey' = ${ruleSet.aggregateKey}
           AND entry ->> 'ruleSetVersion' = ${ruleSet.version.toString()}
           AND entry ->> 'ruleSetContentHash' = ${ruleSet.contentHash}
      ) AS referenced
    `);
    if (rows[0]?.referenced === true) {
      throw new ConflictException({ code: 'COMMERCIAL_RULE_SET_IN_USE', retireRulePacksFirst: true });
    }
  }

  private async appendCommandEvidence(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    user: RequestUser,
    command: CommercialRuleCommand,
    requestFingerprint: string,
    before: VersionRow | null,
    after: VersionRow,
    committedAt: Date,
  ): Promise<CommercialRuleCommandReceipt> {
    const identity = `${context.tenantId}:${context.orgId}:${command.commandId}`;
    const auditId = deterministicId('audit-commercial-rule', identity);
    const eventId = deterministicId('commercial-rule-event', identity);
    const outboxEntryId = deterministicId('outbox-commercial-rule', identity);
    const outboxKey = `commercial-rule:${commercialDigest({ tenantId: context.tenantId, organizationId: context.orgId, idempotencyKey: command.idempotencyKey })}`;
    const beforeState = before ? this.versionSnapshot(command.aggregateType, before) : null;
    const afterState = this.versionSnapshot(command.aggregateType, after);
    const receipt: CommercialRuleCommandReceipt = {
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      aggregateType: command.aggregateType,
      aggregateId: after.id,
      aggregateKey: after.aggregateKey,
      action: command.action,
      status: after.status,
      version: after.version.toString(),
      stateVersion: after.stateVersion.toString(),
      contentHash: after.contentHash,
      replayed: false,
      committedAt: committedAt.toISOString(),
    };

    const auditObjectType = command.aggregateType === 'RULE_SET'
      ? 'COMMERCIAL_RULE_SET'
      : 'COMMERCIAL_RULE_PACK';
    const previousAudit = await tx.auditEvent.findFirst({
      where: { objectType: auditObjectType, objectId: after.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { hash: true },
    });
    const auditMaterial = {
      id: auditId, action: `COMMERCIAL_${command.aggregateType}_${command.action}`,
      actorUserId: context.userId, actorRole: context.role, tenantId: context.tenantId,
      orgId: context.orgId, objectType: auditObjectType, objectId: after.id,
      beforeState, afterState, outcome: 'SUCCESS', reason: command.reason.trim(),
      correlationId: command.correlationId, requestFingerprint, prevHash: previousAudit?.hash ?? null,
    };
    await tx.auditEvent.create({ data: {
      id: auditId,
      action: auditMaterial.action,
      actorUserId: context.userId,
      actorRole: context.role,
      tenantId: context.tenantId,
      orgId: context.orgId,
      objectType: auditObjectType,
      objectId: after.id,
      beforeState: stableCommercialJson(beforeState) as Prisma.InputJsonValue,
      afterState: stableCommercialJson(afterState) as Prisma.InputJsonValue,
      outcome: 'SUCCESS',
      reason: command.reason.trim(),
      metadata: stableCommercialJson({
        schema: 'commercial-rule.audit.v1', commandId: command.commandId,
        idempotencyKey: command.idempotencyKey, membershipId: user.membershipId,
        sessionId: context.sessionId, requestFingerprint, createsFinancialObligation: false,
      }) as Prisma.InputJsonValue,
      correlationId: command.correlationId,
      runtimeIdempotencyKey: outboxKey,
      hash: commercialDigest(auditMaterial),
      prevHash: previousAudit?.hash ?? null,
      createdAt: committedAt,
    }});

    const previousEvents = await tx.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
      SELECT "hash" FROM public."commercial_rule_events"
       WHERE "tenantId" = ${context.tenantId} AND "organizationId" = ${context.orgId}
         AND "aggregateType" = ${command.aggregateType} AND "aggregateId" = ${after.id}
       ORDER BY "createdAt" DESC, "id" DESC LIMIT 1
    `);
    const eventMaterial = {
      id: eventId, tenantId: context.tenantId, organizationId: context.orgId,
      aggregateType: command.aggregateType, aggregateId: after.id, action: command.action,
      resultStatus: after.status, commandId: command.commandId, idempotencyKey: command.idempotencyKey,
      requestFingerprint, reason: command.reason.trim(), actorUserId: context.userId,
      actorRole: context.role, actorMembershipId: user.membershipId!, correlationId: command.correlationId,
      beforeState, afterState, prevHash: previousEvents[0]?.hash ?? null,
      auditEventId: auditId, outboxEntryId, aggregateVersion: after.stateVersion.toString(),
    };
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."commercial_rule_events" (
        "id", "tenantId", "organizationId", "aggregateType", "aggregateId", "action", "resultStatus",
        "commandId", "idempotencyKey", "requestFingerprint", "reason", "actorUserId", "actorRole",
        "actorMembershipId", "correlationId", "beforeState", "afterState", "prevHash", "hash",
        "auditEventId", "outboxEntryId", "aggregateVersion", "createdAt"
      ) VALUES (
        ${eventId}, ${context.tenantId}, ${context.orgId}, ${command.aggregateType}, ${after.id}, ${command.action}, ${after.status},
        ${command.commandId}, ${command.idempotencyKey}, ${requestFingerprint}, ${command.reason.trim()}, ${context.userId}, ${context.role},
        ${user.membershipId!}, ${command.correlationId}, ${JSON.stringify(stableCommercialJson(beforeState))}::jsonb,
        ${JSON.stringify(stableCommercialJson(afterState))}::jsonb, ${previousEvents[0]?.hash ?? null}, ${commercialDigest(eventMaterial)},
        ${auditId}, ${outboxEntryId}, ${after.stateVersion}, ${committedAt}
      )
    `);
    const event = {
      type: 'commercial.rule.changed.v1', aggregateType: command.aggregateType,
      aggregateId: after.id, commandId: command.commandId, organizationId: context.orgId,
      tenantId: context.tenantId, action: command.action, status: after.status,
      aggregateVersion: after.stateVersion.toString(), correlationId: command.correlationId,
      auditId, occurredAt: committedAt.toISOString(), createsFinancialObligation: false,
    };
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO public."outbox_entries" (
        "id", "type", "payload", "status", "triggeredByUserId", "idempotencyKey",
        "correlationId", "auditId", "runtimeIdempotencyKey", "maxRetries", "nextRetryAt", "createdAt"
      ) VALUES (
        ${outboxEntryId}, ${event.type}, ${JSON.stringify({ schema: 'commercial-rule.command.v1', requestFingerprint, receipt, event })}::jsonb,
        'PENDING', ${context.userId}, ${outboxKey}, ${command.correlationId}, ${auditId}, ${outboxKey}, 5, ${committedAt}, ${committedAt}
      )
    `);
    return receipt;
  }

  private async findReplay(
    tx: Prisma.TransactionClient,
    context: TrustedRlsContext,
    command: CommercialRuleCommand,
    fingerprint: string,
  ): Promise<CommercialRuleCommandReceipt | null> {
    const rows = await tx.$queryRaw<ReplayRow[]>(Prisma.sql`
      SELECT "aggregateType", "aggregateId", "aggregateVersion", "action", "resultStatus",
        "commandId", "idempotencyKey", "correlationId", "requestFingerprint", "afterState", "createdAt"
      FROM public."commercial_rule_events" WHERE "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId} AND "idempotencyKey" = ${command.idempotencyKey} LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    if (row.requestFingerprint !== fingerprint) {
      throw new ConflictException({ code: 'COMMERCIAL_RULE_IDEMPOTENCY_PAYLOAD_MISMATCH' });
    }
    return {
      commandId: row.commandId,
      idempotencyKey: row.idempotencyKey,
      correlationId: row.correlationId,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      aggregateKey: String(row.afterState.aggregateKey),
      action: row.action,
      status: row.resultStatus,
      version: String(row.afterState.version),
      stateVersion: row.aggregateVersion.toString(),
      contentHash: String(row.afterState.contentHash),
      replayed: true,
      committedAt: row.createdAt.toISOString(),
    };
  }

  private async listRuleSets(tx: Prisma.TransactionClient, context: TrustedRlsContext): Promise<VersionRow[]> {
    return tx.$queryRaw<VersionRow[]>(Prisma.sql`
      SELECT *, "ruleSetKey" AS "aggregateKey", "rules" AS "content"
      FROM public."commercial_rule_sets" WHERE "tenantId" = ${context.tenantId} AND "organizationId" = ${context.orgId}
      ORDER BY "ruleSetKey", "version" DESC
    `);
  }

  private async listRulePacks(tx: Prisma.TransactionClient, context: TrustedRlsContext): Promise<VersionRow[]> {
    return tx.$queryRaw<VersionRow[]>(Prisma.sql`
      SELECT *, "rulePackKey" AS "aggregateKey", "entries" AS "content", NULL::text AS "currency"
      FROM public."commercial_rule_packs" WHERE "tenantId" = ${context.tenantId} AND "organizationId" = ${context.orgId}
      ORDER BY "rulePackKey", "version" DESC
    `);
  }

  private async findPublishedRuleSet(tx: Prisma.TransactionClient, context: TrustedRlsContext, id: string): Promise<VersionRow | null> {
    const rows = await tx.$queryRaw<VersionRow[]>(Prisma.sql`
      SELECT *, "ruleSetKey" AS "aggregateKey", "rules" AS "content"
      FROM public."commercial_rule_sets" WHERE "id" = ${id} AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId} AND "status" = 'PUBLISHED' LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private async findPublishedRulePack(tx: Prisma.TransactionClient, context: TrustedRlsContext, id: string): Promise<VersionRow | null> {
    const rows = await tx.$queryRaw<VersionRow[]>(Prisma.sql`
      SELECT *, "rulePackKey" AS "aggregateKey", "entries" AS "content", NULL::text AS "currency"
      FROM public."commercial_rule_packs" WHERE "id" = ${id} AND "tenantId" = ${context.tenantId}
        AND "organizationId" = ${context.orgId} AND "status" = 'PUBLISHED' LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private assertEffective(row: VersionRow, now: Date): void {
    if (row.effectiveFrom && row.effectiveFrom > now) throw new UnprocessableEntityException({ code: 'COMMERCIAL_RULE_NOT_YET_EFFECTIVE' });
    if (row.effectiveTo && row.effectiveTo <= now) throw new UnprocessableEntityException({ code: 'COMMERCIAL_RULE_EXPIRED' });
  }

  private versionSnapshot(type: AggregateType, row: VersionRow) {
    return {
      aggregateType: type,
      aggregateId: row.id,
      aggregateKey: row.aggregateKey,
      version: row.version.toString(),
      stateVersion: row.stateVersion.toString(),
      status: row.status,
      name: row.name,
      currency: row.currency,
      contentHash: row.contentHash,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      retiredAt: row.retiredAt?.toISOString() ?? null,
    };
  }

  private versionView(type: AggregateType, row: VersionRow) {
    return { ...this.versionSnapshot(type, row), content: stableCommercialJson(row.content) };
  }

  private decisionView(row: DecisionRow, replayed: boolean) {
    return {
      decisionId: row.id,
      decisionKey: row.decisionKey,
      correlationId: row.correlationId,
      ruleSet: { id: row.ruleSetId, key: row.ruleSetKey, version: row.ruleSetVersion.toString(), contentHash: row.ruleSetContentHash },
      rulePack: row.rulePackId ? { id: row.rulePackId, key: row.rulePackKey, version: row.rulePackVersion!.toString(), contentHash: row.rulePackContentHash } : null,
      decision: stableCommercialJson(row.output),
      outputHash: row.outputHash,
      replayed,
      createsFinancialObligation: false,
      decidedAt: row.createdAt.toISOString(),
    };
  }
}

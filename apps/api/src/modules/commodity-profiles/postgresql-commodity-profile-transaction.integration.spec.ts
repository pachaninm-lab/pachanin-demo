import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import {
  commodityProfileCommandFingerprint,
  CommodityProfileCommandValidationError,
  type CommodityProfileCommand,
  type CommodityProfileCommandReceipt,
} from './commodity-profile-command.contract';
import { PostgresqlCommodityProfileTransactionPort } from './postgresql-commodity-profile-transaction.port';
import {
  CommodityProfileTransactionCommandService,
  type CommodityProfileAtomicWrite,
} from './commodity-profile-transaction-command.service';

const describePostgresql = process.env.PC_CROP_01B3_POSTGRESQL === '1'
  ? describe
  : describe.skip;

function sha256(value: string): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function deterministicId(prefix: string, commandId: string): string {
  return `${prefix}-${sha256(commandId).slice(0, 32)}`;
}

function outboxKey(idempotencyKey: string): string {
  return `cp-command:${sha256(idempotencyKey)}`;
}

function exceptionCode(error: unknown): string | null {
  if (error instanceof ConflictException) {
    const response = error.getResponse();
    if (response && typeof response === 'object' && 'code' in response) {
      const code = (response as { code?: unknown }).code;
      return typeof code === 'string' ? code : null;
    }
  }
  return null;
}

describePostgresql('PC-CROP-01B.3 PostgreSQL 16 command authority', () => {
  const exactHead = process.env.EXACT_HEAD ?? process.env.GITHUB_SHA ?? 'local-head';
  const suffix = exactHead.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'local';
  const profileId = `pc01b3-profile-${suffix}`;
  const actor: RequestUser = {
    id: `pc01b3-user-${suffix}`,
    orgId: `pc01b3-org-${suffix}`,
    tenantId: `pc01b3-tenant-${suffix}`,
    role: Role.ADMIN,
    email: `pc01b3-${suffix}@example.test`,
    sessionId: `pc01b3-session-${suffix}`,
    membershipId: `pc01b3-membership-${suffix}`,
    mfaVerified: true,
    staffRoles: ['PLATFORM_ADMIN', 'COMPLIANCE_CONTROL'],
  };

  const prisma = new PrismaService();
  const rls = new RlsTransactionService(prisma);
  const port = new PostgresqlCommodityProfileTransactionPort(rls);
  const service = new CommodityProfileTransactionCommandService(port);

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('proves lifecycle authority, one-winner race, replay, mismatch and atomic rollback', async () => {
    const createProfile: CommodityProfileCommand = {
      commandId: `pc01b3-create-profile-${suffix}`,
      idempotencyKey: `pc01b3-idem-create-profile-${suffix}`,
      correlationId: `pc01b3-corr-create-profile-${suffix}`,
      profileId,
      action: 'CREATE_PROFILE',
      expectedVersion: '0',
      reason: 'Создание изолированного профиля для PostgreSQL acceptance PC-CROP-01B.3.',
      payload: {
        canonicalCode: `PC01B3.WHEAT.${suffix.toUpperCase()}`,
        archetype: 'DRY_BULK',
        authoritativeNameRu: 'Пшеница для атомарной приёмки PC-CROP-01B.3',
        displayNameEn: 'PC-CROP-01B.3 atomic acceptance wheat',
        classification: 'INTERNAL',
      },
    };
    const identityReceipt = await service.execute(actor, createProfile);
    expect(identityReceipt).toMatchObject({ version: '0', replayed: false });

    const createDraft: CommodityProfileCommand = {
      commandId: `pc01b3-create-draft-${suffix}`,
      idempotencyKey: `pc01b3-idem-create-draft-${suffix}`,
      correlationId: `pc01b3-corr-create-draft-${suffix}`,
      profileId,
      action: 'CREATE_DRAFT',
      expectedVersion: '0',
      reason: 'Создание первой версии профиля для проверки атомарного lifecycle-контура.',
      payload: {
        sourceStatus: 'VERIFIED',
        content: {
          schemaVersion: 'commodity-profile.content.v1',
          crop: 'WHEAT',
          quality: [{ code: 'PROTEIN', unit: 'PERCENT', minimum: '12.5' }],
        },
      },
    };
    const draftReceipt = await service.execute(actor, createDraft);
    expect(draftReceipt).toMatchObject({ lifecycle: 'DRAFT', version: '1' });
    expect(draftReceipt.profileVersionId).toBeTruthy();
    const profileVersionId = draftReceipt.profileVersionId!;

    const submitReview: CommodityProfileCommand = {
      commandId: `pc01b3-submit-review-${suffix}`,
      idempotencyKey: `pc01b3-idem-submit-review-${suffix}`,
      correlationId: `pc01b3-corr-submit-review-${suffix}`,
      profileId,
      profileVersionId,
      action: 'SUBMIT_REVIEW',
      expectedVersion: '1',
      reason: 'Версия заполнена и передаётся в управляемую проверку комплаенсом.',
    };
    const reviewReceipt = await service.execute(actor, submitReview);
    expect(reviewReceipt).toMatchObject({ lifecycle: 'REVIEW', version: '2' });

    const approveA: CommodityProfileCommand = {
      commandId: `pc01b3-approve-a-${suffix}`,
      idempotencyKey: `pc01b3-idem-approve-a-${suffix}`,
      correlationId: `pc01b3-corr-approve-a-${suffix}`,
      profileId,
      profileVersionId,
      action: 'APPROVE',
      expectedVersion: '2',
      reason: 'Комплаенс подтвердил корректность первой конкурентной команды утверждения.',
    };
    const approveB: CommodityProfileCommand = {
      ...approveA,
      commandId: `pc01b3-approve-b-${suffix}`,
      idempotencyKey: `pc01b3-idem-approve-b-${suffix}`,
      correlationId: `pc01b3-corr-approve-b-${suffix}`,
      reason: 'Комплаенс подтвердил корректность второй конкурентной команды утверждения.',
    };
    const write = (command: CommodityProfileCommand): CommodityProfileAtomicWrite => ({
      command,
      actor,
      requestFingerprint: commodityProfileCommandFingerprint(command),
      fromLifecycle: 'REVIEW',
      toLifecycle: 'APPROVED',
    });

    const race = await Promise.allSettled([
      port.commitAtomic(write(approveA)),
      port.commitAtomic(write(approveB)),
    ]);
    const winners = race.filter(
      (result): result is PromiseFulfilledResult<CommodityProfileCommandReceipt> =>
        result.status === 'fulfilled',
    );
    const losers = race.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect([
      'COMMODITY_PROFILE_STALE_VERSION',
      'COMMODITY_PROFILE_CONCURRENT_COMMAND',
    ]).toContain(exceptionCode(losers[0]!.reason));

    const winnerReceipt = winners[0]!.value;
    const winnerCommand = winnerReceipt.commandId === approveA.commandId ? approveA : approveB;
    const loserCommand = winnerCommand.commandId === approveA.commandId ? approveB : approveA;
    expect(winnerReceipt).toMatchObject({ lifecycle: 'APPROVED', version: '3' });

    const replay = await service.execute(actor, winnerCommand, { hasJitAuthority: true });
    expect(replay).toEqual({ ...winnerReceipt, replayed: true });

    const mismatchedReplay = {
      ...winnerCommand,
      reason: `${winnerCommand.reason} Изменённый payload повторной команды.`,
    };
    await expect(service.execute(actor, mismatchedReplay, { hasJitAuthority: true }))
      .rejects.toBeInstanceOf(CommodityProfileCommandValidationError);

    const activation: CommodityProfileCommand = {
      commandId: `pc01b3-activate-rollback-${suffix}`,
      idempotencyKey: `pc01b3-idem-activate-rollback-${suffix}`,
      correlationId: `pc01b3-corr-activate-rollback-${suffix}`,
      profileId,
      profileVersionId,
      action: 'ACTIVATE',
      expectedVersion: '3',
      reason: 'Принудительная проверка полного rollback при конфликте immutable AuditEvent.',
      payload: { effectiveFrom: '2035-01-01T00:00:00.000Z' },
    };
    const collisionAuditId = deterministicId('audit-cp', activation.commandId);
    await prisma.auditEvent.create({
      data: {
        id: collisionAuditId,
        action: 'PC_CROP_01B3_COLLISION_SENTINEL',
        actorUserId: actor.id,
        actorRole: actor.role,
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        objectType: 'COMMODITY_PROFILE_VERSION',
        objectId: profileVersionId,
        outcome: 'SENTINEL',
        reason: 'Преднамеренный уникальный конфликт для проверки атомарного rollback.',
        correlationId: activation.correlationId,
        hash: 'd'.repeat(64),
      },
    });

    await expect(service.execute(actor, activation, { hasJitAuthority: true }))
      .rejects.toBeInstanceOf(ConflictException);

    const [finalProfile, finalVersion, transitions, commandAuditCount, outboxCount] = await Promise.all([
      prisma.commodityProfile.findUniqueOrThrow({ where: { id: profileId } }),
      prisma.commodityProfileVersion.findUniqueOrThrow({ where: { id: profileVersionId } }),
      prisma.commodityProfileTransition.findMany({
        where: { profileId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.auditEvent.count({
        where: {
          actorUserId: actor.id,
          action: { startsWith: 'COMMODITY_PROFILE_' },
          objectId: { in: [profileId, profileVersionId] },
        },
      }),
      prisma.outboxEntry.count({
        where: {
          triggeredByUserId: actor.id,
          type: { startsWith: 'commodity.profile.' },
        },
      }),
    ]);

    expect(finalProfile.version).toBe(3n);
    expect(finalVersion.status).toBe('APPROVED');
    expect(finalVersion.version).toBe(2n);
    expect(transitions).toHaveLength(3);
    expect(transitions.map((transition) => transition.toStatus))
      .toEqual(['DRAFT', 'REVIEW', 'APPROVED']);
    expect(transitions[0]!.prevHash).toBeNull();
    expect(transitions[1]!.prevHash).toBe(transitions[0]!.hash);
    expect(transitions[2]!.prevHash).toBe(transitions[1]!.hash);
    expect(commandAuditCount).toBe(4);
    expect(outboxCount).toBe(4);
    expect(await prisma.commodityProfileTransition.count({
      where: { commandId: activation.commandId },
    })).toBe(0);
    expect(await prisma.outboxEntry.findUnique({
      where: { idempotencyKey: outboxKey(activation.idempotencyKey) },
    })).toBeNull();
    expect(await prisma.auditEvent.count({ where: { id: collisionAuditId } })).toBe(1);
    expect(await prisma.commodityProfileTransition.count({
      where: { commandId: loserCommand.commandId },
    })).toBe(0);

    const evidenceDir = process.env.PC_CROP_EVIDENCE_DIR;
    if (evidenceDir) {
      await mkdir(evidenceDir, { recursive: true });
      await writeFile(
        `${evidenceDir}/acceptance.json`,
        `${JSON.stringify({
          schemaVersion: 'pc-crop.command-authority-acceptance.v1',
          slice: 'PC-CROP-01B.3',
          status: 'PASS',
          operationalStatus: 'NOT_ATTESTED',
          exactHead,
          postgresql: '16',
          invariants: {
            lifecyclePath: ['DRAFT', 'REVIEW', 'APPROVED'],
            concurrentWinnerCount: winners.length,
            concurrentLoserCount: losers.length,
            aggregateVersion: finalProfile.version.toString(),
            versionRowVersion: finalVersion.version.toString(),
            transitionCount: transitions.length,
            transitionHashChainValid: true,
            commandAuditCount,
            outboxCount,
            exactReplay: replay.replayed,
            payloadMismatchRejected: true,
            forcedAuditCollisionRollback: true,
            failedActivationTransitionCount: 0,
            failedActivationOutboxCount: 0,
          },
          boundaries: {
            bffRoutePublished: false,
            externalNetworkCallInTransaction: false,
            productionOperationalEvidence: false,
          },
        }, null, 2)}\n`,
        'utf8',
      );
    }
  }, 60_000);
});

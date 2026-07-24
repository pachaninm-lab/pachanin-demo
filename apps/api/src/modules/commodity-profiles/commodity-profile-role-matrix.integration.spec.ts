import { mkdir, writeFile } from 'node:fs/promises';
import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role, type RequestUser } from '../../common/types/request-user';
import type { CommodityProfileCommand } from './commodity-profile-command.contract';
import { CommodityProfileAction } from './commodity-profile.policy';
import { CommodityProfileTransactionCommandService } from './commodity-profile-transaction-command.service';
import { CommodityProfilesModule } from './commodity-profiles.module';

const describePostgresql = process.env.PC_CROP_01B4_POSTGRESQL === '1'
  ? describe
  : describe.skip;

function identifier(...parts: string[]): string {
  return parts.join('-');
}

function actor(role: Role, suffix: string, staff = false): RequestUser {
  return {
    id: identifier('pc01b4-matrix-user', role.toLowerCase(), suffix),
    orgId: identifier('pc01b4-matrix-org', suffix),
    tenantId: identifier('pc01b4-matrix-tenant', suffix),
    membershipId: identifier('pc01b4-matrix-membership', role.toLowerCase(), suffix),
    sessionId: identifier('pc01b4-matrix-session', role.toLowerCase(), suffix),
    role,
    email: `${role.toLowerCase()}.matrix.${suffix}@example.test`,
    mfaVerified: true,
    ...(staff
      ? {
          staffRoles: ['PLATFORM_ADMIN', 'COMPLIANCE_CONTROL'],
          staffAssignmentIds: [identifier('pc01b4-matrix-assignment', suffix)],
        }
      : {}),
  };
}

describePostgresql('PC-CROP-01B.4 PostgreSQL role matrix', () => {
  jest.setTimeout(120_000);

  const exactHead = process.env.EXACT_HEAD ?? process.env.GITHUB_SHA ?? 'local-head';
  const suffix = exactHead.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'local';
  const profileId = identifier('pc01b4-matrix-profile', suffix);
  const privilegedActor = actor(Role.ADMIN, suffix, true);
  let prisma: PrismaService;
  let commands: CommodityProfileTransactionCommandService;
  let profileVersionId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [CommodityProfilesModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    commands = moduleRef.get(CommodityProfileTransactionCommandService);
    await prisma.$connect();

    const createProfile: CommodityProfileCommand = {
      commandId: identifier('pc01b4-matrix-create-profile', suffix),
      idempotencyKey: identifier('pc01b4-matrix-idem-profile', suffix),
      correlationId: identifier('pc01b4-matrix-corr-profile', suffix),
      profileId,
      action: CommodityProfileAction.CREATE_PROFILE,
      expectedVersion: '0',
      reason: 'Create isolated aggregate for the canonical role denial matrix.',
      payload: {
        canonicalCode: `PC01B4.MATRIX.${suffix.toUpperCase()}`,
        archetype: 'DRY_BULK',
        authoritativeNameRu: 'Профиль для матрицы полномочий',
        classification: 'INTERNAL',
      },
    };
    await commands.execute(privilegedActor, createProfile);

    const createDraft: CommodityProfileCommand = {
      commandId: identifier('pc01b4-matrix-create-draft', suffix),
      idempotencyKey: identifier('pc01b4-matrix-idem-draft', suffix),
      correlationId: identifier('pc01b4-matrix-corr-draft', suffix),
      profileId,
      action: CommodityProfileAction.CREATE_DRAFT,
      expectedVersion: '0',
      reason: 'Create draft for the canonical role denial matrix.',
      payload: {
        sourceStatus: 'VERIFIED',
        content: { schemaVersion: 'commodity-profile.content.v1', crop: 'WHEAT' },
      },
    };
    profileVersionId = (await commands.execute(privilegedActor, createDraft)).profileVersionId!;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('denies every canonical human role without durable staff authority', async () => {
    const roles = Object.values(Role).filter(
      (role) => role !== Role.GUEST && role !== Role.BANK_CALLBACK,
    );
    const staffEligible = new Set<Role>([
      Role.ADMIN,
      Role.COMPLIANCE_OFFICER,
      Role.SUPPORT_MANAGER,
    ]);
    const denialCodes: Record<string, string> = {};

    for (const role of roles) {
      const command: CommodityProfileCommand = {
        commandId: identifier('pc01b4-matrix-denied-command', role.toLowerCase(), suffix),
        idempotencyKey: identifier('pc01b4-matrix-denied-idem', role.toLowerCase(), suffix),
        correlationId: identifier('pc01b4-matrix-denied-corr', role.toLowerCase(), suffix),
        profileId,
        profileVersionId,
        action: CommodityProfileAction.UPDATE_DRAFT,
        expectedVersion: '1',
        reason: `Negative authority matrix for canonical role ${role}.`,
        payload: {
          sourceStatus: 'VERIFIED',
          content: { schemaVersion: 'commodity-profile.content.v1', crop: 'WHEAT', role },
        },
      };

      try {
        await commands.execute(actor(role, suffix, false), command);
        throw new Error(`role ${role} unexpectedly executed a commodity profile write`);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        const response = (error as ForbiddenException).getResponse() as { code?: string };
        const expectedCode = staffEligible.has(role)
          ? 'STAFF_AUTHORITY_REQUIRED'
          : 'ROLE_READ_ONLY';
        expect(response.code).toBe(expectedCode);
        denialCodes[role] = expectedCode;
      }
    }

    const profile = await prisma.commodityProfile.findUniqueOrThrow({
      where: { id: profileId },
      select: { version: true },
    });
    expect(profile.version).toBe(1n);

    const evidenceDir = process.env.PC_CROP_EVIDENCE_DIR;
    if (evidenceDir) {
      await mkdir(evidenceDir, { recursive: true });
      await writeFile(
        `${evidenceDir}/postgresql-role-matrix.json`,
        `${JSON.stringify({
          schemaVersion: 'pc-crop.private-bff-role-matrix.v1',
          slice: 'PC-CROP-01B.4',
          status: 'PASS',
          operationalStatus: 'NOT_ATTESTED',
          exactHead,
          postgresql: '16',
          roleCount: roles.length,
          denialCodes,
          aggregateVersion: profile.version.toString(),
        }, null, 2)}\n`,
        'utf8',
      );
    }
  });
});

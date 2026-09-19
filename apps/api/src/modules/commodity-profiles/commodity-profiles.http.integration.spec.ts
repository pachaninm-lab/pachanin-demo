import { mkdir, writeFile } from 'node:fs/promises';
import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolesGuard } from '../../common/guards/roles.guard';
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

describePostgresql('PC-CROP-01B.4 PostgreSQL HTTP authority', () => {
  jest.setTimeout(120_000);

  const exactHead = process.env.EXACT_HEAD ?? process.env.GITHUB_SHA ?? 'local-head';
  const suffix = exactHead.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'local';
  const profileId = identifier('pc01b4-profile', suffix);
  const privilegedActor: RequestUser = {
    id: identifier('pc01b4-user', suffix),
    orgId: identifier('pc01b4-org', suffix),
    tenantId: identifier('pc01b4-tenant', suffix),
    membershipId: identifier('pc01b4-membership', suffix),
    sessionId: identifier('pc01b4-session', suffix),
    role: Role.ADMIN,
    email: `pc01b4.${suffix}@example.test`,
    mfaVerified: true,
    staffRoles: ['PLATFORM_ADMIN', 'COMPLIANCE_CONTROL'],
    staffAssignmentIds: [identifier('pc01b4-assignment', suffix)],
  };

  let app: INestApplication;
  let prisma: PrismaService;
  let commands: CommodityProfileTransactionCommandService;
  let firstVersionId = '';
  let secondVersionId = '';

  const trustedGuard: CanActivate = {
    canActivate(context: ExecutionContext): boolean {
      context.switchToHttp().getRequest().user = privilegedActor;
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [CommodityProfilesModule] })
      .overrideGuard(RolesGuard)
      .useValue(trustedGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleRef.get(PrismaService);
    commands = moduleRef.get(CommodityProfileTransactionCommandService);
    await prisma.$connect();

    const createProfile: CommodityProfileCommand = {
      commandId: identifier('pc01b4-create-profile', suffix),
      idempotencyKey: identifier('pc01b4-idem-profile', suffix),
      correlationId: identifier('pc01b4-corr-profile', suffix),
      profileId,
      action: CommodityProfileAction.CREATE_PROFILE,
      expectedVersion: '0',
      reason: 'Create isolated profile for private HTTP authority acceptance.',
      payload: {
        canonicalCode: `PC01B4.WHEAT.${suffix.toUpperCase()}`,
        archetype: 'DRY_BULK',
        authoritativeNameRu: 'Пшеница для private HTTP acceptance',
        classification: 'INTERNAL',
      },
    };
    await commands.execute(privilegedActor, createProfile);

    const draft = async (ordinal: string, expectedVersion: string, sourceStatus: string) => {
      const command: CommodityProfileCommand = {
        commandId: identifier('pc01b4-draft', ordinal, suffix),
        idempotencyKey: identifier('pc01b4-idem-draft', ordinal, suffix),
        correlationId: identifier('pc01b4-corr-draft', ordinal, suffix),
        profileId,
        action: CommodityProfileAction.CREATE_DRAFT,
        expectedVersion,
        reason: `Create ${ordinal} deterministic version for history acceptance.`,
        payload: {
          sourceStatus,
          content: {
            schemaVersion: 'commodity-profile.content.v1',
            crop: 'WHEAT',
            ordinal,
          },
        },
      };
      return commands.execute(privilegedActor, command);
    };

    firstVersionId = (await draft('first', '0', 'VERIFIED')).profileVersionId!;
    secondVersionId = (await draft('second', '1', 'REVERIFY_REQUIRED')).profileVersionId!;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('proves reads, history, replay, mismatched replay and stale snapshot', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/platform-v7/commodity-profiles')
      .query({ search: 'PC01B4.WHEAT', limit: 10 })
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ id: profileId, version: '2' });

    const detail = await request(app.getHttpServer())
      .get(`/api/platform-v7/commodity-profiles/${profileId}`)
      .query({ versionId: firstVersionId })
      .expect(200);
    expect(detail.body.selectedVersion).toMatchObject({ id: firstVersionId, sequence: 1 });
    expect(detail.headers.etag).toBe('"2"');

    const history = await request(app.getHttpServer())
      .get(`/api/platform-v7/commodity-profiles/${profileId}/versions`)
      .query({ limit: 10 })
      .expect(200);
    expect(history.headers.etag).toBe('"2"');
    expect(history.body.items.map((item: { id: string }) => item.id))
      .toEqual([secondVersionId, firstVersionId]);

    await request(app.getHttpServer())
      .get('/api/platform-v7/commodity-profiles')
      .query({ tenantId: 'client-selected-tenant' })
      .expect(400);

    const updateBody = {
      commandId: identifier('pc01b4-update', suffix),
      idempotencyKey: identifier('pc01b4-idem-update', suffix),
      correlationId: identifier('pc01b4-corr-update', suffix),
      profileVersionId: secondVersionId,
      reason: 'Update the second draft through the private command route.',
      payload: {
        sourceStatus: 'VERIFIED',
        content: { schemaVersion: 'commodity-profile.content.v1', crop: 'WHEAT', ordinal: 'updated' },
      },
    };

    await request(app.getHttpServer())
      .post(`/api/platform-v7/commodity-profiles/${profileId}/commands/UPDATE_DRAFT`)
      .set('If-Match', '"2"')
      .send({ ...updateBody, role: Role.ADMIN })
      .expect(400);

    const update = await request(app.getHttpServer())
      .post(`/api/platform-v7/commodity-profiles/${profileId}/commands/UPDATE_DRAFT`)
      .set('If-Match', '"2"')
      .send(updateBody)
      .expect(200);
    expect(update.body).toMatchObject({ version: '3', replayed: false });

    const replay = await request(app.getHttpServer())
      .post(`/api/platform-v7/commodity-profiles/${profileId}/commands/UPDATE_DRAFT`)
      .set('If-Match', '"2"')
      .send(updateBody)
      .expect(200);
    expect(replay.body).toMatchObject({ version: '3', replayed: true });

    await request(app.getHttpServer())
      .post(`/api/platform-v7/commodity-profiles/${profileId}/commands/UPDATE_DRAFT`)
      .set('If-Match', '"2"')
      .send({ ...updateBody, reason: `${updateBody.reason} Changed replay payload.` })
      .expect(422)
      .expect(({ body }) => expect(body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH'));

    const stale = await request(app.getHttpServer())
      .post(`/api/platform-v7/commodity-profiles/${profileId}/commands/UPDATE_DRAFT`)
      .set('If-Match', '"2"')
      .send({
        ...updateBody,
        commandId: identifier('pc01b4-stale', suffix),
        idempotencyKey: identifier('pc01b4-idem-stale', suffix),
        correlationId: identifier('pc01b4-corr-stale', suffix),
      })
      .expect(409);
    expect(stale.body).toMatchObject({
      currentVersion: '3',
      currentEtag: '"3"',
      refreshRequired: true,
      current: { id: profileId, version: '3' },
    });

    const persisted = await prisma.commodityProfile.findUniqueOrThrow({
      where: { id: profileId },
      select: { version: true },
    });
    expect(persisted.version).toBe(3n);

    const evidenceDir = process.env.PC_CROP_EVIDENCE_DIR;
    if (evidenceDir) {
      await mkdir(evidenceDir, { recursive: true });
      await writeFile(
        `${evidenceDir}/postgresql-http-acceptance.json`,
        `${JSON.stringify({
          schemaVersion: 'pc-crop.private-bff-postgresql-acceptance.v1',
          slice: 'PC-CROP-01B.4',
          status: 'PASS',
          operationalStatus: 'NOT_ATTESTED',
          exactHead,
          postgresql: '16',
          invariants: {
            listCount: list.body.items.length,
            historyCount: history.body.items.length,
            exactReplay: replay.body.replayed,
            payloadMismatchRejected: true,
            staleSnapshotVersion: stale.body.current.version,
            clientAuthorityOverrideRejected: true,
            aggregateVersion: persisted.version.toString(),
          },
        }, null, 2)}\n`,
        'utf8',
      );
    }
  });
});

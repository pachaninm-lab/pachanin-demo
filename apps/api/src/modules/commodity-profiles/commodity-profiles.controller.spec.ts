import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Role, type RequestUser } from '../../common/types/request-user';
import { StaffAccessMode, StaffRole } from '../staff-access/staff-access.types';
import { CommodityProfileAction } from './commodity-profile.policy';
import { CommodityProfilesController, parseCommodityProfileIfMatch } from './commodity-profiles.controller';
import type { CommodityProfileRepository } from './commodity-profile.repository';
import type { CommodityProfileTransactionCommandService } from './commodity-profile-transaction-command.service';

const user: RequestUser = {
  id: 'user-admin-1',
  orgId: 'org-platform-1',
  tenantId: 'tenant-platform-1',
  membershipId: 'membership-admin-1',
  sessionId: 'session-admin-1',
  role: Role.ADMIN,
  email: 'admin@example.test',
  mfaVerified: true,
  staffRoles: [StaffRole.PLATFORM_ADMIN],
  staffAssignmentIds: ['assignment-1'],
};

const staffAccess = {
  accessSessionId: 'access-session-1',
  grantId: 'grant-1',
  actorUserId: user.id,
  staffRole: StaffRole.PLATFORM_ADMIN,
  accessMode: StaffAccessMode.JIT_PRIVILEGED,
  permissions: [],
  effectiveTenantId: null,
  effectiveOrganizationId: null,
  effectiveUserId: null,
  effectiveRole: null,
  targetDealId: null,
  reason: 'Approved commodity profile maintenance',
  ticketId: 'PC-CROP-2946',
  expiresAt: new Date(Date.now() + 60_000),
};

function responseHarness() {
  return {
    setHeader: jest.fn(),
  } as unknown as Response;
}

function makeController() {
  const readModel = {
    id: 'profile-wheat-1',
    canonicalCode: 'WHEAT.TEST',
    archetype: 'DRY_BULK',
    authoritativeNameRu: 'Пшеница тестовая',
    displayNameEn: 'Test wheat',
    displayNameZh: '测试小麦',
    classification: 'INTERNAL' as const,
    version: '7',
    updatedAt: '2026-07-21T08:00:00.000Z',
    selectedVersion: null,
    actions: [],
  };
  const repository = {
    list: jest.fn(async () => ({ items: [readModel], nextCursor: null })),
    getById: jest.fn(async () => readModel),
  } as unknown as jest.Mocked<CommodityProfileRepository>;
  const receipt = {
    commandId: 'command-approve-1',
    idempotencyKey: ['idem', 'approve', 'one'].join('-'),
    correlationId: 'correlation-approve-1',
    profileId: readModel.id,
    profileVersionId: 'profile-version-1',
    action: CommodityProfileAction.APPROVE,
    lifecycle: 'APPROVED' as const,
    version: '8',
    replayed: false,
    requestFingerprint: 'a'.repeat(64),
    committedAt: '2026-07-21T08:01:00.000Z',
  };
  const commands = {
    execute: jest.fn(async () => receipt),
  } as unknown as jest.Mocked<CommodityProfileTransactionCommandService>;
  return {
    controller: new CommodityProfilesController(repository, commands),
    repository,
    commands,
    readModel,
    receipt,
  };
}

describe('parseCommodityProfileIfMatch', () => {
  it.each([
    ['"7"', '7'],
    ['W/"7"', '7'],
    ['7', '7'],
    ['"0"', '0'],
  ])('accepts %s', (header, expected) => {
    expect(parseCommodityProfileIfMatch(header)).toBe(expected);
  });

  it('requires the header with HTTP 428', () => {
    try {
      parseCommodityProfileIfMatch(undefined);
      throw new Error('expected parseCommodityProfileIfMatch to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.PRECONDITION_REQUIRED);
    }
  });

  it.each(['*', '"-1"', '"01"', '"7", "8"'])('rejects unsafe token %s', (header) => {
    expect(() => parseCommodityProfileIfMatch(header)).toThrow(BadRequestException);
  });
});

describe('CommodityProfilesController', () => {
  it('passes only trusted user and server-resolved JIT authority to list', async () => {
    const { controller, repository } = makeController();
    const response = responseHarness();

    await controller.list(
      { limit: 25, lifecycle: 'EFFECTIVE', search: 'wheat' },
      user,
      { staffAccess },
      response,
    );

    expect(repository.list).toHaveBeenCalledWith(user, expect.objectContaining({
      limit: 25,
      lifecycle: 'EFFECTIVE',
      search: 'wheat',
      hasJitAuthority: true,
    }));
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it('returns an authoritative ETag for detail', async () => {
    const { controller, repository, readModel } = makeController();
    const response = responseHarness();

    await expect(controller.detail(
      readModel.id,
      { versionId: 'profile-version-1' },
      user,
      {},
      response,
    )).resolves.toEqual(readModel);

    expect(repository.getById).toHaveBeenCalledWith(user, readModel.id, {
      versionId: 'profile-version-1',
      effectiveAt: undefined,
      hasJitAuthority: false,
    });
    expect(response.setHeader).toHaveBeenCalledWith('ETag', '"7"');
  });

  it('binds URL action and If-Match to the single transaction command authority', async () => {
    const { controller, commands, receipt } = makeController();
    const response = responseHarness();

    await expect(controller.executeCommand(
      receipt.profileId,
      CommodityProfileAction.APPROVE,
      'W/"7"',
      {
        commandId: receipt.commandId,
        idempotencyKey: receipt.idempotencyKey,
        correlationId: receipt.correlationId,
        profileVersionId: receipt.profileVersionId,
        reason: 'Compliance approval after source review',
        payload: { sourceStatus: 'VERIFIED' },
      },
      user,
      { staffAccess },
      response,
    )).resolves.toEqual(receipt);

    expect(commands.execute).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        profileId: receipt.profileId,
        profileVersionId: receipt.profileVersionId,
        action: CommodityProfileAction.APPROVE,
        expectedVersion: '7',
      }),
      { hasJitAuthority: true },
    );
    expect(response.setHeader).toHaveBeenCalledWith('ETag', '"8"');
  });

  it('fails before command authority on missing If-Match or unknown action', async () => {
    const { controller, commands } = makeController();
    const response = responseHarness();
    const dto = {
      commandId: 'command-update-1',
      idempotencyKey: ['idem', 'update', 'one'].join('-'),
      correlationId: 'correlation-update-1',
      reason: 'Update draft after quality review',
    };

    await expect(controller.executeCommand(
      'profile-wheat-1',
      CommodityProfileAction.UPDATE_DRAFT,
      undefined,
      dto,
      user,
      {},
      response,
    )).rejects.toMatchObject({ status: HttpStatus.PRECONDITION_REQUIRED });

    await expect(controller.executeCommand(
      'profile-wheat-1',
      'READ',
      '"7"',
      dto,
      user,
      {},
      response,
    )).rejects.toBeInstanceOf(BadRequestException);

    expect(commands.execute).not.toHaveBeenCalled();
  });
});

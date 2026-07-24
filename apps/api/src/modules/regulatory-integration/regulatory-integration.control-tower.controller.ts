import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import {
  StaffAccessMode,
  StaffPermission,
  type StaffAccessContext,
} from '../staff-access/staff-access.types';
import {
  ExecuteRegulatoryIntegrationCommandDto,
  RegulatoryIntegrationDetailQueryDto,
  RegulatoryIntegrationListQueryDto,
} from './dto/regulatory-integration-control-tower.dto';
import {
  decideIntegrationControlTowerAction,
  IntegrationControlTowerAction,
} from './regulatory-integration.control-tower.policy';
import {
  IntegrationControlTowerRepositoryError,
  RegulatoryIntegrationControlTowerRepository,
} from './regulatory-integration.control-tower.repository';
import { RegulatoryIntegrationControlTowerCommandService } from './regulatory-integration.control-tower.command.service';
import { RegulatoryInboxAuthorityError } from './regulatory-integration.inbox-policy';
import { RegulatoryInboxLifecycleError } from './regulatory-integration.inbox-lifecycle.repository';

const SAFE_ADAPTER_CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,63}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;

type AuthenticatedRequest = { staffAccess?: StaffAccessContext };

export function parseIntegrationIfMatch(value: string | undefined): string {
  if (!value?.trim()) {
    throw new HttpException(
      { code: 'INTEGRATION_IF_MATCH_REQUIRED', retryable: false },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }
  const normalized = value.trim();
  const match = /^(?:W\/)?>?"(0|[1-9][0-9]{0,18})"$/.exec(normalized)
    ?? /^(0|[1-9][0-9]{0,18})$/.exec(normalized);
  if (!match) {
    throw new BadRequestException({ code: 'INTEGRATION_IF_MATCH_INVALID', retryable: false });
  }
  return match[1]!;
}

function etag(version: string): string {
  return `"${version}"`;
}

function hasJitAuthority(user: RequestUser, request: AuthenticatedRequest): boolean {
  const access = request.staffAccess;
  if (!access || access.accessMode !== StaffAccessMode.JIT_PRIVILEGED) return false;
  if (access.actorUserId !== user.id) return false;
  if (!(access.expiresAt instanceof Date) || access.expiresAt.getTime() <= Date.now()) return false;
  if (!Array.isArray(access.permissions)) return false;
  const hasCriticalPermission = access.permissions.includes(StaffPermission.CRITICAL_ACTION_REQUEST)
    || access.permissions.includes(StaffPermission.CRITICAL_ACTION_APPROVE);
  if (!hasCriticalPermission) return false;
  if (access.effectiveTenantId === null && access.effectiveOrganizationId === null) return false;
  if (access.effectiveTenantId !== null && access.effectiveTenantId !== user.tenantId) return false;
  if (access.effectiveOrganizationId !== null && access.effectiveOrganizationId !== user.orgId) return false;
  if (access.effectiveUserId !== null || access.effectiveRole !== null || access.targetDealId != null) return false;
  return true;
}

function assertRead(user: RequestUser): void {
  const decision = decideIntegrationControlTowerAction({
    user,
    action: IntegrationControlTowerAction.READ,
  });
  if (!decision.allowed) {
    throw new ForbiddenException({
      code: `INTEGRATION_${decision.reasonCode}`,
      retryable: false,
    });
  }
}

function assertCommand(
  user: RequestUser,
  request: AuthenticatedRequest,
  action: 'REDRIVE' | 'RECONCILE',
  reason: string,
): void {
  const decision = decideIntegrationControlTowerAction({
    user,
    action,
    hasJitAuthority: hasJitAuthority(user, request),
    hasHumanReason: reason.trim().length >= 12,
    redriveAvailable: action === 'REDRIVE',
  });
  if (!decision.allowed) {
    throw new ForbiddenException({
      code: `INTEGRATION_${decision.reasonCode}`,
      retryable: false,
    });
  }
}

function mapRepositoryError(error: IntegrationControlTowerRepositoryError): never {
  const payload = { code: `INTEGRATION_${error.code}`, message: error.message, retryable: false };
  if (error.code === 'ADAPTER_NOT_FOUND') throw new NotFoundException(payload);
  if (error.code === 'STALE_VERSION') throw new ConflictException({ ...payload, retryable: true });
  if (error.code === 'CURSOR_INVALID' || error.code === 'QUERY_INVALID') {
    throw new BadRequestException(payload);
  }
  throw new ConflictException(payload);
}

function rethrowControlTowerError(error: unknown): never {
  if (error instanceof IntegrationControlTowerRepositoryError) return mapRepositoryError(error);
  if (error instanceof RegulatoryInboxAuthorityError || error instanceof RegulatoryInboxLifecycleError) {
    throw new ConflictException({
      code: 'INTEGRATION_COMMAND_REJECTED',
      message: error.message,
      retryable: false,
    });
  }
  throw error;
}

@UseGuards(RolesGuard)
@Roles('ANY_AUTHENTICATED')
@Controller('platform-v7/integrations')
export class RegulatoryIntegrationControlTowerController {
  constructor(
    private readonly repository: RegulatoryIntegrationControlTowerRepository,
    private readonly commands: RegulatoryIntegrationControlTowerCommandService,
  ) {}

  @Get()
  @RateLimit({ name: 'integration_control_tower_list', scope: 'user', limit: 120, windowSeconds: 60 })
  async list(
    @Query() query: RegulatoryIntegrationListQueryDto,
    @CurrentUser() user: RequestUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertRead(user);
    response.setHeader('Cache-Control', 'private, no-store');
    try {
      return await this.repository.list(user, {
        limit: query.limit,
        cursor: query.cursor,
        adapterCode: query.adapterCode,
        status: query.status,
        environment: query.environment,
        state: query.state,
        provider: query.provider,
        hasJitAuthority: hasJitAuthority(user, request),
      });
    } catch (error) {
      return rethrowControlTowerError(error);
    }
  }

  @Get(':adapterCode')
  @RateLimit({
    name: 'integration_control_tower_detail',
    scope: 'user',
    limit: 180,
    windowSeconds: 60,
    includeParams: ['adapterCode'],
  })
  async detail(
    @Param('adapterCode') adapterCode: string,
    @Query() query: RegulatoryIntegrationDetailQueryDto,
    @CurrentUser() user: RequestUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    assertRead(user);
    if (!SAFE_ADAPTER_CODE.test(adapterCode)) {
      throw new NotFoundException({ code: 'INTEGRATION_ROUTE_NOT_ALLOWED', retryable: false });
    }
    try {
      const result = await this.repository.detail(user, adapterCode, {
        eventLimit: query.eventLimit,
        state: query.state,
        hasJitAuthority: hasJitAuthority(user, request),
      });
      response.setHeader('ETag', etag(result.aggregateVersion));
      response.setHeader('Cache-Control', 'private, no-store');
      return result;
    } catch (error) {
      return rethrowControlTowerError(error);
    }
  }

  @Post('inbox/:entryId/commands/redrive')
  @HttpCode(200)
  @RateLimit({
    name: 'integration_control_tower_redrive',
    scope: 'user',
    limit: 20,
    windowSeconds: 60,
    includeParams: ['entryId'],
  })
  async redrive(
    @Param('entryId') entryId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: ExecuteRegulatoryIntegrationCommandDto,
    @CurrentUser() user: RequestUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!SAFE_ID.test(entryId)) {
      throw new NotFoundException({ code: 'INTEGRATION_ROUTE_NOT_ALLOWED', retryable: false });
    }
    assertCommand(user, request, 'REDRIVE', dto.reason);
    try {
      const receipt = await this.commands.redrive(user, entryId, {
        commandId: dto.commandId,
        idempotencyKey: dto.idempotencyKey,
        correlationId: dto.correlationId,
        reason: dto.reason,
        expectedVersion: parseIntegrationIfMatch(ifMatch),
      });
      response.setHeader('Cache-Control', 'private, no-store');
      return receipt;
    } catch (error) {
      return rethrowControlTowerError(error);
    }
  }

  @Post(':adapterCode/commands/reconcile')
  @HttpCode(200)
  @RateLimit({
    name: 'integration_control_tower_reconcile',
    scope: 'user',
    limit: 20,
    windowSeconds: 60,
    includeParams: ['adapterCode'],
  })
  async reconcile(
    @Param('adapterCode') adapterCode: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: ExecuteRegulatoryIntegrationCommandDto,
    @CurrentUser() user: RequestUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!SAFE_ADAPTER_CODE.test(adapterCode)) {
      throw new NotFoundException({ code: 'INTEGRATION_ROUTE_NOT_ALLOWED', retryable: false });
    }
    assertCommand(user, request, 'RECONCILE', dto.reason);
    try {
      const receipt = await this.commands.reconcile(user, adapterCode, {
        commandId: dto.commandId,
        idempotencyKey: dto.idempotencyKey,
        correlationId: dto.correlationId,
        reason: dto.reason,
        expectedVersion: parseIntegrationIfMatch(ifMatch),
      });
      response.setHeader('ETag', etag(receipt.aggregateVersion));
      response.setHeader('Cache-Control', 'private, no-store');
      return receipt;
    } catch (error) {
      return rethrowControlTowerError(error);
    }
  }
}

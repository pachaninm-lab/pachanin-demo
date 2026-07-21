import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
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
  type StaffAccessContext,
} from '../staff-access/staff-access.types';
import {
  CommodityProfileAction,
  type CommodityProfileLifecycle,
} from './commodity-profile.policy';
import { CommodityProfileRepository } from './commodity-profile.repository';
import { CommodityProfileTransactionCommandService } from './commodity-profile-transaction-command.service';
import {
  CommodityProfileDetailQueryDto,
  CommodityProfileListQueryDto,
  ExecuteCommodityProfileCommandDto,
} from './dto/commodity-profile-api.dto';

const WRITE_ACTIONS = new Set<string>([
  CommodityProfileAction.CREATE_PROFILE,
  CommodityProfileAction.CREATE_DRAFT,
  CommodityProfileAction.UPDATE_DRAFT,
  CommodityProfileAction.SUBMIT_REVIEW,
  CommodityProfileAction.APPROVE,
  CommodityProfileAction.ACTIVATE,
  CommodityProfileAction.DEPRECATE,
  CommodityProfileAction.REVOKE,
]);

type CommodityProfileWriteAction = Exclude<CommodityProfileAction, 'READ'>;
type AuthenticatedRequest = { staffAccess?: StaffAccessContext };

function writeAction(value: string): CommodityProfileWriteAction {
  if (!WRITE_ACTIONS.has(value)) {
    throw new BadRequestException({
      code: 'COMMODITY_PROFILE_ACTION_INVALID',
      action: value,
      retryable: false,
    });
  }
  return value as CommodityProfileWriteAction;
}

export function parseCommodityProfileIfMatch(value: string | undefined): string {
  if (!value?.trim()) {
    throw new HttpException(
      {
        code: 'COMMODITY_PROFILE_IF_MATCH_REQUIRED',
        retryable: false,
      },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }
  const normalized = value.trim();
  const match = /^(?:W\/)?"(0|[1-9][0-9]{0,18})"$/.exec(normalized)
    ?? /^(0|[1-9][0-9]{0,18})$/.exec(normalized);
  if (!match) {
    throw new BadRequestException({
      code: 'COMMODITY_PROFILE_IF_MATCH_INVALID',
      retryable: false,
    });
  }
  return match[1]!;
}

function etag(version: string): string {
  return `"${version}"`;
}

function hasJitAuthority(request: AuthenticatedRequest): boolean {
  return request.staffAccess?.accessMode === StaffAccessMode.JIT_PRIVILEGED;
}

@UseGuards(RolesGuard)
@Roles('ANY_AUTHENTICATED')
@Controller('platform-v7/commodity-profiles')
export class CommodityProfilesController {
  constructor(
    private readonly repository: CommodityProfileRepository,
    private readonly commands: CommodityProfileTransactionCommandService,
  ) {}

  @Get()
  @RateLimit({
    name: 'commodity_profile_list',
    scope: 'user',
    limit: 120,
    windowSeconds: 60,
  })
  async list(
    @Query() query: CommodityProfileListQueryDto,
    @CurrentUser() user: RequestUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    return this.repository.list(user, {
      limit: query.limit,
      cursor: query.cursor,
      lifecycle: query.lifecycle as CommodityProfileLifecycle | undefined,
      archetype: query.archetype,
      sourceStatus: query.sourceStatus,
      search: query.search,
      effectiveAt: query.effectiveAt,
      hasJitAuthority: hasJitAuthority(request),
    });
  }

  @Get(':profileId')
  @RateLimit({
    name: 'commodity_profile_detail',
    scope: 'user',
    limit: 180,
    windowSeconds: 60,
    includeParams: ['profileId'],
  })
  async detail(
    @Param('profileId') profileId: string,
    @Query() query: CommodityProfileDetailQueryDto,
    @CurrentUser() user: RequestUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.repository.getById(user, profileId, {
      versionId: query.versionId,
      effectiveAt: query.effectiveAt,
      hasJitAuthority: hasJitAuthority(request),
    });
    response.setHeader('ETag', etag(result.version));
    response.setHeader('Cache-Control', 'private, no-store');
    return result;
  }

  @Post(':profileId/commands/:actionId')
  @HttpCode(200)
  @RateLimit({
    name: 'commodity_profile_command',
    scope: 'user',
    limit: 30,
    windowSeconds: 60,
    includeParams: ['profileId', 'actionId'],
  })
  async executeCommand(
    @Param('profileId') profileId: string,
    @Param('actionId') actionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: ExecuteCommodityProfileCommandDto,
    @CurrentUser() user: RequestUser,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const receipt = await this.commands.execute(
      user,
      {
        commandId: dto.commandId,
        idempotencyKey: dto.idempotencyKey,
        correlationId: dto.correlationId,
        profileId,
        profileVersionId: dto.profileVersionId,
        action: writeAction(actionId),
        expectedVersion: parseCommodityProfileIfMatch(ifMatch),
        reason: dto.reason,
        payload: dto.payload,
      },
      { hasJitAuthority: hasJitAuthority(request) },
    );
    response.setHeader('ETag', etag(receipt.version));
    response.setHeader('Cache-Control', 'private, no-store');
    return receipt;
  }
}

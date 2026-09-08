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
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import {
  OrganizationCapabilityCommandValidationError,
} from './organization-capability-command.contract';
import { OrganizationCapabilityRepository } from './organization-capability.repository';
import {
  isOrganizationCapabilityCode,
  type OrganizationCapabilityAction,
  type OrganizationCapabilityCode,
} from './organization-capability.registry';
import { ExecuteOrganizationCapabilityCommandDto } from './dto/organization-capability-api.dto';

function capabilityCode(value: string): OrganizationCapabilityCode {
  if (!isOrganizationCapabilityCode(value)) {
    throw new BadRequestException({
      code: 'ORGANIZATION_CAPABILITY_CODE_INVALID',
      retryable: false,
    });
  }
  return value;
}

function action(value: string): OrganizationCapabilityAction {
  if (value !== 'DECLARE' && value !== 'REVOKE') {
    throw new BadRequestException({
      code: 'ORGANIZATION_CAPABILITY_ACTION_INVALID',
      retryable: false,
    });
  }
  return value;
}

export function parseOrganizationCapabilityIfMatch(value: string | undefined): string {
  if (!value?.trim()) {
    throw new HttpException(
      { code: 'ORGANIZATION_CAPABILITY_IF_MATCH_REQUIRED', retryable: false },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }
  const normalized = value.trim();
  const match = /^(?:W\/)?"(0|[1-9][0-9]{0,18})"$/.exec(normalized)
    ?? /^(0|[1-9][0-9]{0,18})$/.exec(normalized);
  if (!match) {
    throw new BadRequestException({
      code: 'ORGANIZATION_CAPABILITY_IF_MATCH_INVALID',
      retryable: false,
    });
  }
  return match[1]!;
}

@UseGuards(RolesGuard)
@Roles('ANY_AUTHENTICATED')
@Controller('platform-v7/organization-capabilities')
export class OrganizationCapabilitiesController {
  constructor(private readonly repository: OrganizationCapabilityRepository) {}

  @Get()
  @RateLimit({
    name: 'organization_capability_list',
    scope: 'user',
    limit: 120,
    windowSeconds: 60,
  })
  async list(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    return this.repository.list(user);
  }

  @Post(':capabilityCode/commands/:actionId')
  @HttpCode(200)
  @RateLimit({
    name: 'organization_capability_command',
    scope: 'user',
    limit: 30,
    windowSeconds: 60,
    includeParams: ['capabilityCode', 'actionId'],
  })
  async execute(
    @Param('capabilityCode') rawCapabilityCode: string,
    @Param('actionId') rawAction: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: ExecuteOrganizationCapabilityCommandDto,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const receipt = await this.repository.execute(user, {
        commandId: dto.commandId,
        idempotencyKey: dto.idempotencyKey,
        correlationId: dto.correlationId,
        capabilityCode: capabilityCode(rawCapabilityCode),
        action: action(rawAction),
        expectedVersion: parseOrganizationCapabilityIfMatch(ifMatch),
        reason: dto.reason,
      });
      response.setHeader('ETag', `"${receipt.version}"`);
      response.setHeader('Cache-Control', 'private, no-store');
      return receipt;
    } catch (error) {
      if (error instanceof OrganizationCapabilityCommandValidationError) {
        throw new UnprocessableEntityException({
          code: error.message === 'IDEMPOTENCY_PAYLOAD_MISMATCH'
            ? 'IDEMPOTENCY_PAYLOAD_MISMATCH'
            : error.code,
          message: error.message,
          retryable: false,
        });
      }
      throw error;
    }
  }
}

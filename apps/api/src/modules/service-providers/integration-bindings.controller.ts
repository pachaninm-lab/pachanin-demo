import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { IntegrationBindingType } from '../../../../../packages/domain-core/src';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { IntegrationBindingCommandDto } from './dto/integration-binding-api.dto';
import {
  IntegrationBindingValidationError,
  isIntegrationBindingAction,
  type IntegrationBindingCommand,
} from './integration-binding.contract';
import { IntegrationBindingRepository } from './integration-binding.repository';

const SAFE_BINDING_KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$/;

function bindingKey(value: string): string {
  if (!SAFE_BINDING_KEY.test(value)) {
    throw new BadRequestException({ code: 'BINDING_KEY_INVALID' });
  }
  return value;
}

function expectedVersion(value: string | undefined): string {
  if (!value?.trim()) {
    throw new HttpException(
      { code: 'INTEGRATION_BINDING_IF_MATCH_REQUIRED', retryable: false },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }
  const normalized = value.trim();
  const match = /^(?:W\/)?"(0|[1-9][0-9]{0,18})"$/.exec(normalized)
    ?? /^(0|[1-9][0-9]{0,18})$/.exec(normalized);
  if (!match) {
    throw new BadRequestException({ code: 'INTEGRATION_BINDING_IF_MATCH_INVALID' });
  }
  return match[1]!;
}

@UseGuards(RolesGuard)
@Roles('LOGISTICIAN', 'LAB', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN')
@Controller('service-providers/integration-bindings')
export class IntegrationBindingsController {
  constructor(private readonly bindings: IntegrationBindingRepository) {}

  @Get('me')
  @RateLimit({ name: 'integration_bindings_me', scope: 'user', limit: 120, windowSeconds: 60 })
  listOwn(@CurrentUser() user: RequestUser) {
    return this.bindings.listOwn(user);
  }

  @Post(':bindingKey/:action')
  @RateLimit({ name: 'integration_binding_command', scope: 'user', limit: 30, windowSeconds: 60 })
  async command(
    @Param('bindingKey') rawBindingKey: string,
    @Param('action') rawAction: string,
    @Headers('if-match') ifMatch: string | undefined,
    @CurrentUser() user: RequestUser,
    @Body() dto: IntegrationBindingCommandDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!isIntegrationBindingAction(rawAction)) {
      throw new BadRequestException({ code: 'INTEGRATION_BINDING_ACTION_INVALID' });
    }
    const base = {
      bindingKey: bindingKey(rawBindingKey),
      commandId: dto.commandId,
      idempotencyKey: dto.idempotencyKey,
      correlationId: dto.correlationId,
      expectedVersion: expectedVersion(ifMatch),
      reason: dto.reason,
    } as const;
    const command: IntegrationBindingCommand = rawAction === 'WITHDRAW'
      ? { ...base, action: 'WITHDRAW' }
      : {
          ...base,
          action: 'UPSERT',
          providerCapabilityId: dto.providerCapabilityId ?? '',
          capabilityCode: dto.capabilityCode ?? '',
          transportType: dto.transportType as IntegrationBindingType,
          environment: dto.environment ?? '',
          endpointReference: dto.endpointReference ?? null,
          credentialReference: dto.credentialReference ?? null,
        };
    try {
      const receipt = await this.bindings.execute(user, command);
      response.setHeader('ETag', `"${receipt.version}"`);
      response.setHeader('Cache-Control', 'private, no-store');
      return receipt;
    } catch (error) {
      if (error instanceof IntegrationBindingValidationError) {
        throw new UnprocessableEntityException({
          code: error.code,
          message: error.message,
          retryable: false,
        });
      }
      throw error;
    }
  }
}

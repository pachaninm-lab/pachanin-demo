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
import { ServiceMarketplaceError, type ServiceMarketplaceAction } from '../../../../../packages/domain-core/src';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import {
  ServiceMarketplaceValidationError,
  type ServiceMarketplaceCommand,
} from './service-marketplace.contract';
import { ServiceMarketplaceCommandDto } from './dto/service-marketplace-api.dto';
import { ServiceMarketplaceRepository } from './service-marketplace.repository';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/u;

function requestId(value: string): string {
  if (!SAFE_ID.test(value)) throw new BadRequestException({ code: 'SERVICE_REQUEST_ID_INVALID' });
  return value;
}

function action(value: string): ServiceMarketplaceAction {
  const actions: Readonly<Record<string, ServiceMarketplaceAction>> = {
    'create-request': 'CREATE_REQUEST',
    'submit-quote': 'SUBMIT_QUOTE',
    'select-provider': 'SELECT_PROVIDER',
    'assign-payer': 'ASSIGN_PAYER',
    'confirm-payer': 'CONFIRM_PAYER',
    'start-execution': 'START_EXECUTION',
    'submit-evidence': 'SUBMIT_EVIDENCE',
    'accept-service': 'ACCEPT_SERVICE',
    'record-settlement': 'RECORD_SETTLEMENT',
  };
  const selected = actions[value];
  if (!selected) throw new BadRequestException({ code: 'SERVICE_ACTION_INVALID' });
  return selected;
}

function expectedVersion(value: string | undefined): string {
  if (!value?.trim()) {
    throw new HttpException({ code: 'SERVICE_MARKETPLACE_IF_MATCH_REQUIRED' }, HttpStatus.PRECONDITION_REQUIRED);
  }
  const match = /^(?:W\/)?"(0|[1-9][0-9]{0,18})"$/u.exec(value.trim())
    ?? /^(0|[1-9][0-9]{0,18})$/u.exec(value.trim());
  if (!match) throw new BadRequestException({ code: 'SERVICE_MARKETPLACE_IF_MATCH_INVALID' });
  return match[1]!;
}

@UseGuards(RolesGuard)
@Roles(
  'FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'SURVEYOR', 'LAB', 'ELEVATOR',
  'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'ARBITRATOR',
)
@Controller('service-marketplace')
export class ServiceMarketplaceController {
  constructor(private readonly marketplace: ServiceMarketplaceRepository) {}

  @Get('me')
  @RateLimit({ name: 'service_marketplace_me', scope: 'user', limit: 120, windowSeconds: 60 })
  listOwn(@CurrentUser() user: RequestUser) {
    return this.marketplace.listOwn(user);
  }

  @Post(':requestId/:action')
  @RateLimit({ name: 'service_marketplace_command', scope: 'user', limit: 60, windowSeconds: 60 })
  async command(
    @Param('requestId') rawRequestId: string,
    @Param('action') rawAction: string,
    @Headers('if-match') ifMatch: string | undefined,
    @CurrentUser() user: RequestUser,
    @Body() dto: ServiceMarketplaceCommandDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const command = {
      ...dto,
      requestId: requestId(rawRequestId),
      action: action(rawAction),
      expectedStateVersion: expectedVersion(ifMatch),
    } as unknown as ServiceMarketplaceCommand;
    const receipt = await this.handle(() => this.marketplace.execute(user, command));
    response.setHeader('ETag', `"${receipt.stateVersion}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    return receipt;
  }

  private async handle<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof ServiceMarketplaceValidationError || error instanceof ServiceMarketplaceError) {
        throw new UnprocessableEntityException({ code: error.code, message: error.message, retryable: false });
      }
      throw error;
    }
  }
}

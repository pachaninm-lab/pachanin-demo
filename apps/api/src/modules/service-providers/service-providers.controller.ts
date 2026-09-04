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
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  ProviderComplianceCategory,
  ProviderComplianceContext,
  ProviderSelectionContext,
  ServiceProviderCategory,
  ServiceProviderStage,
} from '../../../../../packages/domain-core/src';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import {
  ProviderCapabilityCommandDto,
  ServiceOfferingCommandDto,
} from './dto/provider-registry-api.dto';
import {
  isProviderCategory,
  PROVIDER_STAGES,
  ProviderRegistryValidationError,
  type ProviderRegistryCommand,
} from './provider-registry.contract';
import { ServiceProvidersService } from './service-providers.service';

const SAFE_PROVIDER_ID = /^provider-[0-9a-f]{32}$/;
const SAFE_OFFERING_KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$/;

function providerCategory(value: string | undefined): ServiceProviderCategory {
  if (!value || !isProviderCategory(value)) {
    throw new BadRequestException({ code: 'PROVIDER_CATEGORY_INVALID' });
  }
  return value;
}

function providerStage(value: string): ServiceProviderStage {
  if (!PROVIDER_STAGES.includes(value as ServiceProviderStage)) {
    throw new BadRequestException({ code: 'PROVIDER_STAGE_INVALID' });
  }
  return value as ServiceProviderStage;
}

function providerId(value: string | undefined): string {
  if (!value || !SAFE_PROVIDER_ID.test(value)) {
    throw new BadRequestException({ code: 'PROVIDER_ID_INVALID' });
  }
  return value;
}

function offeringKey(value: string): string {
  if (!SAFE_OFFERING_KEY.test(value)) {
    throw new BadRequestException({ code: 'OFFERING_KEY_INVALID' });
  }
  return value;
}

function capabilityAction(value: string): 'DECLARE' | 'REVOKE' {
  if (value !== 'DECLARE' && value !== 'REVOKE') {
    throw new BadRequestException({ code: 'PROVIDER_CAPABILITY_ACTION_INVALID' });
  }
  return value;
}

function offeringAction(value: string): 'UPSERT' | 'WITHDRAW' {
  if (value !== 'UPSERT' && value !== 'WITHDRAW') {
    throw new BadRequestException({ code: 'SERVICE_OFFERING_ACTION_INVALID' });
  }
  return value;
}

export function parseProviderRegistryIfMatch(value: string | undefined): string {
  if (!value?.trim()) {
    throw new HttpException(
      { code: 'PROVIDER_REGISTRY_IF_MATCH_REQUIRED', retryable: false },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }
  const normalized = value.trim();
  const match = /^(?:W\/)?"(0|[1-9][0-9]{0,18})"$/.exec(normalized)
    ?? /^(0|[1-9][0-9]{0,18})$/.exec(normalized);
  if (!match) throw new BadRequestException({ code: 'PROVIDER_REGISTRY_IF_MATCH_INVALID' });
  return match[1]!;
}

function selectionContext(input: {
  region?: string;
  culture?: string;
  pilotMode?: string;
  exportFlow?: string;
  disputeSensitive?: string;
  requiresEpd?: string;
  requiresGpsEvidence?: string;
  needPortLink?: string;
  needRailLink?: string;
  docsReady?: string;
  targetHours?: string;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
  amountRub?: string;
}): ProviderSelectionContext {
  return {
    region: input.region,
    culture: input.culture,
    pilotMode: input.pilotMode === 'true',
    exportFlow: input.exportFlow === 'true',
    disputeSensitive: input.disputeSensitive === 'true',
    requiresEpd: input.requiresEpd === 'true',
    requiresGpsEvidence: input.requiresGpsEvidence === 'true',
    needPortLink: input.needPortLink === 'true',
    needRailLink: input.needRailLink === 'true',
    docsReady: input.docsReady === 'true',
    targetHours: input.targetHours ? Number(input.targetHours) : undefined,
    urgency: input.urgency,
    amountRub: input.amountRub ? Number(input.amountRub) : undefined,
  };
}

@UseGuards(RolesGuard)
@Roles('LOGISTICIAN', 'LAB', 'ELEVATOR', 'ACCOUNTING', 'EXECUTIVE', 'SUPPORT_MANAGER', 'ADMIN')
@Controller('service-providers')
export class ServiceProvidersController {
  constructor(private readonly serviceProviders: ServiceProvidersService) {}

  @Get('summary')
  summary(@CurrentUser() user: RequestUser) {
    return this.serviceProviders.summary(user);
  }

  @Get('catalog')
  catalog(@CurrentUser() user: RequestUser, @Query('category') category?: string) {
    return this.serviceProviders.catalog(
      user,
      category === undefined ? undefined : providerCategory(category),
    );
  }

  @Get('me')
  @RateLimit({ name: 'provider_registry_me', scope: 'user', limit: 120, windowSeconds: 60 })
  me(@CurrentUser() user: RequestUser) {
    return this.serviceProviders.ownRegistry(user);
  }

  @Get('plan')
  plan(
    @CurrentUser() user: RequestUser,
    @Query('stage') rawStage: string,
    @Query('region') region?: string,
    @Query('culture') culture?: string,
    @Query('pilotMode') pilotMode?: string,
    @Query('exportFlow') exportFlow?: string,
    @Query('disputeSensitive') disputeSensitive?: string,
    @Query('requiresEpd') requiresEpd?: string,
    @Query('requiresGpsEvidence') requiresGpsEvidence?: string,
    @Query('needPortLink') needPortLink?: string,
    @Query('needRailLink') needRailLink?: string,
    @Query('docsReady') docsReady?: string,
    @Query('targetHours') targetHours?: string,
    @Query('urgency') urgency?: 'LOW' | 'MEDIUM' | 'HIGH',
    @Query('amountRub') amountRub?: string,
  ) {
    return this.serviceProviders.plan(user, providerStage(rawStage), selectionContext({
      region, culture, pilotMode, exportFlow, disputeSensitive, requiresEpd,
      requiresGpsEvidence, needPortLink, needRailLink, docsReady, targetHours,
      urgency, amountRub,
    }));
  }

  @Get('compliance')
  compliance(
    @CurrentUser() user: RequestUser,
    @Query('providerId') rawProviderId: string | undefined,
    @Query('category') rawCategory: string,
    @Query('disputeSensitive') disputeSensitive?: string,
    @Query('moneySensitive') moneySensitive?: string,
    @Query('exportFlow') exportFlow?: string,
    @Query('requiresEpd') requiresEpd?: string,
    @Query('requiresQualifiedSignature') requiresQualifiedSignature?: string,
    @Query('requiresGpsEvidence') requiresGpsEvidence?: string,
    @Query('requiresBankWhitelist') requiresBankWhitelist?: string,
  ) {
    const category = providerCategory(rawCategory) as ProviderComplianceCategory;
    const context: ProviderComplianceContext = {
      category,
      disputeSensitive: disputeSensitive === 'true',
      moneySensitive: moneySensitive === 'true',
      exportFlow: exportFlow === 'true',
      requiresEpd: requiresEpd === 'true',
      requiresQualifiedSignature: requiresQualifiedSignature === 'true',
      requiresGpsEvidence: requiresGpsEvidence === 'true',
      requiresBankWhitelist: requiresBankWhitelist === 'true',
    };
    return this.serviceProviders.compliance(user, providerId(rawProviderId), context);
  }

  @Get('recommendation')
  recommendation(
    @CurrentUser() user: RequestUser,
    @Query('category') rawCategory: string,
    @Query('region') region?: string,
    @Query('culture') culture?: string,
    @Query('pilotMode') pilotMode?: string,
    @Query('exportFlow') exportFlow?: string,
    @Query('disputeSensitive') disputeSensitive?: string,
    @Query('requiresEpd') requiresEpd?: string,
    @Query('requiresGpsEvidence') requiresGpsEvidence?: string,
    @Query('needPortLink') needPortLink?: string,
    @Query('needRailLink') needRailLink?: string,
    @Query('docsReady') docsReady?: string,
    @Query('targetHours') targetHours?: string,
    @Query('urgency') urgency?: 'LOW' | 'MEDIUM' | 'HIGH',
    @Query('amountRub') amountRub?: string,
  ) {
    return this.serviceProviders.recommendation(
      user,
      providerCategory(rawCategory),
      selectionContext({
        region, culture, pilotMode, exportFlow, disputeSensitive, requiresEpd,
        requiresGpsEvidence, needPortLink, needRailLink, docsReady, targetHours,
        urgency, amountRub,
      }),
    );
  }

  @Post('capabilities/:category/commands/:actionId')
  @HttpCode(200)
  @RateLimit({
    name: 'provider_capability_command',
    scope: 'user',
    limit: 30,
    windowSeconds: 60,
    includeParams: ['category', 'actionId'],
  })
  async capabilityCommand(
    @CurrentUser() user: RequestUser,
    @Param('category') rawCategory: string,
    @Param('actionId') rawAction: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: ProviderCapabilityCommandDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const command: ProviderRegistryCommand = {
      entityType: 'PROVIDER_CAPABILITY',
      action: capabilityAction(rawAction),
      category: providerCategory(rawCategory),
      legalRole: dto.legalRole,
      commandId: dto.commandId,
      idempotencyKey: dto.idempotencyKey,
      correlationId: dto.correlationId,
      expectedVersion: parseProviderRegistryIfMatch(ifMatch),
      reason: dto.reason,
    };
    return this.execute(user, command, response);
  }

  @Post('offerings/:category/:offeringKey/commands/:actionId')
  @HttpCode(200)
  @RateLimit({
    name: 'service_offering_command',
    scope: 'user',
    limit: 30,
    windowSeconds: 60,
    includeParams: ['category', 'offeringKey', 'actionId'],
  })
  async offeringCommand(
    @CurrentUser() user: RequestUser,
    @Param('category') rawCategory: string,
    @Param('offeringKey') rawOfferingKey: string,
    @Param('actionId') rawAction: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: ServiceOfferingCommandDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const command: ProviderRegistryCommand = {
      entityType: 'SERVICE_OFFERING',
      action: offeringAction(rawAction),
      offeringKey: offeringKey(rawOfferingKey),
      category: providerCategory(rawCategory),
      title: dto.title ?? null,
      description: dto.description ?? null,
      regions: dto.regions ?? [],
      cultures: dto.cultures ?? [],
      stages: dto.stages ?? [],
      commandId: dto.commandId,
      idempotencyKey: dto.idempotencyKey,
      correlationId: dto.correlationId,
      expectedVersion: parseProviderRegistryIfMatch(ifMatch),
      reason: dto.reason,
    };
    return this.execute(user, command, response);
  }

  private async execute(
    user: RequestUser,
    command: ProviderRegistryCommand,
    response: Response,
  ) {
    try {
      const receipt = await this.serviceProviders.execute(user, command);
      response.setHeader('ETag', `"${receipt.version}"`);
      response.setHeader('Cache-Control', 'private, no-store');
      return receipt;
    } catch (error) {
      if (error instanceof ProviderRegistryValidationError) {
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

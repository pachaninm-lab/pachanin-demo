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
import {
  CommercialRuleError,
  type CommercialEvaluationFacts,
} from '../../../../../packages/domain-core/src';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import {
  CommercialRulesValidationError,
  type CommercialRuleCommand,
  type CommercialRulePackEntry,
  type CommercialRulePolicy,
} from './commercial-rules.contract';
import { CommercialRulesRepository } from './commercial-rules.repository';
import { CommercialDecisionDto, CommercialRuleCommandDto } from './dto/commercial-rules-api.dto';

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$/u;

function key(value: string): string {
  if (!SAFE_KEY.test(value)) throw new BadRequestException({ code: 'AGGREGATE_KEY_INVALID' });
  return value;
}

function aggregateType(value: string): 'RULE_SET' | 'RULE_PACK' {
  if (value === 'rule-set') return 'RULE_SET';
  if (value === 'rule-pack') return 'RULE_PACK';
  throw new BadRequestException({ code: 'COMMERCIAL_AGGREGATE_TYPE_INVALID' });
}

function action(value: string): CommercialRuleCommand['action'] {
  if (value === 'create-version') return 'CREATE_VERSION';
  if (value === 'publish') return 'PUBLISH';
  if (value === 'retire') return 'RETIRE';
  throw new BadRequestException({ code: 'COMMERCIAL_RULE_ACTION_INVALID' });
}

function expectedVersion(value: string | undefined): string {
  if (!value?.trim()) {
    throw new HttpException({ code: 'COMMERCIAL_RULE_IF_MATCH_REQUIRED' }, HttpStatus.PRECONDITION_REQUIRED);
  }
  const match = /^(?:W\/)?"(0|[1-9][0-9]{0,18})"$/u.exec(value.trim())
    ?? /^(0|[1-9][0-9]{0,18})$/u.exec(value.trim());
  if (!match) throw new BadRequestException({ code: 'COMMERCIAL_RULE_IF_MATCH_INVALID' });
  return match[1]!;
}

@UseGuards(RolesGuard)
@Roles(
  'FARMER',
  'BUYER',
  'LOGISTICIAN',
  'DRIVER',
  'SURVEYOR',
  'LAB',
  'ELEVATOR',
  'ACCOUNTING',
  'EXECUTIVE',
  'SUPPORT_MANAGER',
  'ADMIN',
  'GUEST',
  'COMPLIANCE_OFFICER',
  'ARBITRATOR',
)
@Controller('commercial-rules')
export class CommercialRulesController {
  constructor(private readonly rules: CommercialRulesRepository) {}

  @Get('me')
  @RateLimit({ name: 'commercial_rules_me', scope: 'user', limit: 120, windowSeconds: 60 })
  listOwn(@CurrentUser() user: RequestUser) {
    return this.rules.listOwn(user);
  }

  @Post('evaluate')
  @RateLimit({ name: 'commercial_rule_evaluate', scope: 'user', limit: 120, windowSeconds: 60 })
  evaluate(@CurrentUser() user: RequestUser, @Body() dto: CommercialDecisionDto) {
    return this.handle(() => this.rules.evaluate(user, {
      decisionKey: dto.decisionKey,
      correlationId: dto.correlationId,
      ruleSetId: dto.ruleSetId,
      ruleKey: dto.ruleKey,
      rulePackId: dto.rulePackId ?? null,
      context: dto.context,
      facts: dto.facts as CommercialEvaluationFacts,
    }));
  }

  @Post(':aggregateType/:aggregateKey/:action')
  @RateLimit({ name: 'commercial_rule_command', scope: 'user', limit: 30, windowSeconds: 60 })
  async command(
    @Param('aggregateType') rawType: string,
    @Param('aggregateKey') rawKey: string,
    @Param('action') rawAction: string,
    @Headers('if-match') ifMatch: string | undefined,
    @CurrentUser() user: RequestUser,
    @Body() dto: CommercialRuleCommandDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const type = aggregateType(rawType);
    const selectedAction = action(rawAction);
    const base = {
      aggregateType: type,
      aggregateKey: key(rawKey),
      commandId: dto.commandId,
      idempotencyKey: dto.idempotencyKey,
      correlationId: dto.correlationId,
      expectedStateVersion: expectedVersion(ifMatch),
      reason: dto.reason,
    } as const;
    const command: CommercialRuleCommand = selectedAction !== 'CREATE_VERSION'
      ? { ...base, action: selectedAction, aggregateId: dto.aggregateId ?? '' }
      : type === 'RULE_SET'
        ? {
          ...base,
          action: 'CREATE_VERSION',
          name: dto.name ?? '',
          currency: dto.currency,
          effectiveFrom: dto.effectiveFrom ?? null,
          effectiveTo: dto.effectiveTo ?? null,
          rules: dto.rules as CommercialRulePolicy[] | undefined,
        }
        : {
          ...base,
          action: 'CREATE_VERSION',
          name: dto.name ?? '',
          effectiveFrom: dto.effectiveFrom ?? null,
          effectiveTo: dto.effectiveTo ?? null,
          entries: dto.entries as CommercialRulePackEntry[] | undefined,
        };
    const receipt = await this.handle(() => this.rules.execute(user, command));
    response.setHeader('ETag', `"${receipt.stateVersion}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    return receipt;
  }

  private async handle<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof CommercialRulesValidationError) {
        throw new UnprocessableEntityException({ code: error.code, message: error.message, retryable: false });
      }
      if (error instanceof CommercialRuleError) {
        throw new UnprocessableEntityException({ code: 'COMMERCIAL_EVALUATION_INVALID', message: error.message, retryable: false });
      }
      throw error;
    }
  }
}

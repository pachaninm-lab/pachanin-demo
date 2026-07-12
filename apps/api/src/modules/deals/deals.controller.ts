import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Body, Controller, Get, GoneException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DealsService } from './deals.service';
import { IndustrialDealCommandGateway } from './industrial-deal-command.gateway';
import { CreateDealDto } from './dto/create-deal.dto';
import { ExecuteDealCommandDto } from './dto/execute-deal-command.dto';
import { RequestUser, Role } from '../../common/types/request-user';

@UseGuards(RolesGuard)
@Roles('ANY_AUTHENTICATED')
@Controller('deals')
export class DealsController {
  constructor(
    private readonly deals: DealsService,
    private readonly industrialCommands: IndustrialDealCommandGateway,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.deals.list(user);
  }

  @Get('accessible')
  listAccessible(@Query('limit') limit: string | undefined, @CurrentUser() user: RequestUser) {
    const parsed = Number(limit);
    return this.industrialCommands.listAccessibleDeals(user, Number.isFinite(parsed) ? parsed : undefined);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.deals.getOne(id, user);
  }

  @Get(':id/workspace')
  workspace(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.deals.workspace(id, user);
  }

  @Get(':id/execution-workspace')
  executionWorkspace(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.industrialCommands.workspace(id, user);
  }

  @Get(':id/correlation-timeline')
  correlationTimeline(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    const parsed = Number(limit);
    return this.industrialCommands.correlationTimeline(id, user, {
      perSourceLimit: Number.isFinite(parsed) ? parsed : undefined,
    });
  }

  @Get(':id/passport')
  passport(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.deals.passport(id, user);
  }

  @Get(':id/timeline')
  timeline(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.deals.timeline(id, user);
  }

  @Post()
  @Roles(Role.FARMER)
  @RateLimit({
    name: 'deal_create',
    scope: 'user',
    limit: 10,
    windowSeconds: 60,
    limitEnv: 'RATE_LIMIT_DEAL_CREATE',
    windowEnv: 'RATE_LIMIT_DEAL_CREATE_WINDOW_SECONDS',
  })
  create(@Body() dto: CreateDealDto, @CurrentUser() user: RequestUser) {
    return this.deals.create(dto, user);
  }

  @Post(':id/commands/:actionId')
  @RateLimit({
    name: 'deal_command',
    scope: 'user',
    limit: 20,
    windowSeconds: 60,
    limitEnv: 'RATE_LIMIT_DEAL_COMMAND',
    windowEnv: 'RATE_LIMIT_DEAL_COMMAND_WINDOW_SECONDS',
    includeParams: ['id', 'actionId'],
  })
  executeCommand(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @Body() dto: ExecuteDealCommandDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.industrialCommands.executeUser(id, actionId, dto, user);
  }

  /**
   * Compatibility endpoints remain explicit fail-closed tombstones so an old
   * client cannot silently fall back to RuntimeCore or a free-form state write.
   */
  @Patch(':id/transition')
  legacyTransitionDisabled(@Param('id') id: string): never {
    return this.rejectLegacyTransition(id);
  }

  @Patch(':id/status')
  legacyStatusDisabled(@Param('id') id: string): never {
    return this.rejectLegacyTransition(id);
  }

  private rejectLegacyTransition(id: string): never {
    throw new GoneException({
      code: 'LEGACY_DEAL_TRANSITION_DISABLED',
      dealId: id,
      message: 'Свободное изменение статуса отключено. Используйте доменную команду сделки.',
      commandEndpoint: `/deals/${id}/commands/:actionId`,
    });
  }
}

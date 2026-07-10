import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DealsService } from './deals.service';
import { IndustrialDealCommandGateway } from './industrial-deal-command.gateway';
import { CreateDealDto } from './dto/create-deal.dto';
import { ExecuteDealCommandDto } from './dto/execute-deal-command.dto';
import { TransitionDealDto } from './dto/transition-deal.dto';
import { RequestUser, Role } from '../../common/types/request-user';
import { CANONICAL_TEST_DEAL_ID } from './deal-command.policy';

@UseGuards(RolesGuard)
@Roles('FARMER', 'BUYER', 'SUPPORT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ACCOUNTING')
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

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.deals.getOne(id, user);
  }

  @Get(':id/workspace')
  workspace(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.deals.workspace(id, user);
  }

  @Get(':id/execution-workspace')
  @Roles('ANY_AUTHENTICATED')
  executionWorkspace(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.industrialCommands.workspace(id, user);
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
  create(@Body() dto: CreateDealDto, @CurrentUser() user: RequestUser) {
    if (user.role === Role.EXECUTIVE) {
      throw new ForbiddenException('Executive role cannot create deals');
    }
    return this.deals.create(dto, user);
  }

  @Post(':id/commands/:actionId')
  @Roles('ANY_AUTHENTICATED')
  executeCommand(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @Body() dto: ExecuteDealCommandDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.industrialCommands.executeUser(id, actionId, dto, user);
  }

  @Patch(':id/transition')
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionDealDto,
    @CurrentUser() user: RequestUser,
  ) {
    this.assertLegacyTransitionAllowed(id, user);
    return this.deals.transition(id, dto, user);
  }

  @Patch(':id/status')
  transitionCompat(
    @Param('id') id: string,
    @Body() body: { status?: string; nextState?: string; comment?: string },
    @CurrentUser() user: RequestUser,
  ) {
    this.assertLegacyTransitionAllowed(id, user);
    return this.deals.transition(
      id,
      { nextState: (body?.nextState || body?.status || '') as any, comment: body?.comment },
      user,
    );
  }

  private assertLegacyTransitionAllowed(id: string, user: RequestUser): void {
    if (user.role === Role.EXECUTIVE) {
      throw new ForbiddenException('Executive role is read-only');
    }
    if (id === CANONICAL_TEST_DEAL_ID) {
      throw new BadRequestException({
        code: 'CANONICAL_DEAL_REQUIRES_COMMAND',
        message: 'Canonical deal cannot accept an arbitrary nextState. Use POST /deals/:id/commands/:actionId.',
      });
    }
  }
}

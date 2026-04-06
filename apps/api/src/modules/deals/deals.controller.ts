import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { TransitionDealDto } from './dto/transition-deal.dto';

@UseGuards(RolesGuard)
@Roles('FARMER', 'BUYER', 'SUPPORT_MANAGER')
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.deals.list(user);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.deals.getOne(id, user);
  }

  @Get(':id/workspace')
  workspace(@Param('id') id: string, @CurrentUser() user: any) {
    return this.deals.workspace(id, user);
  }

  @Get(':id/passport')
  passport(@Param('id') id: string, @CurrentUser() user: any) {
    return this.deals.passport(id, user);
  }

  @Get(':id/timeline')
  timeline(@Param('id') id: string, @CurrentUser() user: any) {
    return this.deals.timeline(id, user);
  }

  @Post()
  create(@Body() dto: CreateDealDto, @CurrentUser() user: any) {
    return this.deals.create(dto, user);
  }

  @Patch(':id/transition')
  transition(@Param('id') id: string, @Body() dto: TransitionDealDto, @CurrentUser() user: any) {
    return this.deals.transition(id, dto, user);
  }

  @Patch(':id/status')
  transitionCompat(@Param('id') id: string, @Body() body: { status?: string; nextState?: string; comment?: string }, @CurrentUser() user: any) {
    return this.deals.transition(id, { nextState: (body?.nextState || body?.status || '') as any, comment: body?.comment }, user);
  }
}

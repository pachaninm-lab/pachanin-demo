import { UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DecideDisputeDto } from './dto/decide-dispute.dto';

@UseGuards(RolesGuard)
@Roles('SUPPORT_MANAGER', 'BUYER', 'FARMER', 'LAB', 'ACCOUNTING')
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.disputes.list(user);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.disputes.getOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateDisputeDto, @CurrentUser() user: any) {
    return this.disputes.create(dto, user);
  }

  @Patch(':id/triage')
  triage(@Param('id') id: string, @CurrentUser() user: any) {
    return this.disputes.triage(id, user);
  }

  @Patch(':id/decision')
  decision(@Param('id') id: string, @Body() dto: DecideDisputeDto, @CurrentUser() user: any) {
    return this.disputes.decision(id, dto, user);
  }
}

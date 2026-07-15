import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { AddDisputeEvidenceDto } from './dto/add-dispute-evidence.dto';
import { AppealDisputeDto } from './dto/appeal-dispute.dto';
import { BindDisputeOperationsDto } from './dto/bind-dispute-operations.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DecideDisputeDto } from './dto/decide-dispute.dto';
import { DisputeVersionCommandDto } from './dto/dispute-version-command.dto';
import { ResolveDisputeAppealDto } from './dto/resolve-dispute-appeal.dto';
import { DisputesService } from './disputes.service';

@UseGuards(RolesGuard)
@Roles(
  'BUYER',
  'FARMER',
  'LAB',
  'SURVEYOR',
  'ELEVATOR',
  'LOGISTICIAN',
  'DRIVER',
  'ACCOUNTING',
  'COMPLIANCE_OFFICER',
  'ARBITRATOR',
  'SUPPORT_MANAGER',
  'EXECUTIVE',
  'ADMIN',
)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.disputes.list(user);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.disputes.getOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateDisputeDto, @CurrentUser() user: RequestUser) {
    return this.disputes.create(dto, user);
  }

  @Patch(':id/triage')
  triage(
    @Param('id') id: string,
    @Body() dto: DisputeVersionCommandDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.triage(id, dto, user);
  }

  @Post(':id/evidence')
  addEvidence(
    @Param('id') id: string,
    @Body() dto: AddDisputeEvidenceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.addEvidence(id, dto, user);
  }

  @Patch(':id/decision')
  decision(
    @Param('id') id: string,
    @Body() dto: DecideDisputeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.decision(id, dto, user);
  }

  @Post(':id/appeal')
  appeal(
    @Param('id') id: string,
    @Body() dto: AppealDisputeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.appeal(id, dto, user);
  }

  @Patch(':id/appeal/decision')
  resolveAppeal(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeAppealDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.resolveAppeal(id, dto, user);
  }

  @Patch(':id/finalize')
  finalize(
    @Param('id') id: string,
    @Body() dto: DisputeVersionCommandDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.finalize(id, dto, user);
  }

  @Patch(':id/settlement-operations')
  bindOperations(
    @Param('id') id: string,
    @Body() dto: BindDisputeOperationsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.bindOperations(id, dto, user);
  }

  @Patch(':id/close')
  close(
    @Param('id') id: string,
    @Body() dto: DisputeVersionCommandDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.close(id, dto, user);
  }
}

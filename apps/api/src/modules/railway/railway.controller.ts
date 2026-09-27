import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { RailwayService } from './railway.service';
import {
  CalculateDemurrageDto,
  CreateGU12Dto,
  RegisterWagonDto,
  UpdateWagonStatusDto,
} from './dto/railway.dto';

@UseGuards(RolesGuard)
@Roles('LOGISTICIAN', 'ADMIN', 'SUPPORT_MANAGER', 'EXECUTIVE', 'ACCOUNTING')
@Controller('railway')
export class RailwayController {
  constructor(private readonly railway: RailwayService) {}

  @Get('wagons')
  listWagons(@CurrentUser() user: RequestUser, @Query('orgId') orgId?: string) {
    return this.railway.listWagons(user, orgId);
  }

  @Post('wagons')
  registerWagon(
    @Body() body: RegisterWagonDto,
    @CurrentUser() user: RequestUser,
  ) {
    // Поля перечислены поимённо, а не рассыпаны из тела: россыпь позволяла
    // присланному клиентом `id` дойти до сервиса и победить сгенерированный.
    return this.railway.registerWagon({
      wagonNumber: body.wagonNumber,
      type: body.type,
      capacityTons: body.capacityTons,
      ownerOrgId: user.orgId,
    });
  }

  @Put('wagons/:id/status')
  @Roles('LOGISTICIAN', 'ADMIN')
  updateWagonStatus(
    @Param('id') id: string,
    @Body() body: UpdateWagonStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.railway.updateWagonStatus(user, id, body.status, body.dealId);
  }

  @Get('gu12')
  listGU12(@CurrentUser() user: RequestUser, @Query('dealId') dealId?: string) {
    return this.railway.listGU12(user, dealId);
  }

  @Post('gu12')
  createGU12(
    @Body() body: CreateGU12Dto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.railway.createGU12(user, {
      dealId: body.dealId,
      wagonIds: body.wagonIds,
      departureStation: body.departureStation,
      destinationStation: body.destinationStation,
      cargo: body.cargo,
      volumeTons: body.volumeTons,
      requestedDepartureAt: body.requestedDepartureAt,
      requestorOrgId: user.orgId,
    });
  }

  @Post('gu12/:id/submit')
  submitGU12(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.railway.submitGU12(user, id);
  }

  @Post('demurrage/calculate')
  calculateDemurrage(
    @Body() body: CalculateDemurrageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.railway.calculateDemurrage(user, body);
  }

  @Get('demurrage')
  listDemurrage(@CurrentUser() user: RequestUser, @Query('dealId') dealId?: string) {
    return this.railway.listDemurrage(user, dealId);
  }
}

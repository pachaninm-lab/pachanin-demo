import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
  listWagons(@CurrentUser() user: any, @Query('orgId') orgId?: string) {
    return this.railway.listWagons(orgId ?? user.orgId);
  }

  @Post('wagons')
  registerWagon(
    @Body() body: RegisterWagonDto,
    @CurrentUser() user: any,
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
  ) {
    return this.railway.updateWagonStatus(id, body.status, body.dealId);
  }

  @Get('gu12')
  listGU12(@Query('dealId') dealId?: string) {
    return this.railway.listGU12(dealId);
  }

  @Post('gu12')
  createGU12(
    @Body() body: CreateGU12Dto,
    @CurrentUser() user: any,
  ) {
    return this.railway.createGU12({
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
  submitGU12(@Param('id') id: string) {
    return this.railway.submitGU12(id);
  }

  @Post('demurrage/calculate')
  calculateDemurrage(
    @Body() body: CalculateDemurrageDto,
  ) {
    return this.railway.calculateDemurrage(body);
  }

  @Get('demurrage')
  listDemurrage(@Query('dealId') dealId?: string) {
    return this.railway.listDemurrage(dealId);
  }
}

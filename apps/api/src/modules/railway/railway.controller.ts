import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RailwayService, WagonStatus, WagonType } from './railway.service';

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
    @Body() body: { wagonNumber: string; type: WagonType; capacityTons: number },
    @CurrentUser() user: any,
  ) {
    return this.railway.registerWagon({ ...body, ownerOrgId: user.orgId });
  }

  @Put('wagons/:id/status')
  @Roles('LOGISTICIAN', 'ADMIN')
  updateWagonStatus(
    @Param('id') id: string,
    @Body() body: { status: WagonStatus; dealId?: string },
  ) {
    return this.railway.updateWagonStatus(id, body.status, body.dealId);
  }

  @Get('gu12')
  listGU12(@Query('dealId') dealId?: string) {
    return this.railway.listGU12(dealId);
  }

  @Post('gu12')
  createGU12(
    @Body() body: {
      dealId: string;
      wagonIds: string[];
      departureStation: string;
      destinationStation: string;
      cargo: string;
      volumeTons: number;
      requestedDepartureAt: string;
    },
    @CurrentUser() user: any,
  ) {
    return this.railway.createGU12({ ...body, requestorOrgId: user.orgId });
  }

  @Post('gu12/:id/submit')
  submitGU12(@Param('id') id: string) {
    return this.railway.submitGU12(id);
  }

  @Post('demurrage/calculate')
  calculateDemurrage(
    @Body() body: {
      wagonId: string;
      dealId?: string;
      arrivedAt: string;
      unloadingCompletedAt: string;
    },
  ) {
    return this.railway.calculateDemurrage(body);
  }

  @Get('demurrage')
  listDemurrage(@Query('dealId') dealId?: string) {
    return this.railway.listDemurrage(dealId);
  }
}

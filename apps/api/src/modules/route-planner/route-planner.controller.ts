import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoutePlannerService } from './route-planner.service';

@UseGuards(RolesGuard)
@Roles('LOGISTICIAN', 'DRIVER', 'SUPPORT_MANAGER', 'ADMIN')
@Controller('route-planner')
export class RoutePlannerController {
  constructor(private readonly routePlanner: RoutePlannerService) {}

  @Get('weighbridge')
  weighbridge() {
    return this.routePlanner.weighbridge();
  }

  @Get('shipment/:shipmentId')
  shipment(@Param('shipmentId') shipmentId: string) {
    return this.routePlanner.shipment(shipmentId);
  }
}

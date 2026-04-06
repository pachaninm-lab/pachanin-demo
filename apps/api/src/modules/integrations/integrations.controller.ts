import { UseGuards } from '@nestjs/common';
import { Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IntegrationsService } from './integrations.service';

@UseGuards(RolesGuard)
@Roles('SUPPORT_MANAGER', 'ACCOUNTING', 'LOGISTICIAN', 'ADMIN')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('jobs')
  jobs(@CurrentUser() user: any) {
    return this.integrations.jobs(user);
  }

  @Get('health')
  health() {
    return this.integrations.health();
  }

  @Get('hardening')
  hardening() {
    return this.integrations.hardening();
  }

  @Post('edo/deals/:dealId/export-contract')
  exportContract(@Param('dealId') dealId: string, @CurrentUser() user: any) {
    return this.integrations.exportContract(dealId, user);
  }

  @Post('fgis-zerno/deals/:dealId/push')
  pushFgis(@Param('dealId') dealId: string, @CurrentUser() user: any) {
    return this.integrations.pushFgis(dealId, user);
  }

  @Post('bank/deals/:dealId/reserve-prepayment')
  reservePrepayment(@Param('dealId') dealId: string, @CurrentUser() user: any) {
    return this.integrations.reservePrepayment(dealId, user);
  }

  @Post('gps/shipments/:shipmentId/heartbeat')
  gpsHeartbeat(@Param('shipmentId') shipmentId: string, @CurrentUser() user: any) {
    return this.integrations.gpsHeartbeat(shipmentId, user);
  }
}

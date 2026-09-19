import { UseGuards, Body, HttpCode } from '@nestjs/common';
import { Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IntegrationsService } from './integrations.service';
import type { RequestUser } from '../../common/types/request-user';

// `FGIS_WEBHOOK_SECRET` is no longer required to boot: the JSON webhook it
// authenticated was retired in P0.2-1A, and a shared HMAC secret was never the
// provider's signature. The canonical contour verifies signed SOAP instead.

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
  pushFgis(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
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

  /**
   * Retired in P0.2-1A.
   *
   * This accepted an HMAC-signed JSON body as a ФГИС «Зерно» provider response.
   * The official contract defines no such callback — a response is a signed
   * SOAP `SendResponse` handled by the canonical regulatory inbox. A shared
   * HMAC secret is not the provider's signature, so the route could authenticate
   * only whoever held the secret, never ФГИС itself.
   *
   * The body is not read and no signature is computed: the route is gone, so
   * there is nothing to authenticate against.
   */
  @Public()
  @Post('fgis/webhook')
  fgisWebhook(): Promise<never> {
    return this.integrations.handleFgisWebhook({});
  }

  /**
   * EDO inbound webhook — called by EDO provider when document signing completes.
   * No HMAC validation in demo (EDO uses mTLS in production).
   */
  @Public()
  @Post('edo/webhook')
  @HttpCode(200)
  edoWebhook(@Body() body: Record<string, unknown>) {
    return this.integrations.handleEdoWebhook(body);
  }
}

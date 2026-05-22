import { UseGuards, Body, HttpCode, UnauthorizedException, Headers } from '@nestjs/common';
import { Controller, Get, Param, Post } from '@nestjs/common';
import * as crypto from 'crypto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IntegrationsService } from './integrations.service';

const FGIS_WEBHOOK_SECRET = process.env.FGIS_WEBHOOK_SECRET ?? 'pachanin-demo-fgis-secret-dev';

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

  /**
   * ФГИС «Зерно» inbound webhook — called by FGIS when СДИЗ status changes.
   * Authenticated via HMAC-SHA256 on the raw body (X-Fgis-Signature header).
   * Body: { sdizId, dealId, status: 'CONFIRMED'|'REJECTED'|'CANCELLED', confirmedAt? }
   */
  @Public()
  @Post('fgis/webhook')
  @HttpCode(200)
  fgisWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-fgis-signature') sig: string | undefined,
  ) {
    const bodyStr = JSON.stringify(body);
    const expected = 'sha256=' + crypto.createHmac('sha256', FGIS_WEBHOOK_SECRET).update(bodyStr).digest('hex');
    if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid FGIS signature');
    }
    return this.integrations.handleFgisWebhook(body);
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

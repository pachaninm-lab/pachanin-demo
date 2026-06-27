import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { PartnerApiService } from './partner-api.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Controller('api/partner')
@UseGuards(JwtAuthGuard)
export class PartnerApiController {
  constructor(
    private readonly partnerApi: PartnerApiService,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}

  @Post('api-keys')
  generateKey(
    @Body() body: { name: string; scopes: string[]; rateLimit?: number; expiresInDays?: number },
    @CurrentUser() user: RequestUser,
  ) {
    return this.partnerApi.generateApiKey(body, user);
  }

  @Get('api-keys')
  listKeys(@CurrentUser() user: RequestUser) {
    return this.partnerApi.listApiKeys(user);
  }

  @Delete('api-keys/:id')
  revokeKey(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.partnerApi.revokeApiKey(id, user);
  }

  @Post('webhooks')
  subscribeWebhook(
    @Body() body: { url: string; events: string[] },
    @CurrentUser() user: RequestUser,
  ) {
    return this.partnerApi.subscribeWebhook(body, user);
  }

  @Get('webhooks')
  listWebhooks(@CurrentUser() user: RequestUser) {
    return this.partnerApi.listWebhooks(user);
  }

  @Delete('webhooks/:id')
  deleteWebhook(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.partnerApi.deleteWebhook(id, user);
  }

  @Post('webhooks/:id/test')
  async testWebhook(
    @Param('id') id: string,
    @Body() body: { eventType?: string; testData?: Record<string, unknown> },
    @CurrentUser() user: RequestUser,
  ) {
    const webhooks = this.partnerApi.listWebhooks(user);
    const wh = webhooks.find((w) => w.id === id);
    if (!wh) return { error: `Webhook subscription ${id} not found` };

    const eventType = body.eventType ?? 'test.ping';
    const testPayload = body.testData ?? { message: 'GrainFlow webhook test', at: new Date().toISOString() };
    const bodyStr = JSON.stringify({ eventType, timestamp: new Date().toISOString(), data: testPayload });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sig = this.dispatcher.sign(wh.secret, timestamp, bodyStr);

    const start = Date.now();
    let delivered = false;
    let httpStatus: number | undefined;
    let error: string | undefined;

    try {
      const response = await fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GrainFlow-Signature': `sha256=${sig}`,
          'X-GrainFlow-Timestamp': timestamp,
          'X-GrainFlow-Event': eventType,
          'User-Agent': 'GrainFlow-Webhook-Test/3.0',
        },
        body: bodyStr,
        signal: AbortSignal.timeout(10_000),
      });
      delivered = response.ok;
      httpStatus = response.status;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    return {
      subscriptionId: id,
      url: wh.url,
      delivered,
      httpStatus,
      durationMs: Date.now() - start,
      signedWith: 'HMAC-SHA256',
      eventType,
      error,
    };
  }

  @Get('deals/:dealId/status')
  getDealStatus(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return { dealId, status: 'PUBLISHED', note: 'Partner API deal status endpoint' };
  }
}

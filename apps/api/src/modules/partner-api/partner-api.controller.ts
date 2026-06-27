import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { PartnerApiService } from './partner-api.service';

@Controller('api/partner')
@UseGuards(JwtAuthGuard)
export class PartnerApiController {
  constructor(private readonly partnerApi: PartnerApiService) {}

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

  @Get('deals/:dealId/status')
  getDealStatus(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return { dealId, status: 'PUBLISHED', note: 'Partner API deal status endpoint' };
  }
}

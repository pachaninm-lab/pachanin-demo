import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser, Role } from '../../common/types/request-user';
import { AntiFraudService, DealContext } from './anti-fraud.service';
import { ForbiddenException } from '@nestjs/common';

const FRAUD_ADMIN_ROLES: Role[] = [Role.ADMIN, Role.COMPLIANCE_OFFICER, Role.SUPPORT_MANAGER];

@Controller('api/anti-fraud')
@UseGuards(JwtAuthGuard)
export class AntiFraudController {
  constructor(private readonly antiFraud: AntiFraudService) {}

  @Post('check')
  async check(@Body() ctx: DealContext, @CurrentUser() user: RequestUser) {
    if (!FRAUD_ADMIN_ROLES.includes(user.role as Role)) throw new ForbiddenException();
    const entityId = ctx.dealId ?? 'manual-check';
    return this.antiFraud.check(entityId, ctx as DealContext & Record<string, unknown>);
  }

  @Post('off-platform')
  async reportOffPlatform(
    @Body() body: {
      dealId: string;
      buyerOrgId: string;
      sellerOrgId: string;
      indicator: 'external_payment_mentioned' | 'deal_cancelled_after_delivery' | 'reputation_drop_post_cancel' | 'counterparty_comment_flag';
      evidence?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.antiFraud.checkOffPlatformSettlement({ ...body, actorId: user.id });
  }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { BusinessReputationService } from './business-reputation.service';

@Controller('api/reputation')
@UseGuards(JwtAuthGuard)
export class BusinessReputationController {
  constructor(private readonly reputation: BusinessReputationService) {}

  @Get('orgs/:orgId')
  getScore(@Param('orgId') orgId: string, @CurrentUser() _user: RequestUser) {
    return this.reputation.getScore(orgId);
  }

  @Post('orgs/batch')
  getScoreBatch(@Body() body: { orgIds: string[] }, @CurrentUser() _user: RequestUser) {
    return this.reputation.getScoreBatch(body.orgIds ?? []);
  }
}

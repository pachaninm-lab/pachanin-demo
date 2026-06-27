import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser, Role } from '../../common/types/request-user';
import { DealSagaService, SagaStepId } from './deal-saga.service';
import { ForbiddenException } from '@nestjs/common';

@Controller('api/saga')
@UseGuards(JwtAuthGuard)
export class SagaController {
  constructor(private readonly saga: DealSagaService) {}

  @Get('deals/:dealId')
  getState(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.saga.getState(dealId) ?? this.saga.init(dealId);
  }

  @Post('deals/:dealId/pause')
  pause(
    @Param('dealId') dealId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: RequestUser,
  ) {
    this.assertAdmin(user);
    return this.saga.pause(dealId, body.reason ?? 'Manual pause');
  }

  @Post('deals/:dealId/resume')
  resume(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    this.assertAdmin(user);
    return this.saga.resume(dealId);
  }

  @Post('deals/:dealId/retry/:stepId')
  retry(
    @Param('dealId') dealId: string,
    @Param('stepId') stepId: string,
    @CurrentUser() user: RequestUser,
  ) {
    this.assertAdmin(user);
    return this.saga.retry(dealId, stepId as SagaStepId);
  }

  @Post('deals/:dealId/skip/:stepId')
  skip(
    @Param('dealId') dealId: string,
    @Param('stepId') stepId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: RequestUser,
  ) {
    this.assertAdmin(user);
    return this.saga.skip(dealId, stepId as SagaStepId, body.reason ?? 'Manual skip');
  }

  private assertAdmin(user: RequestUser): void {
    if (user.role !== Role.ADMIN && user.role !== Role.SUPPORT_MANAGER) {
      throw new ForbiddenException('Only ADMIN or SUPPORT_MANAGER can control saga');
    }
  }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser, Role } from '../../common/types/request-user';
import { DealSagaService, SagaStepId } from './deal-saga.service';
import { FgisStepService } from './fgis-step.service';
import { ForbiddenException } from '@nestjs/common';

@Controller('api/saga')
@UseGuards(JwtAuthGuard)
export class SagaController {
  constructor(
    private readonly saga: DealSagaService,
    private readonly fgis: FgisStepService,
  ) {}

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

  /** Execute ФГИС Зерно registration for a deal */
  @Post('deals/:dealId/execute/fgis_register')
  async executeFgisRegister(
    @Param('dealId') dealId: string,
    @Body() body: {
      culture: string;
      cropClass: string;
      volumeTons: number;
      producerInn: string;
      regionCode: string;
      gost: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    this.assertAdmin(user);
    return this.fgis.executeFgisRegister({ dealId, ...body });
  }

  @Post('deals/:dealId/fgis/confirm-shipment')
  async fgisConfirmShipment(
    @Param('dealId') dealId: string,
    @Body() body: { fgisLotId: string; vehicleNumber: string; driverName: string; routeFrom: string; routeTo: string; loadedTons: number },
    @CurrentUser() user: RequestUser,
  ) {
    this.assertAdmin(user);
    return this.fgis.confirmShipment({ dealId, ...body });
  }

  @Post('deals/:dealId/fgis/confirm-acceptance')
  async fgisConfirmAcceptance(
    @Param('dealId') dealId: string,
    @Body() body: { fgisLotId: string; receiverInn: string; acceptedTons: number; quality: Record<string, number> },
    @CurrentUser() user: RequestUser,
  ) {
    this.assertAdmin(user);
    return this.fgis.confirmAcceptance({ dealId, ...body });
  }

  @Get('fgis/crops')
  getFgisCrops() {
    return this.fgis.getCrops();
  }

  private assertAdmin(user: RequestUser): void {
    if (user.role !== Role.ADMIN && user.role !== Role.SUPPORT_MANAGER) {
      throw new ForbiddenException('Only ADMIN or SUPPORT_MANAGER can control saga');
    }
  }
}

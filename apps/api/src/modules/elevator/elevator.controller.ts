import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { ElevatorService } from './elevator.service';

@Controller('api/elevator')
@UseGuards(JwtAuthGuard)
export class ElevatorController {
  constructor(private readonly elevator: ElevatorService) {}

  @Post('acts')
  createAct(@Body() body: any, @CurrentUser() user: RequestUser) {
    return this.elevator.createWeighingAct(body, user);
  }

  @Get('acts/:id')
  getAct(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.elevator.getAct(id, user);
  }

  @Get('shipments/:shipmentId/acts')
  listByShipment(@Param('shipmentId') shipmentId: string, @CurrentUser() user: RequestUser) {
    return this.elevator.listActsByShipment(shipmentId, user);
  }

  @Get('deals/:dealId/acts')
  listByDeal(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.elevator.listActsByDeal(dealId, user);
  }

  @Get('deals/:dealId/discrepancy')
  discrepancySummary(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.elevator.getDiscrepancySummary(dealId, user);
  }

  @Patch('acts/:id/accept')
  acceptAct(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.elevator.acceptAct(id, user);
  }

  @Patch('acts/:id/dispute')
  disputeAct(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: RequestUser) {
    return this.elevator.disputeAct(id, body.reason, user);
  }

  @Patch('acts/:id/correct')
  correctAct(@Param('id') id: string, @Body() body: any, @CurrentUser() user: RequestUser) {
    return this.elevator.correctAct(id, body, user);
  }
}

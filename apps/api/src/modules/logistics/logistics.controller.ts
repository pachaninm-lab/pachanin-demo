import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import {
  RecordShipmentCheckpointDto,
  RecordShipmentGpsDto,
  VerifyShipmentPinDto,
} from './dto/shipment-fact-command.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';
import { LogisticsService } from './logistics.service';

/**
 * PostgreSQL-authoritative logistics boundary.
 *
 * Shipment lifecycle creation/transitions remain available only through the
 * canonical Deal command endpoint. This controller exposes scoped reads and
 * append-only operational facts. Mock GIS EPD and process-memory geofencing are
 * deliberately absent from the production dependency graph.
 */
@UseGuards(RolesGuard)
@Roles('LOGISTICIAN', 'DRIVER', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN')
@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logistics: LogisticsService) {}

  @Get('summary')
  summary(@CurrentUser() user: RequestUser) {
    return this.logistics.summary(user);
  }

  @Get('shipments')
  list(@CurrentUser() user: RequestUser) {
    return this.logistics.list(user);
  }

  @Get('shipments/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.logistics.getOne(id, user);
  }

  @Get('shipments/:id/workspace')
  workspace(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.logistics.workspace(id, user);
  }

  @Post('shipments')
  create(@Body() dto: CreateShipmentDto, @CurrentUser() user: RequestUser) {
    return this.logistics.create(dto, user);
  }

  @Patch('shipments/:id/transition')
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionShipmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.logistics.transition(id, dto, user);
  }

  @Patch('shipments/:id/status')
  transitionCompat(
    @Param('id') id: string,
    @Body() body: { status?: string; nextState?: string; lat?: number; lng?: number; comment?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.logistics.transition(id, {
      nextState: (body?.nextState || body?.status || '') as TransitionShipmentDto['nextState'],
      lat: body?.lat,
      lng: body?.lng,
      comment: body?.comment,
    }, user);
  }

  @Post('shipments/:id/checkpoints')
  checkpoint(
    @Param('id') id: string,
    @Body() dto: RecordShipmentCheckpointDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.logistics.recordCheckpoint(id, dto, user);
  }

  @Post('shipments/:id/verify-pin')
  verifyPin(
    @Param('id') id: string,
    @Body() dto: VerifyShipmentPinDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.logistics.verifyPin(id, dto, user);
  }

  @Post('shipments/:id/gps')
  updateGps(
    @Param('id') id: string,
    @Body() dto: RecordShipmentGpsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.logistics.updateGps(id, dto, user);
  }

  @Get('shipments/:id/gps/track')
  getGpsTrack(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.logistics.getGpsTrack(id, user);
  }
}

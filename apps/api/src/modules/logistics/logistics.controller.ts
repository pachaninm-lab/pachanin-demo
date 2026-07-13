import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
import { EtnService } from './etn.service';
import { Geofence, GeofenceService } from './geofence.service';
import { LogisticsService } from './logistics.service';

@UseGuards(RolesGuard)
@Roles('LOGISTICIAN', 'DRIVER', 'ELEVATOR', 'SUPPORT_MANAGER', 'ADMIN')
@Controller('logistics')
export class LogisticsController {
  constructor(
    private readonly logistics: LogisticsService,
    private readonly etn: EtnService,
    private readonly geofence: GeofenceService,
  ) {}

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

  /** GIS EPD remains fail-closed until provider activation is accepted. */
  @Post('etn')
  createEtn(
    @Body() body: {
      dealId: string;
      shipper: { name: string; inn: string; address: string };
      consignee: { name: string; inn: string; address: string };
      carrier: { name: string; inn: string };
      vehicleNumber: string;
      driverName: string;
      driverLicenseNumber: string;
      loadingAddress: string;
      unloadingAddress: string;
      cargoDescription: string;
      weightTons: number;
      volumeM3?: number;
      loadingDate: string;
      deliveryDatePlan: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.etn.createEtn(body, user);
  }

  @Get('etn/deal/:dealId')
  listEtnByDeal(@Param('dealId') dealId: string) {
    return this.etn.listByDeal(dealId);
  }

  @Get('etn/:id')
  getEtnStatus(@Param('id') id: string) {
    return this.etn.getEtnStatus(id);
  }

  @Post('etn/:id/sign')
  signEtn(
    @Param('id') id: string,
    @Body() body: { signerRole: 'SHIPPER' | 'CARRIER' | 'CONSIGNEE'; certificateId?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.etn.signEtn(id, body.signerRole, body.certificateId ?? '', user);
  }

  @Post('geofences')
  createGeofence(@Body() body: Geofence) {
    return this.geofence.upsert(body);
  }

  @Get('geofences')
  listGeofences(@Query('dealId') dealId?: string) {
    return this.geofence.listFences(dealId);
  }

  @Post('geofences/deal/:dealId')
  createForDeal(
    @Param('dealId') dealId: string,
    @Body() body: { coordinates?: Array<{ kind: Geofence['kind']; lat: number; lon: number }> },
  ) {
    return this.geofence.createForDeal(dealId, body);
  }

  @Delete('geofences/:id')
  deleteGeofence(@Param('id') id: string) {
    return { deleted: this.geofence.deleteFence(id) };
  }

  @Post('vehicles/:vehicleId/gps-evaluate')
  evaluateGpsPoint(
    @Param('vehicleId') vehicleId: string,
    @Body() body: { lat: number; lon: number; recordedAt?: string; shipmentId?: string },
  ) {
    return this.geofence.evaluatePoint(vehicleId, body, body.shipmentId);
  }

  @Get('vehicles/:vehicleId/state')
  getVehicleState(@Param('vehicleId') vehicleId: string) {
    return this.geofence.getVehicleState(vehicleId);
  }
}

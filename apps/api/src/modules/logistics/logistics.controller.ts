import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Delete, Query, UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LogisticsService } from './logistics.service';
import { EtnService } from './etn.service';
import { GeofenceService, Geofence } from './geofence.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';

@UseGuards(RolesGuard)
@Roles('LOGISTICIAN', 'DRIVER', 'SUPPORT_MANAGER', 'ADMIN')
@Controller('logistics')
export class LogisticsController {
  constructor(
    private readonly logistics: LogisticsService,
    private readonly etn: EtnService,
    private readonly geofence: GeofenceService,
  ) {}

  @Get('summary')
  summary(@CurrentUser() user: any) {
    return this.logistics.summary(user);
  }

  @Get('shipments')
  list(@CurrentUser() user: any) {
    return this.logistics.list(user);
  }

  @Get('shipments/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.logistics.getOne(id, user);
  }

  @Get('shipments/:id/workspace')
  workspace(@Param('id') id: string, @CurrentUser() user: any) {
    return this.logistics.workspace(id, user);
  }

  @Post('shipments')
  create(@Body() dto: CreateShipmentDto, @CurrentUser() user: any) {
    return this.logistics.create(dto, user);
  }

  @Patch('shipments/:id/transition')
  transition(@Param('id') id: string, @Body() dto: TransitionShipmentDto, @CurrentUser() user: any) {
    return this.logistics.transition(id, dto, user);
  }

  @Patch('shipments/:id/status')
  transitionCompat(@Param('id') id: string, @Body() body: { status?: string; nextState?: string; lat?: number; lng?: number; comment?: string }, @CurrentUser() user: any) {
    return this.logistics.transition(id, { nextState: (body?.nextState || body?.status || '') as any, lat: body?.lat, lng: body?.lng, comment: body?.comment }, user);
  }

  @Post('shipments/:id/checkpoints')
  checkpoint(@Param('id') id: string, @Body() body: { type?: string; lat?: number; lng?: number; comment?: string; timestamp?: string }, @CurrentUser() user: any) {
    return this.logistics.recordCheckpoint(id, body, user);
  }

  @Post('shipments/:id/verify-pin')
  verifyPin(@Param('id') id: string, @Body() body: { pin?: string }, @CurrentUser() user: any) {
    return this.logistics.verifyPin(id, String(body?.pin || ''), user);
  }

  @Post('shipments/:id/gps')
  updateGps(
    @Param('id') id: string,
    @Body() body: { lat: number; lng: number; speedKmh?: number; headingDeg?: number; accuracyM?: number },
    @CurrentUser() user: any,
  ) {
    return this.logistics.updateGps(id, body, user);
  }

  @Get('shipments/:id/gps/track')
  getGpsTrack(@Param('id') id: string, @CurrentUser() user: any) {
    return this.logistics.getGpsTrack(id, user);
  }

  /** ГИС ЭПД (Минтранс) — Электронные транспортные накладные (ЭТН) */
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
    @CurrentUser() user: any,
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
    @CurrentUser() user: any,
  ) {
    return this.etn.signEtn(id, body.signerRole, body.certificateId ?? `cert-${user.id}`, user);
  }

  /** ТЗ 9.2 — Геозоны */
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

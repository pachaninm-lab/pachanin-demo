import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoutePlannerService } from './route-planner.service';
import {
  CalculateEtaDto,
  EstimateTariffDto,
  RegisterGeofencesDto,
  UpdateVehiclePositionDto,
} from './dto/route-planner.dto';

@UseGuards(RolesGuard)
@Roles('LOGISTICIAN', 'DRIVER', 'SUPPORT_MANAGER', 'ADMIN')
@Controller('route-planner')
export class RoutePlannerController {
  constructor(private readonly routePlanner: RoutePlannerService) {}

  @Get('weighbridge')
  weighbridge() {
    return this.routePlanner.weighbridge();
  }

  @Get('shipment/:shipmentId')
  shipment(@Param('shipmentId') shipmentId: string) {
    return this.routePlanner.shipment(shipmentId);
  }

  @Get('vehicles/:vehicleId/position')
  getVehiclePosition(@Param('vehicleId') vehicleId: string) {
    return this.routePlanner.getVehiclePosition(vehicleId);
  }

  @Get('vehicles/:vehicleId/track')
  getVehicleTrack(
    @Param('vehicleId') vehicleId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date();
    return this.routePlanner.getVehicleTrack(vehicleId, fromDate, toDate);
  }

  @Post('vehicles/:vehicleId/position')
  updatePosition(
    @Param('vehicleId') vehicleId: string,
    @Body() body: UpdateVehiclePositionDto,
  ) {
    // Поля перечислены поимённо: россыпь позволяла телу принести в точку
    // что угодно помимо объявленных координат.
    return this.routePlanner.updateVehiclePosition(vehicleId, {
      lat: body.lat,
      lng: body.lng,
      ...(body.speed === undefined ? {} : { speed: body.speed }),
      ...(body.heading === undefined ? {} : { heading: body.heading }),
      timestamp: new Date().toISOString(),
    });
  }

  @Post('vehicles/:vehicleId/geofences')
  registerGeofences(
    @Param('vehicleId') vehicleId: string,
    @Body() body: RegisterGeofencesDto,
  ) {
    // `as any` здесь больше не нужен: форма зон проверена до контроллера.
    return this.routePlanner.registerGeofences(vehicleId, body.zones);
  }

  @Get('vehicles/:vehicleId/geofence-events')
  getGeofenceEvents(
    @Param('vehicleId') vehicleId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date();
    return this.routePlanner.getGeofenceEvents(vehicleId, fromDate, toDate);
  }

  @Post('calculate-eta')
  calculateEta(
    @Body() body: CalculateEtaDto,
  ) {
    return this.routePlanner.calculateEta(
      { lat: body.fromLat, lng: body.fromLng },
      { lat: body.toLat, lng: body.toLng },
      body.avgSpeedKmh,
    );
  }

  @Post('tariff')
  estimateTariff(
    @Body() body: EstimateTariffDto,
  ) {
    return this.routePlanner.estimateLogisticsTariff(body.distanceKm, body.weightTons, body.vehicleType);
  }
}

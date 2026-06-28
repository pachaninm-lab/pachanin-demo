import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoutePlannerService } from './route-planner.service';

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
    @Body() body: { lat: number; lng: number; speed?: number; heading?: number },
  ) {
    return this.routePlanner.updateVehiclePosition(vehicleId, { ...body, timestamp: new Date().toISOString() });
  }

  @Post('vehicles/:vehicleId/geofences')
  registerGeofences(
    @Param('vehicleId') vehicleId: string,
    @Body() body: { zones: Array<{ id: string; name: string; lat: number; lng: number; radiusMeters: number; type: string }> },
  ) {
    return this.routePlanner.registerGeofences(vehicleId, body.zones as any);
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
    @Body() body: {
      fromLat: number; fromLng: number;
      toLat: number; toLng: number;
      avgSpeedKmh?: number;
    },
  ) {
    return this.routePlanner.calculateEta(
      { lat: body.fromLat, lng: body.fromLng },
      { lat: body.toLat, lng: body.toLng },
      body.avgSpeedKmh,
    );
  }

  @Post('tariff')
  estimateTariff(
    @Body() body: { distanceKm: number; weightTons: number; vehicleType?: 'truck' | 'rail' | 'vessel' },
  ) {
    return this.routePlanner.estimateLogisticsTariff(body.distanceKm, body.weightTons, body.vehicleType);
  }
}

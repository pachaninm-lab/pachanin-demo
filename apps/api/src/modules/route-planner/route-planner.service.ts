import { Injectable } from '@nestjs/common';

@Injectable()
export class RoutePlannerService {
  weighbridge() {
    return {
      items: [
        {
          id: 'WB-001',
          vehicleNumber: 'А123ВС68',
          dealId: 'DEAL-001',
          status: 'IN_QUEUE',
          arrivalTime: '2026-04-05T14:00:00Z',
          estimatedWeight: 500,
        },
      ],
    };
  }

  shipment(shipmentId: string) {
    return {
      shipmentId,
      waypoints: [
        { lat: 52.72, lng: 41.45, name: 'Тамбов (погрузка)', type: 'LOADING' },
        { lat: 52.1, lng: 42.0, name: 'Контрольная точка 1', type: 'CHECKPOINT' },
        { lat: 51.67, lng: 39.21, name: 'Воронеж (разгрузка)', type: 'UNLOADING' },
      ],
      estimatedDistance: 450,
      etaHours: 5.5,
      currentStatus: 'IN_TRANSIT',
    };
  }
}

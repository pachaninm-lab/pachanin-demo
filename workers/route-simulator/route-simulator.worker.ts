import { writeStructuredLog } from '../../apps/api/src/common/logging/structured-logger';

type RouteEvent = { shipmentId: string; code: string; eta: string };

const ROUTE_EVENTS: RouteEvent[] = [
  { shipmentId: 'SHIP-240312-01', code: 'at_loading', eta: '6ч 20м' },
  { shipmentId: 'SHIP-240312-02', code: 'route_deviation', eta: '7ч 10м' }
];

export async function runRouteSimulatorWorker() {
  for (const event of ROUTE_EVENTS) {
    writeStructuredLog({
      source: 'worker.route-simulator',
      message: 'Route event simulated',
      eventType: 'route.simulated',
      objectType: 'shipment',
      objectId: event.shipmentId,
      data: event
    });
  }
}

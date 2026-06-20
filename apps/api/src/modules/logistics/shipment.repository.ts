/**
 * Injection token for the shipment data-access boundary.
 *
 * Controlled-pilot / pre-integration: default is the in-memory RuntimeCore
 * adapter. The DB-backed (Prisma) adapter is a disabled skeleton selected only
 * under the explicit PLATFORM_V7_SHIPMENT_REPOSITORY=prisma flag. No silent
 * Prisma activation. No live GPS / telematics integration.
 */
export const SHIPMENT_REPOSITORY = 'SHIPMENT_REPOSITORY';

/**
 * Repository boundary for shipment reads/writes. Abstracts how shipments are
 * stored away from LogisticsService (which keeps driver-isolation access
 * checks). Read methods are async to allow a future DB-backed adapter; the
 * runtime adapter resolves synchronously under the hood.
 */
export interface ShipmentRepository {
  list(): Promise<any[]>;
  getById(id: string): Promise<any>;
  workspace(id: string): any;
  create(dto: any, user: any): any;
  transition(id: string, dto: any, user: any): any;
  recordCheckpoint(id: string, body: any, user: any): any;
  verifyPin(id: string, pin: string): any;
}

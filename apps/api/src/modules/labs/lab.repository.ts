/**
 * Injection token for the lab data-access boundary.
 *
 * Controlled-pilot / pre-integration: default is the in-memory RuntimeCore
 * adapter. The DB-backed (Prisma) adapter is a disabled skeleton selected only
 * under the explicit PLATFORM_V7_LAB_REPOSITORY=prisma flag. No silent Prisma
 * activation. No live lab integration / external protocol upload.
 */
export const LAB_REPOSITORY = 'LAB_REPOSITORY';

/**
 * Repository boundary for lab sample reads/writes. Abstracts how lab samples
 * and tests are stored away from LabsService. Read methods are async to allow
 * a future DB-backed adapter; the runtime adapter resolves synchronously.
 */
export interface LabRepository {
  list(): Promise<any[]>;
  getById(id: string): Promise<any>;
  create(dto: any, user: any): any;
  collect(id: string, user: any): any;
  recordTest(id: string, dto: any, user: any): any;
  finalize(id: string, user: any): any;
}

import type { RuntimeCoreService } from '../runtime-core/runtime-core.service';

/**
 * Injection token for the document data-access boundary.
 *
 * Controlled-pilot / pre-integration: default is the in-memory RuntimeCore
 * adapter. The DB-backed (Prisma) adapter is a disabled skeleton selected only
 * under the explicit PLATFORM_V7_DOCUMENT_REPOSITORY=prisma flag. No silent
 * Prisma activation.
 */
export const DOCUMENT_REPOSITORY = 'DOCUMENT_REPOSITORY';

/**
 * Repository boundary for document reads/writes. Abstracts how documents are
 * stored away from DocumentsService (which keeps matrix / completeness /
 * release-gate logic). Read methods are async to allow a future DB-backed
 * adapter; the runtime adapter resolves synchronously under the hood.
 */
export interface DocumentRepository {
  list(): Promise<any[]>;
  getById(id: string): Promise<any>;
  upload(file: any, dto: any, user: any): any;
  sign(id: string, user: any): any;
  generateDealPackage(dealId: string, user: any): any;
}

import { Injectable } from '@nestjs/common';
import type { DocumentRepository } from './document.repository';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

/**
 * Default document repository adapter. Wraps the in-memory RuntimeCore document
 * methods without changing behavior. Only active adapter in controlled-pilot.
 */
@Injectable()
export class RuntimeDocumentRepository implements DocumentRepository {
  constructor(private readonly runtime: RuntimeCoreService) {}

  async list(): Promise<any[]> {
    return this.runtime.listDocuments();
  }

  async getById(id: string): Promise<any> {
    return this.runtime.getDocument(id);
  }

  upload(file: any, dto: any, user: any): any {
    return this.runtime.uploadDocument(file, dto, user);
  }

  sign(id: string, user: any): any {
    return this.runtime.signDocument(id, user);
  }

  generateDealPackage(dealId: string, user: any): any {
    return this.runtime.generateDealPackage(dealId, user);
  }
}

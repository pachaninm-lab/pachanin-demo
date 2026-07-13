import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { DealDocument, Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StoragePrismaService } from '../../common/prisma/storage-prisma.service';
import type { RequestUser } from '../../common/types/request-user';
import { normalizeMimeType, type ObjectInspection } from './object-storage.adapter';

type PendingEvidence = Readonly<{
  id: string;
  version: number;
  status: string;
}>;

@Injectable()
export class StorageFinalizationRepository {
  private readonly rls: RlsTransactionService;

  constructor(@Inject(StoragePrismaService) prisma: PrismaService) {
    this.rls = new RlsTransactionService(prisma);
  }

  async markVerified(
    record: PendingEvidence,
    inspection: ObjectInspection,
    user: RequestUser,
  ): Promise<DealDocument> {
    return this.transition(record, inspection, 'VERIFIED', user);
  }

  async quarantine(
    record: PendingEvidence,
    reason: string,
    inspection: ObjectInspection,
    user: RequestUser,
  ): Promise<DealDocument> {
    return this.transition(record, inspection, `QUARANTINED_${reason}`, user);
  }

  private async transition(
    record: PendingEvidence,
    inspection: ObjectInspection,
    status: string,
    user: RequestUser,
  ): Promise<DealDocument> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const result = await tx.dealDocument.updateMany({
        where: {
          id: record.id,
          type: 'EVIDENCE_FILE',
          status: record.status,
          version: record.version,
          isImmutable: false,
        },
        data: {
          status,
          hash: inspection.sha256,
          sizeBytes: inspection.sizeBytes,
          mimeType: normalizeMimeType(inspection.contentType),
          isImmutable: true,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new ConflictException('Evidence finalization lost an optimistic concurrency race.');
      }
      return tx.dealDocument.findUniqueOrThrow({ where: { id: record.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

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

const MAX_FINALIZATION_ATTEMPTS = 8;

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
    for (let attempt = 1; attempt <= MAX_FINALIZATION_ATTEMPTS; attempt += 1) {
      try {
        return await this.rls.withTrustedContext(user, async (tx) => {
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
      } catch (error) {
        const converged = await this.findConverged(record.id, status, inspection, user);
        if (converged) return converged;
        if (!isTransientTransactionConflict(error) || attempt === MAX_FINALIZATION_ATTEMPTS) throw error;
        await wait(Math.min(25 * (2 ** (attempt - 1)), 400));
      }
    }
    throw new ConflictException('Evidence finalization did not converge.');
  }

  private async findConverged(
    id: string,
    status: string,
    inspection: ObjectInspection,
    user: RequestUser,
  ): Promise<DealDocument | null> {
    return this.rls.withTrustedContext(user, async (tx) => {
      const persisted = await tx.dealDocument.findFirst({
        where: { id, type: 'EVIDENCE_FILE', status, isImmutable: true },
      });
      if (!persisted) return null;
      const sameFact = persisted.hash === inspection.sha256
        && persisted.sizeBytes === inspection.sizeBytes
        && normalizeMimeType(persisted.mimeType ?? '') === normalizeMimeType(inspection.contentType);
      return sameFact ? persisted : null;
    });
  }
}

function isTransientTransactionConflict(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
  if (code === 'P2034' || code === '40001' || code === '40P01') return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010') {
    const meta = error.meta as Record<string, unknown> | undefined;
    if (meta?.code === '40001' || meta?.code === '40P01') return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /write conflict|deadlock|serialization failure|could not serialize/i.test(message);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

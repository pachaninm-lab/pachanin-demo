import { EntityId } from './core-types';
import { createAuditEvent } from './audit-events';

export interface DocumentFingerprintInput {
  fileId: EntityId;
  userId: EntityId;
  dealId?: EntityId;
  lotId?: EntityId;
  rfqId?: EntityId;
  accessLevel: 'preview' | 'download' | 'full';
  fileHash: string;
  openedAt?: string;
}

export interface DocumentFingerprint {
  visibleWatermark: string;
  invisibleFingerprint: string;
  fileHash: string;
  openedAt: string;
}

export function createDocumentFingerprint(input: DocumentFingerprintInput): DocumentFingerprint {
  const openedAt = input.openedAt ?? new Date().toISOString();
  const scope = input.dealId ?? input.lotId ?? input.rfqId ?? 'NO-SCOPE';
  return {
    visibleWatermark: `${scope} · пользователь ${input.userId} · доступ ${input.accessLevel} · ${openedAt}`,
    invisibleFingerprint: Buffer.from(`${input.fileId}|${input.userId}|${scope}|${input.accessLevel}|${openedAt}`).toString('base64'),
    fileHash: input.fileHash,
    openedAt,
  };
}

export function auditDocumentAccess(input: DocumentFingerprintInput, actorRole: 'seller' | 'buyer' | 'operator' | 'bank') {
  const fingerprint = createDocumentFingerprint(input);
  return {
    fingerprint,
    auditEvent: createAuditEvent({
      entityType: 'document',
      entityId: input.fileId,
      dealId: input.dealId,
      actorRole,
      actorId: input.userId,
      action: input.accessLevel === 'download' ? 'document_downloaded' : 'document_opened',
      after: { accessLevel: input.accessLevel, visibleWatermark: fingerprint.visibleWatermark, fileHash: input.fileHash },
    }),
  };
}

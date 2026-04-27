import { buildEvidencePackReadiness, type P7EvidenceItem } from '../platform-v7/evidence-pack';

export const STABLE_DK_2024_89_EVIDENCE: P7EvidenceItem[] = [
  {
    id: 'EV-DK-89-LAB-001',
    dealId: 'DL-9102',
    disputeId: 'DK-2024-89',
    type: 'lab_protocol',
    source: 'lab',
    trust: 'signed',
    title: 'Лабораторный протокол по влажности',
    hash: 'sha256:lab-dk-89-001',
    mimeType: 'application/pdf',
    sizeBytes: 248000,
    capturedAt: '2026-04-03T11:20:00Z',
    uploadedAt: '2026-04-03T11:24:00Z',
    actor: 'lab.supervisor',
    signedBy: 'pilot-signature:lab.supervisor',
    version: 1,
    immutable: true,
  },
  {
    id: 'EV-DK-89-TDP-001',
    dealId: 'DL-9102',
    disputeId: 'DK-2024-89',
    type: 'transport_document',
    source: 'sberkorus',
    trust: 'provider_verified',
    title: 'ЭТрН и цепочка подписей',
    hash: 'sha256:tdp-dk-89-001',
    mimeType: 'application/pdf',
    sizeBytes: 512000,
    capturedAt: '2026-04-03T09:45:00Z',
    uploadedAt: '2026-04-03T09:47:00Z',
    actor: 'sberkorus.webhook',
    version: 1,
    immutable: true,
  },
  {
    id: 'EV-DK-89-PHOTO-001',
    dealId: 'DL-9102',
    disputeId: 'DK-2024-89',
    type: 'photo',
    source: 'buyer',
    trust: 'platform_verified',
    title: 'Фото пробы на приёмке',
    hash: 'sha256:photo-dk-89-001',
    mimeType: 'image/jpeg',
    sizeBytes: 1860000,
    capturedAt: '2026-04-03T10:55:00Z',
    uploadedAt: '2026-04-03T10:57:00Z',
    actor: 'buyer.receiver',
    geo: { lat: 52.721, lon: 41.452, accuracyM: 18 },
    version: 1,
    immutable: true,
  },
  {
    id: 'EV-DK-89-BANK-001',
    dealId: 'DL-9102',
    disputeId: 'DK-2024-89',
    type: 'bank_event',
    source: 'bank',
    trust: 'provider_verified',
    title: 'Hold 624000 RUB',
    hash: 'sha256:bank-dk-89-001',
    uploadedAt: '2026-04-03T12:05:00Z',
    actor: 'bank-runtime',
    previousHash: 'sha256:tdp-dk-89-001',
    version: 1,
    immutable: true,
  },
];

export function buildStableDisputeEvidencePack(disputeId: string) {
  const items = disputeId === 'DK-2024-89' ? STABLE_DK_2024_89_EVIDENCE : [];
  const readiness = buildEvidencePackReadiness(items);

  return {
    disputeId,
    dealId: items[0]?.dealId ?? null,
    items,
    readiness,
  };
}

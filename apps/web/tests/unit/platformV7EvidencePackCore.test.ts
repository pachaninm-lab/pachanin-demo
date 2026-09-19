import { describe, expect, it } from 'vitest';
import {
  appendEvidenceItem,
  buildEvidencePackReadiness,
  lockEvidencePack,
  validateEvidenceChain,
  validateEvidenceItem,
  type P7EvidenceItem,
} from '@/lib/platform-v7/evidence-pack';

const baseEvidence: P7EvidenceItem = {
  id: 'EV-LAB-001',
  dealId: 'DL-9102',
  disputeId: 'DK-2024-89',
  type: 'lab_protocol',
  source: 'lab',
  trust: 'signed',
  title: 'Лабораторный протокол качества',
  hash: 'sha256:lab-protocol-001',
  mimeType: 'application/pdf',
  uploadedAt: '2026-04-26T10:00:00Z',
  actor: 'lab-operator',
  signedBy: 'pilot-signature:lab-operator',
  version: 1,
  immutable: true,
};

const readyEvidence: P7EvidenceItem[] = [
  baseEvidence,
  {
    ...baseEvidence,
    id: 'EV-TRN-001',
    type: 'transport_document',
    source: 'sberkorus',
    trust: 'provider_verified',
    title: 'ЭТрН',
    hash: 'sha256:transport-document-001',
    signedBy: undefined,
  },
  {
    ...baseEvidence,
    id: 'EV-PHOTO-001',
    type: 'photo',
    source: 'platform',
    trust: 'platform_verified',
    title: 'Фото с гео',
    hash: 'sha256:photo-001',
    mimeType: 'image/jpeg',
    signedBy: undefined,
    geo: { lat: 52.721, lon: 41.452, accuracyM: 12 },
  },
];

describe('platform-v7 evidence pack core', () => {
  it('builds ready evidence readiness when all required objects are present and valid', () => {
    const readiness = buildEvidencePackReadiness(readyEvidence);

    expect(readiness).toMatchObject({
      status: 'ready_for_review',
      total: 3,
      requiredTotal: 3,
      requiredReady: 3,
      score: 100,
      issues: [],
    });
  });

  it('detects missing required evidence object', () => {
    const readiness = buildEvidencePackReadiness(readyEvidence.filter((item) => item.type !== 'photo'));

    expect(readiness.status).toBe('incomplete');
    expect(readiness.score).toBe(67);
    expect(readiness.issues).toContainEqual(expect.objectContaining({
      code: 'MISSING_REQUIRED_EVIDENCE',
      target: 'photo',
    }));
  });

  it('validates hash, immutable flag, version and signer for signed evidence', () => {
    const issues = validateEvidenceItem({
      ...baseEvidence,
      hash: '',
      immutable: false,
      version: 0,
      signedBy: '',
    });

    expect(issues.map((issue) => issue.code)).toEqual([
      'HASH_MISSING',
      'IMMUTABILITY_BROKEN',
      'VERSION_INVALID',
      'SIGNATURE_REQUIRED',
    ]);
  });

  it('detects broken chain of custody', () => {
    const issues = validateEvidenceChain([
      {
        ...baseEvidence,
        id: 'EV-BROKEN',
        hash: 'sha256:broken-current',
        previousHash: 'sha256:missing-previous',
      },
    ]);

    expect(issues).toContainEqual(expect.objectContaining({
      code: 'CHAIN_BROKEN',
      target: 'EV-BROKEN',
    }));
  });

  it('locks evidence and prevents duplicate append', () => {
    const locked = lockEvidencePack([{ ...baseEvidence, immutable: false }]);
    const appended = appendEvidenceItem(locked, locked[0]);

    expect(locked[0]?.immutable).toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0]?.id).toBe(baseEvidence.id);
  });
});

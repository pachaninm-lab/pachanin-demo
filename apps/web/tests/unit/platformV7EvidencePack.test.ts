import { describe, expect, it } from 'vitest';
import {
  appendEvidenceItem,
  buildEvidencePackReadiness,
  lockEvidencePack,
  validateEvidenceChain,
  validateEvidenceItem,
  type P7EvidenceItem,
} from '@/lib/platform-v7/evidence-pack';
import { buildStableDisputeEvidencePack, STABLE_DK_2024_89_EVIDENCE } from '@/lib/v7r/evidence-pack';

const baseEvidence: P7EvidenceItem = STABLE_DK_2024_89_EVIDENCE[0];

describe('platform-v7 evidence pack', () => {
  it('builds ready evidence pack for DK-2024-89', () => {
    const pack = buildStableDisputeEvidencePack('DK-2024-89');

    expect(pack.dealId).toBe('DL-9102');
    expect(pack.items).toHaveLength(4);
    expect(pack.readiness).toMatchObject({
      status: 'ready_for_review',
      total: 4,
      requiredTotal: 3,
      requiredReady: 3,
      score: 100,
      issues: [],
    });
  });

  it('detects missing required evidence', () => {
    const readiness = buildEvidencePackReadiness(STABLE_DK_2024_89_EVIDENCE.filter((item) => item.type !== 'photo'));

    expect(readiness.status).toBe('incomplete');
    expect(readiness.score).toBe(67);
    expect(readiness.issues).toContainEqual(expect.objectContaining({
      code: 'MISSING_REQUIRED_EVIDENCE',
      target: 'photo',
    }));
  });

  it('validates item integrity fields', () => {
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

  it('locks pack and prevents duplicate append', () => {
    const locked = lockEvidencePack([{ ...baseEvidence, immutable: false }]);
    const appended = appendEvidenceItem(locked, locked[0]);

    expect(locked[0].immutable).toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0].id).toBe(baseEvidence.id);
  });

  it('returns empty incomplete pack for unknown dispute', () => {
    const pack = buildStableDisputeEvidencePack('DK-UNKNOWN');

    expect(pack.dealId).toBeNull();
    expect(pack.items).toEqual([]);
    expect(pack.readiness.status).toBe('incomplete');
    expect(pack.readiness.score).toBe(0);
  });
});

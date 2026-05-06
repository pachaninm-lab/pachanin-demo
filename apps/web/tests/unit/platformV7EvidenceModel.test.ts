import { describe, expect, it } from 'vitest';
import {
  canPlatformV7ResolveFromEvidence,
  getPlatformV7EvidenceMissingCount,
  isPlatformV7EvidencePackComplete,
  isPlatformV7EvidencePackLinked,
  type PlatformV7EvidencePack,
} from '@/lib/platform-v7/evidence-model';

const pack: PlatformV7EvidencePack = {
  id: 'evidence-1',
  dealId: 'deal-1',
  readinessScore: 90,
  requiredEvidenceTypes: ['acceptance_act', 'lab_protocol', 'photo'],
  receivedEvidenceIds: ['ev-1', 'ev-2', 'ev-3'],
  missingEvidenceTypes: [],
  canResolve: true,
};

describe('platform-v7 evidence model', () => {
  it('counts missing evidence explicitly', () => {
    expect(getPlatformV7EvidenceMissingCount(pack)).toBe(0);
    expect(getPlatformV7EvidenceMissingCount({ ...pack, missingEvidenceTypes: ['lab_protocol'] })).toBe(1);
  });

  it('requires all mandatory evidence before marking the pack complete', () => {
    expect(isPlatformV7EvidencePackComplete(pack)).toBe(true);
    expect(isPlatformV7EvidencePackComplete({ ...pack, receivedEvidenceIds: ['ev-1'] })).toBe(false);
    expect(isPlatformV7EvidencePackComplete({ ...pack, missingEvidenceTypes: ['photo'] })).toBe(false);
  });

  it('resolves only from a complete and sufficiently ready evidence pack', () => {
    expect(canPlatformV7ResolveFromEvidence(pack)).toBe(true);
    expect(canPlatformV7ResolveFromEvidence({ ...pack, readinessScore: 70 })).toBe(false);
    expect(canPlatformV7ResolveFromEvidence({ ...pack, canResolve: false })).toBe(false);
    expect(canPlatformV7ResolveFromEvidence({ ...pack, missingEvidenceTypes: ['photo'] })).toBe(false);
  });

  it('keeps evidence linked to a deal', () => {
    expect(isPlatformV7EvidencePackLinked(pack)).toBe(true);
    expect(isPlatformV7EvidencePackLinked({ ...pack, dealId: '' })).toBe(false);
  });
});

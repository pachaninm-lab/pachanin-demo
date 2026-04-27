import { describe, expect, it } from 'vitest';
import { decideReleaseWithEvidencePack } from '@/lib/platform-v7/evidence-release-guard';
import type { P7EvidenceItem } from '@/lib/platform-v7/evidence-pack';

const readyEvidence: P7EvidenceItem[] = [
  {
    id: 'EV-LAB-001',
    dealId: 'DL-9102',
    disputeId: 'DK-2024-89',
    type: 'lab_protocol',
    source: 'lab',
    trust: 'signed',
    title: 'Лабораторный протокол качества',
    hash: 'sha256:lab-protocol-001',
    uploadedAt: '2026-04-26T10:00:00Z',
    actor: 'lab-operator',
    signedBy: 'pilot-signature:lab-operator',
    version: 1,
    immutable: true,
  },
  {
    id: 'EV-TRN-001',
    dealId: 'DL-9102',
    disputeId: 'DK-2024-89',
    type: 'transport_document',
    source: 'sberkorus',
    trust: 'provider_verified',
    title: 'ЭТрН',
    hash: 'sha256:transport-document-001',
    uploadedAt: '2026-04-26T10:05:00Z',
    actor: 'transport-operator',
    version: 1,
    immutable: true,
  },
  {
    id: 'EV-PHOTO-001',
    dealId: 'DL-9102',
    disputeId: 'DK-2024-89',
    type: 'photo',
    source: 'platform',
    trust: 'platform_verified',
    title: 'Фото с гео',
    hash: 'sha256:photo-001',
    uploadedAt: '2026-04-26T10:10:00Z',
    actor: 'surveyor',
    version: 1,
    immutable: true,
  },
];

const releaseInput = {
  dealId: 'DL-9102',
  reservedAmount: 10_000_000,
  holdAmount: 0,
  requestedAmount: 10_000_000,
  docsComplete: true,
  bankCallbackConfirmed: true,
  disputeOpen: false,
  transportGateClear: true,
  fgisGateClear: true,
  releaseRequestId: 'DL-9102-release',
};

describe('platform-v7 evidence release guard bridge', () => {
  it('allows release guard to continue when evidence pack is ready', () => {
    const decision = decideReleaseWithEvidencePack(releaseInput, readyEvidence);

    expect(decision.state).toBe('evidence_ready');
    expect(decision.readiness.score).toBe(100);
    expect(decision.release.state).toBe('releasable');
    expect(decision.release.releasableAmount).toBe(10_000_000);
  });

  it('blocks release through docs precondition when required evidence is missing', () => {
    const decision = decideReleaseWithEvidencePack(releaseInput, readyEvidence.filter((item) => item.type !== 'photo'));

    expect(decision.state).toBe('evidence_incomplete');
    expect(decision.readiness.status).toBe('incomplete');
    expect(decision.release.state).toBe('blocked');
    expect(decision.release.blockers).toContain('DOCS_INCOMPLETE');
  });

  it('keeps original money blockers when evidence is ready', () => {
    const decision = decideReleaseWithEvidencePack({
      ...releaseInput,
      holdAmount: 1000,
      requestedAmount: 9_999_000,
    }, readyEvidence);

    expect(decision.state).toBe('evidence_ready');
    expect(decision.release.state).toBe('blocked');
    expect(decision.release.blockers).toContain('HOLD_ACTIVE');
  });
});

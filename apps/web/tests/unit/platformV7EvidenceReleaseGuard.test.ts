import { describe, expect, it } from 'vitest';
import { decideReleaseWithEvidencePack } from '@/lib/platform-v7/evidence-release-guard';
import { STABLE_DK_2024_89_EVIDENCE } from '@/lib/v7r/evidence-pack';

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
    const decision = decideReleaseWithEvidencePack(releaseInput, STABLE_DK_2024_89_EVIDENCE);

    expect(decision.state).toBe('evidence_ready');
    expect(decision.readiness.score).toBe(100);
    expect(decision.release.state).toBe('releasable');
    expect(decision.release.releasableAmount).toBe(10_000_000);
  });

  it('blocks release through docs precondition when required evidence is missing', () => {
    const incompleteEvidence = STABLE_DK_2024_89_EVIDENCE.filter((item) => item.type !== 'photo');
    const decision = decideReleaseWithEvidencePack(releaseInput, incompleteEvidence);

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
    }, STABLE_DK_2024_89_EVIDENCE);

    expect(decision.state).toBe('evidence_ready');
    expect(decision.release.state).toBe('blocked');
    expect(decision.release.blockers).toContain('HOLD_ACTIVE');
  });
});

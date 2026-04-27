import { decideMoneyRelease, type P7ReleaseDecision, type P7ReleaseGuardInput } from './money-safety';
import { buildEvidencePackReadiness, type P7EvidenceItem, type P7EvidencePackReadiness, type P7EvidencePackRequirement } from './evidence-pack';

export type P7EvidenceReleaseState = 'evidence_ready' | 'evidence_incomplete';

export interface P7EvidenceReleaseDecision {
  readonly state: P7EvidenceReleaseState;
  readonly readiness: P7EvidencePackReadiness;
  readonly release: P7ReleaseDecision;
}

export function decideReleaseWithEvidencePack(
  releaseInput: P7ReleaseGuardInput,
  evidenceItems: readonly P7EvidenceItem[],
  requirements?: readonly P7EvidencePackRequirement[],
): P7EvidenceReleaseDecision {
  const readiness = buildEvidencePackReadiness(evidenceItems, requirements);
  const ready = readiness.status === 'ready_for_review';

  return {
    state: ready ? 'evidence_ready' : 'evidence_incomplete',
    readiness,
    release: decideMoneyRelease({
      ...releaseInput,
      docsComplete: releaseInput.docsComplete && ready,
    }),
  };
}

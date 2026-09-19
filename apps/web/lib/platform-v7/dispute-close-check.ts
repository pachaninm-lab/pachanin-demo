import type { PlatformV7DisputeEvidencePackModel } from './dispute-evidence-pack';

export type PlatformV7DisputeCloseBlocker =
  | 'EVIDENCE_PACK_NOT_READY'
  | 'MISSING_DECISION'
  | 'MISSING_REASON'
  | 'MONEY_EFFECT_NOT_SET'
  | 'NEGATIVE_MONEY_EFFECT';

export interface PlatformV7DisputeCloseInput {
  evidencePack: Pick<PlatformV7DisputeEvidencePackModel, 'canSubmit' | 'status' | 'blockers'>;
  decision: string;
  reason: string;
  moneyEffectRub: number | null;
}

export interface PlatformV7DisputeCloseCheck {
  canClose: boolean;
  blockers: readonly PlatformV7DisputeCloseBlocker[];
  evidenceStatus: PlatformV7DisputeEvidencePackModel['status'];
  moneyEffectRub: number | null;
}

export function platformV7DisputeCloseCheck(input: PlatformV7DisputeCloseInput): PlatformV7DisputeCloseCheck {
  const blockers: PlatformV7DisputeCloseBlocker[] = [];

  if (!input.evidencePack.canSubmit || input.evidencePack.status !== 'complete' || input.evidencePack.blockers.length > 0) {
    blockers.push('EVIDENCE_PACK_NOT_READY');
  }

  if (!input.decision.trim()) blockers.push('MISSING_DECISION');
  if (!input.reason.trim()) blockers.push('MISSING_REASON');
  if (input.moneyEffectRub === null || !Number.isFinite(input.moneyEffectRub)) blockers.push('MONEY_EFFECT_NOT_SET');
  if (typeof input.moneyEffectRub === 'number' && input.moneyEffectRub < 0) blockers.push('NEGATIVE_MONEY_EFFECT');

  return {
    canClose: blockers.length === 0,
    blockers,
    evidenceStatus: input.evidencePack.status,
    moneyEffectRub: input.moneyEffectRub,
  };
}

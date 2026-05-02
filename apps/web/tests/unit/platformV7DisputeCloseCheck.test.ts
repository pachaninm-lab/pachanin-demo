import { describe, expect, it } from 'vitest';
import { platformV7DisputeCloseCheck } from '@/lib/platform-v7/dispute-close-check';

const completePack = { canSubmit: true, status: 'complete' as const, blockers: [] };
const incompletePack = { canSubmit: false, status: 'incomplete' as const, blockers: ['missing-class:lab_protocol'] };

describe('platform-v7 dispute close check', () => {
  it('allows closing only with complete evidence, decision, reason, and money effect', () => {
    const result = platformV7DisputeCloseCheck({
      evidencePack: completePack,
      decision: 'Удержать часть суммы по лабораторному отклонению',
      reason: 'Протокол лаборатории и весовая квитанция подтверждают отклонение',
      moneyEffectRub: 120000,
    });

    expect(result.canClose).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks closing when evidence pack is not ready', () => {
    const result = platformV7DisputeCloseCheck({
      evidencePack: incompletePack,
      decision: 'Решение есть',
      reason: 'Причина есть',
      moneyEffectRub: 1000,
    });

    expect(result.canClose).toBe(false);
    expect(result.blockers).toContain('EVIDENCE_PACK_NOT_READY');
  });

  it('blocks closing without decision and reason', () => {
    const result = platformV7DisputeCloseCheck({
      evidencePack: completePack,
      decision: ' ',
      reason: '',
      moneyEffectRub: 1000,
    });

    expect(result.canClose).toBe(false);
    expect(result.blockers).toContain('MISSING_DECISION');
    expect(result.blockers).toContain('MISSING_REASON');
  });

  it('blocks closing without valid money effect', () => {
    const missing = platformV7DisputeCloseCheck({
      evidencePack: completePack,
      decision: 'Решение',
      reason: 'Причина',
      moneyEffectRub: null,
    });

    const negative = platformV7DisputeCloseCheck({
      evidencePack: completePack,
      decision: 'Решение',
      reason: 'Причина',
      moneyEffectRub: -1,
    });

    expect(missing.blockers).toContain('MONEY_EFFECT_NOT_SET');
    expect(negative.blockers).toContain('NEGATIVE_MONEY_EFFECT');
  });
});

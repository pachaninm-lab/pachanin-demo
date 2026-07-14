import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOUR_STATE,
  TOUR_ENTRY_VARIANTS,
  TOUR_LENSES,
  TOUR_PERSPECTIVES,
  TOUR_SCENARIOS,
  TOUR_STAGES,
  normalizeTourEntryVariant,
  normalizeTourState,
  normalizeTourStateFromSearchParams,
  reduceTourState,
  writeTourStateToSearchParams,
} from '@/lib/platform-v7/public-product-experience-state';

describe('public product experience state machine', () => {
  it('keeps the architecture cardinalities explicit', () => {
    expect(TOUR_ENTRY_VARIANTS).toEqual(['role', 'problem', 'deal']);
    expect(TOUR_LENSES).toHaveLength(6);
    expect(TOUR_PERSPECTIVES).toHaveLength(12);
    expect(TOUR_SCENARIOS).toHaveLength(3);
    expect(TOUR_STAGES).toHaveLength(10);
  });

  it('normalizes usability entry variants without introducing an auth role', () => {
    expect(normalizeTourEntryVariant('role')).toBe('role');
    expect(normalizeTourEntryVariant(['problem', 'deal'])).toBe('problem');
    expect(normalizeTourEntryVariant('deal')).toBe('deal');
    expect(normalizeTourEntryVariant('admin')).toBe('deal');
    expect(normalizeTourEntryVariant(undefined)).toBe('deal');
  });

  it('normalizes deep links and rejects unknown values', () => {
    expect(normalizeTourState({
      lens: 'money',
      stage: 'settlement',
      scenario: 'partial',
      perspective: 'bank',
      risk: 'paymentBasis',
      ai: '1',
    })).toEqual({
      lens: 'money',
      stage: 'settlement',
      scenario: 'partial',
      perspective: 'bank',
      risk: 'paymentBasis',
      aiEnabled: true,
    });

    expect(normalizeTourState({
      lens: 'admin',
      stage: 'live-bank-callback',
      scenario: 'random',
      perspective: 'superuser',
      risk: 'none',
      ai: 'yes',
    })).toEqual(DEFAULT_TOUR_STATE);
  });

  it('keeps transitions idempotent and bounded', () => {
    const sameLens = reduceTourState(DEFAULT_TOUR_STATE, { type: 'select-lens', lens: DEFAULT_TOUR_STATE.lens });
    expect(sameLens).toBe(DEFAULT_TOUR_STATE);

    let first = { ...DEFAULT_TOUR_STATE, stage: TOUR_STAGES[0] };
    first = reduceTourState(first, { type: 'previous-stage' });
    expect(first.stage).toBe('terms');

    let last = { ...DEFAULT_TOUR_STATE, stage: TOUR_STAGES[TOUR_STAGES.length - 1] };
    last = reduceTourState(last, { type: 'next-stage' });
    expect(last.stage).toBe('closure');
  });

  it('round-trips serializable state without creating an authorization role', () => {
    const state = {
      lens: 'risk' as const,
      stage: 'laboratory' as const,
      scenario: 'dispute' as const,
      perspective: 'arbitrator' as const,
      risk: 'qualityDeviation' as const,
      aiEnabled: true,
    };
    const params = writeTourStateToSearchParams(state);
    expect(params.has('role')).toBe(false);
    expect(params.has('membership')).toBe(false);
    expect(params.has('token')).toBe(false);
    expect(params.has('permission')).toBe(false);
    expect(normalizeTourStateFromSearchParams(params)).toEqual(state);
  });

  it('preserves unrelated campaign parameters while updating the public view', () => {
    const current = new URLSearchParams('source=partner&campaign=july&entry=role');
    const params = writeTourStateToSearchParams(DEFAULT_TOUR_STATE, current);
    expect(params.get('source')).toBe('partner');
    expect(params.get('campaign')).toBe('july');
    expect(params.get('entry')).toBe('role');
    expect(params.get('perspective')).toBe('seller');
  });
});

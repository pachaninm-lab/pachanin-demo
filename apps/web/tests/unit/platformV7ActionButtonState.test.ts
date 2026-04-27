import { describe, expect, it } from 'vitest';
import { resolvePlatformV7ActionButtonState, platformV7ActionButtonTestId } from '@/lib/platform-v7/action-button-state';
import { platformV7ActionTargetById } from '@/lib/platform-v7/action-targets';

describe('platform-v7 action button state', () => {
  it('returns idle state for inactive action', () => {
    const target = platformV7ActionTargetById('deal-release-funds');
    expect(target).not.toBeNull();
    const state = resolvePlatformV7ActionButtonState({ target: target!, activeActionId: null });

    expect(state).toEqual({
      label: 'Выпустить деньги',
      disabled: false,
      ariaBusy: false,
      tone: 'secondary',
      blocked: false,
      blockerLabels: [],
      blockedReason: null,
    });
    expect(platformV7ActionButtonTestId(target!)).toBe('action-deal-release-funds');
  });

  it('returns loading state for active action and ignores blocked state while busy', () => {
    const target = platformV7ActionTargetById('deal-release-funds');
    const state = resolvePlatformV7ActionButtonState({
      target: target!,
      activeActionId: 'releaseFunds',
      blocked: true,
      blockerLabels: ['MoneyGate'],
    });

    expect(state).toMatchObject({
      label: 'Выполняется…',
      disabled: true,
      ariaBusy: true,
      blocked: false,
      blockerLabels: [],
    });
  });

  it('keeps dangerous dispute action tone by default', () => {
    const target = platformV7ActionTargetById('deal-open-dispute');
    const state = resolvePlatformV7ActionButtonState({ target: target!, activeActionId: null });

    expect(state.tone).toBe('danger');
  });

  it('returns blocked state when release gates are not passed', () => {
    const target = platformV7ActionTargetById('deal-release-funds');
    const state = resolvePlatformV7ActionButtonState({
      target: target!,
      activeActionId: null,
      blocked: true,
      blockedLabel: 'Выпуск заблокирован',
      blockerLabels: ['FGISGate', 'EvidenceGate'],
      blockedReason: 'Не все gates закрыты.',
    });

    expect(state).toEqual({
      label: 'Выпуск заблокирован',
      disabled: true,
      ariaBusy: false,
      tone: 'danger',
      blocked: true,
      blockerLabels: ['FGISGate', 'EvidenceGate'],
      blockedReason: 'Не все gates закрыты.',
    });
  });
});

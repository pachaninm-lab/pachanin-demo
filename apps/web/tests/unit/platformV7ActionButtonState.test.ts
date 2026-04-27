import { describe, expect, it } from 'vitest';
import {
  platformV7ActionButtonTestId,
  platformV7ActionButtonUiProps,
  resolvePlatformV7ActionButtonState,
} from '@/lib/platform-v7/action-button-state';
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
    expect(platformV7ActionButtonUiProps(state)).toMatchObject({
      state: 'loading',
      loadingLabel: 'Выполняется…',
      'data-guard-state': 'busy',
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
    expect(platformV7ActionButtonUiProps(state)).toMatchObject({
      disabled: true,
      variant: 'danger',
      state: 'idle',
      disabledReason: 'Не все gates закрыты.',
      'data-guard-state': 'blocked',
    });
  });

  it('builds fallback reason from blocker labels', () => {
    const target = platformV7ActionTargetById('deal-release-funds');
    const state = resolvePlatformV7ActionButtonState({
      target: target!,
      activeActionId: null,
      blocked: true,
      blockerLabels: ['MoneyGate', 'DocumentGate'],
    });

    expect(platformV7ActionButtonUiProps(state).disabledReason).toBe('Не закрыты: MoneyGate, DocumentGate');
  });
});

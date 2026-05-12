import { describe, expect, it } from 'vitest';
import {
  platformV7ActionButtonUiProps,
  resolvePlatformV7ActionButtonState,
} from '@/lib/platform-v7/action-button-state';
import type { PlatformV7ActionTarget } from '@/lib/platform-v7/action-targets';

const target: PlatformV7ActionTarget = {
  id: 'request-bank-review',
  label: 'Запросить банковскую проверку',
  actionId: 'requestRelease',
};

describe('platform-v7 action button state boundary', () => {
  it('explains blocked actions as deal-condition blockers', () => {
    const state = resolvePlatformV7ActionButtonState({
      target,
      activeActionId: null,
      blocked: true,
      blockerLabels: ['документы', 'ФГИС/СДИЗ', 'приёмка'],
    });

    const uiProps = platformV7ActionButtonUiProps(state);

    expect(uiProps.disabled).toBe(true);
    expect(uiProps['data-guard-state']).toBe('blocked');
    expect(uiProps.disabledReason).toBe('Действие недоступно: сначала закрой условия сделки — документы, ФГИС/СДИЗ, приёмка.');
    expect(uiProps.disabledReason).not.toMatch(/Не закрыты:/i);
    expect(uiProps.disabledReason).not.toMatch(/guard|runtime|callback|live/i);
  });

  it('uses a safe fallback when no blocker labels are provided', () => {
    const state = resolvePlatformV7ActionButtonState({
      target,
      activeActionId: null,
      blocked: true,
    });

    const uiProps = platformV7ActionButtonUiProps(state);

    expect(uiProps.disabledReason).toBe('Действие недоступно: сначала нужно закрыть условия сделки.');
  });

  it('keeps busy state separate from blocked reason', () => {
    const state = resolvePlatformV7ActionButtonState({
      target,
      activeActionId: 'requestRelease',
      blocked: true,
      blockerLabels: ['документы'],
      loadingLabel: 'Проверяем условия…',
    });

    const uiProps = platformV7ActionButtonUiProps(state);

    expect(uiProps.disabled).toBe(true);
    expect(uiProps.state).toBe('loading');
    expect(uiProps.loadingLabel).toBe('Проверяем условия…');
    expect(uiProps.disabledReason).toBeUndefined();
    expect(uiProps['data-guard-state']).toBe('busy');
  });
});

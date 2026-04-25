import { platformV7ActionIsBusy } from './action-control';
import type { PlatformV7ActionTarget } from './action-targets';

export type PlatformV7ActionButtonTone = 'primary' | 'secondary' | 'danger';

export interface PlatformV7ActionButtonState {
  label: string;
  disabled: boolean;
  ariaBusy: boolean;
  tone: PlatformV7ActionButtonTone;
}

export interface ResolvePlatformV7ActionButtonStateInput {
  target: PlatformV7ActionTarget;
  activeActionId: string | null;
  disabled?: boolean;
  tone?: PlatformV7ActionButtonTone;
  loadingLabel?: string;
}

export function resolvePlatformV7ActionButtonState(
  input: ResolvePlatformV7ActionButtonStateInput,
): PlatformV7ActionButtonState {
  const busy = platformV7ActionIsBusy(input.activeActionId, input.target.actionId);

  return {
    label: busy ? input.loadingLabel ?? 'Выполняется…' : input.target.label,
    disabled: Boolean(input.disabled) || busy,
    ariaBusy: busy,
    tone: input.tone ?? (input.target.actionId === 'openDispute' || input.target.actionId === 'resolveDispute' ? 'danger' : 'secondary'),
  };
}

export function platformV7ActionButtonTestId(target: PlatformV7ActionTarget): string {
  return `action-${target.id}`;
}

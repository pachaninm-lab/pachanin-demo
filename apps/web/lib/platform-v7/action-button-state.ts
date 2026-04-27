import { platformV7ActionIsBusy } from './action-control';
import type { PlatformV7ActionTarget } from './action-targets';

export type PlatformV7ActionButtonTone = 'primary' | 'secondary' | 'danger';

export interface PlatformV7ActionButtonState {
  label: string;
  disabled: boolean;
  ariaBusy: boolean;
  tone: PlatformV7ActionButtonTone;
  blocked: boolean;
  blockerLabels: string[];
  blockedReason: string | null;
}

export interface ResolvePlatformV7ActionButtonStateInput {
  target: PlatformV7ActionTarget;
  activeActionId: string | null;
  disabled?: boolean;
  tone?: PlatformV7ActionButtonTone;
  loadingLabel?: string;
  blocked?: boolean;
  blockerLabels?: string[];
  blockedLabel?: string;
  blockedReason?: string;
}

export function resolvePlatformV7ActionButtonState(
  input: ResolvePlatformV7ActionButtonStateInput,
): PlatformV7ActionButtonState {
  const busy = platformV7ActionIsBusy(input.activeActionId, input.target.actionId);
  const blocked = Boolean(input.blocked) && !busy;

  return {
    label: busy ? input.loadingLabel ?? 'Выполняется…' : blocked ? input.blockedLabel ?? input.target.label : input.target.label,
    disabled: Boolean(input.disabled) || busy || blocked,
    ariaBusy: busy,
    tone: input.tone ?? (blocked || input.target.actionId === 'openDispute' || input.target.actionId === 'resolveDispute' ? 'danger' : 'secondary'),
    blocked,
    blockerLabels: blocked ? input.blockerLabels ?? [] : [],
    blockedReason: blocked ? input.blockedReason ?? null : null,
  };
}

export function platformV7ActionButtonTestId(target: PlatformV7ActionTarget): string {
  return `action-${target.id}`;
}

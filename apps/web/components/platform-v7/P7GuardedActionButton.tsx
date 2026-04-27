'use client';

import type { ButtonHTMLAttributes } from 'react';
import { P7ActionButton } from './P7ActionButton';
import {
  platformV7ActionButtonUiProps,
  resolvePlatformV7ActionButtonState,
  type PlatformV7ActionButtonTone,
} from '@/lib/platform-v7/action-button-state';
import type { PlatformV7ActionTarget } from '@/lib/platform-v7/action-targets';

export interface P7GuardedActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly target: PlatformV7ActionTarget;
  readonly activeActionId: string | null;
  readonly disabled?: boolean;
  readonly tone?: PlatformV7ActionButtonTone;
  readonly loadingLabel?: string;
  readonly blocked?: boolean;
  readonly blockerLabels?: string[];
  readonly blockedLabel?: string;
  readonly blockedReason?: string;
}

export function P7GuardedActionButton(props: P7GuardedActionButtonProps) {
  const {
    target,
    activeActionId,
    disabled,
    tone,
    loadingLabel,
    blocked,
    blockerLabels,
    blockedLabel,
    blockedReason,
    ...buttonProps
  } = props;
  const resolved = resolvePlatformV7ActionButtonState({
    target,
    activeActionId,
    disabled,
    tone,
    loadingLabel,
    blocked,
    blockerLabels,
    blockedLabel,
    blockedReason,
  });
  const uiProps = platformV7ActionButtonUiProps(resolved);

  return (
    <P7ActionButton
      {...buttonProps}
      disabled={uiProps.disabled}
      variant={uiProps.variant}
      state={uiProps.state}
      loadingLabel={uiProps.loadingLabel}
      disabledReason={uiProps.disabledReason}
      aria-busy={uiProps['aria-busy']}
      data-guard-state={uiProps['data-guard-state']}
    >
      {resolved.label}
    </P7ActionButton>
  );
}

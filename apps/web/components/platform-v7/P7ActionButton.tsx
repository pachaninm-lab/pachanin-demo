'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { PLATFORM_V7_TOKENS, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

export type P7ActionButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type P7ActionButtonState = 'idle' | 'loading' | 'success' | 'error';

export interface P7ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly children: ReactNode;
  readonly variant?: P7ActionButtonVariant;
  readonly state?: P7ActionButtonState;
  readonly loadingLabel?: ReactNode;
  readonly successLabel?: ReactNode;
  readonly errorLabel?: ReactNode;
  readonly disabledReason?: string;
}

function stateTone(state: P7ActionButtonState): PlatformV7Tone | null {
  if (state === 'success') return 'success';
  if (state === 'error') return 'danger';
  return null;
}

function resolveLabel(props: P7ActionButtonProps): ReactNode {
  if (props.state === 'loading' && props.loadingLabel) return props.loadingLabel;
  if (props.state === 'success' && props.successLabel) return props.successLabel;
  if (props.state === 'error' && props.errorLabel) return props.errorLabel;
  return props.children;
}

function resolveStyle(variant: P7ActionButtonVariant, state: P7ActionButtonState, disabled?: boolean) {
  const statusTone = stateTone(state);

  if (statusTone === 'success') {
    return {
      background: PLATFORM_V7_TOKENS.color.success,
      border: PLATFORM_V7_TOKENS.color.success,
      color: PLATFORM_V7_TOKENS.color.surface,
    };
  }

  if (statusTone === 'danger') {
    return {
      background: PLATFORM_V7_TOKENS.color.danger,
      border: PLATFORM_V7_TOKENS.color.danger,
      color: PLATFORM_V7_TOKENS.color.surface,
    };
  }

  if (variant === 'danger') {
    return {
      background: PLATFORM_V7_TOKENS.color.dangerSoft,
      border: '#FECDCA',
      color: PLATFORM_V7_TOKENS.color.danger,
    };
  }

  if (variant === 'secondary') {
    return {
      background: PLATFORM_V7_TOKENS.color.surface,
      border: PLATFORM_V7_TOKENS.color.borderStrong,
      color: PLATFORM_V7_TOKENS.color.text,
    };
  }

  if (variant === 'ghost') {
    return {
      background: 'transparent',
      border: 'transparent',
      color: PLATFORM_V7_TOKENS.color.textMuted,
    };
  }

  return {
    background: disabled ? PLATFORM_V7_TOKENS.color.surfaceStrong : PLATFORM_V7_TOKENS.color.brand,
    border: disabled ? PLATFORM_V7_TOKENS.color.borderStrong : PLATFORM_V7_TOKENS.color.brand,
    color: disabled ? PLATFORM_V7_TOKENS.color.textMuted : PLATFORM_V7_TOKENS.color.surface,
  };
}

export function P7ActionButton(props: P7ActionButtonProps) {
  const {
    children,
    variant = 'primary',
    state = 'idle',
    loadingLabel,
    successLabel,
    errorLabel,
    disabled,
    disabledReason,
    style,
    title,
    type = 'button',
    ...buttonProps
  } = props;
  const isLoading = state === 'loading';
  const isDisabled = Boolean(disabled) || isLoading;
  const colors = resolveStyle(variant, state, isDisabled);
  const label = resolveLabel({ children, variant, state, loadingLabel, successLabel, errorLabel, disabledReason });
  const resolvedTitle = title ?? (isDisabled && !isLoading ? disabledReason : undefined);

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      title={resolvedTitle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: PLATFORM_V7_TOKENS.spacing.xs,
        minHeight: 40,
        borderRadius: PLATFORM_V7_TOKENS.radius.md,
        border: `1px solid ${colors.border}`,
        background: colors.background,
        color: colors.color,
        padding: '10px 12px',
        fontFamily: PLATFORM_V7_TOKENS.typography.fontSans,
        fontSize: PLATFORM_V7_TOKENS.typography.caption.size + 1,
        fontWeight: 800,
        cursor: isLoading ? 'wait' : isDisabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !isLoading ? 0.7 : 1,
        transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
        ...style,
      }}
    >
      {isLoading ? <span aria-hidden='true'>…</span> : null}
      {label}
    </button>
  );
}

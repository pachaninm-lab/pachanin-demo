'use client';

import * as React from 'react';

/**
 * MagneticActionDock — один главный action всегда рядом.
 *
 * Desktop: right sticky dock
 * Mobile: bottom action dock (fixed, с учётом safe-area-inset-bottom)
 *
 * Правило: на экране максимум ОДИН primary CTA.
 * Если action не задан — компонент не рендерится.
 *
 * Использование:
 *   <MagneticActionDock
 *     action={{
 *       label: 'Закрыть СДИЗ',
 *       onClick: () => handleCloseSdiz(),
 *       tone: 'primary',
 *     }}
 *     position="bottom"   // для mobile
 *   />
 */

export type MagneticActionTone = 'primary' | 'danger' | 'warning' | 'neutral';
export type MagneticActionDockPosition = 'right' | 'bottom';

export interface MagneticAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly tone?: MagneticActionTone;
  /** Описание что изменится — показывается под кнопкой */
  readonly consequence?: string;
  /** Причина почему действие недоступно */
  readonly disabledReason?: string;
  readonly disabled?: boolean;
  readonly loading?: boolean;
}

export interface MagneticActionDockProps {
  readonly action: MagneticAction | null;
  readonly position?: MagneticActionDockPosition;
  readonly 'data-testid'?: string;
}

const TONE_STYLES: Record<MagneticActionTone, { bg: string; color: string; border: string; hoverBg: string }> = {
  primary: {
    bg: 'var(--p7-color-brand, #0A7A5F)',
    color: '#FFFFFF',
    border: 'var(--p7-color-brand, #0A7A5F)',
    hoverBg: 'var(--p7-color-brand-hover, #086850)',
  },
  danger: {
    bg: 'var(--p7-color-danger, #B42318)',
    color: '#FFFFFF',
    border: 'var(--p7-color-danger, #B42318)',
    hoverBg: '#991b15',
  },
  warning: {
    bg: 'var(--p7-color-warning, #B54708)',
    color: '#FFFFFF',
    border: 'var(--p7-color-warning, #B54708)',
    hoverBg: '#944005',
  },
  neutral: {
    bg: 'var(--pc-bg-card, #FFFFFF)',
    color: 'var(--p7-color-text-primary, #0F1419)',
    border: 'var(--pc-border, #D7DEE3)',
    hoverBg: 'var(--pc-bg-elevated, #F7F9F5)',
  },
};

export function MagneticActionDock({
  action,
  position = 'bottom',
  'data-testid': testId,
}: MagneticActionDockProps) {
  const [hovered, setHovered] = React.useState(false);

  if (!action) return null;

  const tone = action.tone ?? 'primary';
  const style = TONE_STYLES[tone];
  const isDisabled = action.disabled || action.loading;

  const dockStyle: React.CSSProperties =
    position === 'bottom'
      ? {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 90,
          padding: 'calc(10px + env(safe-area-inset-bottom, 0px)) 16px 12px',
          background: 'color-mix(in srgb, var(--pc-bg-card, #FFFFFF) 96%, transparent)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--pc-border, #D7DEE3)',
          boxShadow: '0 -4px 20px rgba(15,20,25,0.06)',
        }
      : {
          position: 'sticky',
          top: 130,
          alignSelf: 'flex-start',
          zIndex: 20,
          padding: 0,
        };

  return (
    <div
      data-testid={testId ?? 'p7-vil-magnetic-action-dock'}
      data-position={position}
      style={dockStyle}
    >
      <div style={position === 'bottom' ? { maxWidth: 500, margin: '0 auto' } : {}}>
        <button
          type='button'
          onClick={isDisabled ? undefined : action.onClick}
          disabled={isDisabled}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          aria-disabled={isDisabled ? 'true' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 48,
            padding: '12px 20px',
            borderRadius: position === 'bottom' ? 14 : 12,
            border: `1.5px solid ${style.border}`,
            background: isDisabled
              ? 'var(--p7-color-surface-muted, #F2F6F0)'
              : hovered
              ? style.hoverBg
              : style.bg,
            color: isDisabled ? 'var(--p7-color-text-muted, #667085)' : style.color,
            fontSize: 14,
            fontWeight: 900,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.7 : 1,
            transition: 'background 0.12s, opacity 0.12s',
            boxShadow: !isDisabled && !hovered
              ? '0 2px 8px rgba(10,122,95,0.18)'
              : 'none',
          }}
        >
          {action.loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LoadingSpinner />
              {action.label}
            </span>
          ) : (
            action.label
          )}
        </button>

        {/* Consequence hint */}
        {action.consequence && !isDisabled && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 11,
              color: 'var(--p7-color-text-muted, #667085)',
              lineHeight: 1.4,
              textAlign: 'center',
            }}
          >
            {action.consequence}
          </p>
        )}

        {/* Disabled reason */}
        {action.disabledReason && isDisabled && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 11,
              color: 'var(--p7-color-danger, #B42318)',
              lineHeight: 1.4,
              textAlign: 'center',
            }}
          >
            {action.disabledReason}
          </p>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width='16'
      height='16'
      viewBox='0 0 16 16'
      fill='none'
      style={{ animation: 'p7-spin 0.7s linear infinite' }}
    >
      <circle cx='8' cy='8' r='6' stroke='currentColor' strokeWidth='2' strokeOpacity='0.25' />
      <path d='M14 8a6 6 0 0 0-6-6' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
      <style>{`@keyframes p7-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

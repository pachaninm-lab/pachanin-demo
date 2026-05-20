'use client';

import * as React from 'react';
import { CheckCircle2, ArrowRight, BookOpen, X } from 'lucide-react';

/**
 * AfterActionReceipt — «квитанция» после совершённого действия.
 *
 * Не обычный toast. Мягкое появление, автосворачивание через 8 секунд,
 * ссылка "открыть журнал".
 *
 * Использование:
 *   <AfterActionReceipt
 *     visible={receiptVisible}
 *     onClose={() => setReceiptVisible(false)}
 *     title="Основание передано банку."
 *     notes={["Журнал обновлён."]}
 *     nextAction="Дождаться подтверждения банка."
 *     journalHref="/platform-v7/deals/DL-9103/audit"
 *   />
 */

export interface AfterActionReceiptProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly notes?: string[];
  readonly nextAction?: string;
  readonly journalHref?: string;
  readonly tone?: 'ok' | 'warn' | 'neutral';
  readonly position?: 'top-right' | 'bottom-right' | 'bottom-center';
  readonly autoCloseMs?: number;
  readonly 'data-testid'?: string;
}

const TONE_COLORS = {
  ok:      { Icon: CheckCircle2, color: 'var(--p7-color-success, #027A48)',  bg: 'var(--p7-color-success-soft, #ECFDF3)',  border: 'color-mix(in srgb, var(--p7-color-success, #027A48) 28%, transparent)' },
  warn:    { Icon: CheckCircle2, color: 'var(--p7-color-warning, #B54708)',  bg: 'var(--p7-color-warning-soft, #FFFAEB)',  border: 'color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)' },
  neutral: { Icon: CheckCircle2, color: 'var(--p7-color-brand, #0A7A5F)',   bg: 'var(--p7-color-brand-soft, #E5F4EF)',   border: 'color-mix(in srgb, var(--p7-color-brand, #0A7A5F) 28%, transparent)' },
};

const POSITION_STYLES: Record<NonNullable<AfterActionReceiptProps['position']>, React.CSSProperties> = {
  'top-right':     { top: 80, right: 20 },
  'bottom-right':  { bottom: 20, right: 20 },
  'bottom-center': { bottom: 20, left: '50%', transform: 'translateX(-50%)' },
};

export function AfterActionReceipt({
  visible,
  onClose,
  title,
  notes = [],
  nextAction,
  journalHref,
  tone = 'ok',
  position = 'bottom-right',
  autoCloseMs = 8000,
  'data-testid': testId,
}: AfterActionReceiptProps) {
  const [animate, setAnimate] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      const rafId = requestAnimationFrame(() => setAnimate(true));
      const timerId = setTimeout(() => {
        setAnimate(false);
        setTimeout(onClose, 300);
      }, autoCloseMs);
      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timerId);
      };
    } else {
      setAnimate(false);
    }
  }, [visible, autoCloseMs, onClose]);

  if (!visible) return null;

  const cfg = TONE_COLORS[tone];
  const Icon = cfg.Icon;
  const positionStyle = POSITION_STYLES[position];

  return (
    <div
      role='status'
      aria-live='polite'
      data-testid={testId ?? 'p7-vil-after-action-receipt'}
      style={{
        position: 'fixed',
        zIndex: 160,
        width: 320,
        maxWidth: 'calc(100vw - 32px)',
        ...positionStyle,
        padding: '14px 16px',
        borderRadius: 16,
        border: `1px solid ${cfg.border}`,
        background: 'var(--pc-bg-card, #FFFFFF)',
        boxShadow: '0 8px 32px rgba(15,20,25,0.12)',
        display: 'grid',
        gap: 10,
        opacity: animate ? 1 : 0,
        transform: animate
          ? 'translateY(0)'
          : position === 'top-right'
          ? 'translateY(-10px)'
          : 'translateY(10px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Icon
          size={18}
          strokeWidth={2}
          style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }}
        />
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 850,
            color: 'var(--p7-color-text-primary, #0F1419)',
            lineHeight: 1.4,
          }}
        >
          {title}
        </span>
        <button
          type='button'
          onClick={() => { setAnimate(false); setTimeout(onClose, 200); }}
          aria-label='Закрыть'
          style={{
            flexShrink: 0,
            width: 24,
            height: 24,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--p7-color-text-muted)',
          }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div style={{ display: 'grid', gap: 3 }}>
          {notes.map((note, index) => (
            <span key={index} style={{ fontSize: 12, color: 'var(--p7-color-text-secondary, #475569)', lineHeight: 1.4 }}>
              {note}
            </span>
          ))}
        </div>
      )}

      {/* Next action */}
      {nextAction && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 8,
            background: 'var(--p7-color-surface-muted, #F2F6F0)',
          }}
        >
          <ArrowRight size={13} strokeWidth={2} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, fontWeight: 650, color: cfg.color, lineHeight: 1.4 }}>
            {nextAction}
          </span>
        </div>
      )}

      {/* Journal link */}
      {journalHref && (
        <a
          href={journalHref}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            fontWeight: 750,
            color: 'var(--p7-color-brand, #0A7A5F)',
            textDecoration: 'none',
          }}
        >
          <BookOpen size={12} strokeWidth={2} />
          Открыть журнал
        </a>
      )}
    </div>
  );
}

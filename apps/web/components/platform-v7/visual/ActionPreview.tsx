'use client';

import * as React from 'react';
import { X, ArrowRight, AlertCircle } from 'lucide-react';

/**
 * ActionPreview — показывает последствия до совершения важного действия.
 *
 * Desktop: side panel
 * Mobile: bottom sheet (через modal overlay)
 *
 * Использование:
 *   <ActionPreview
 *     open={previewOpen}
 *     onClose={() => setPreviewOpen(false)}
 *     onConfirm={handleConfirm}
 *     title="Вы передаёте основание банку."
 *     changes={[
 *       { area: 'документы', before: 'в работе', after: 'переданы' },
 *       { area: 'деньги', before: 'заблокированы', after: 'ручная проверка банка' },
 *       { area: 'журнал', after: 'будет создана запись' },
 *     ]}
 *   />
 */

export interface ActionPreviewChange {
  readonly area: string;
  readonly before?: string;
  readonly after: string;
  readonly tone?: 'ok' | 'warn' | 'neutral' | 'money';
}

export interface ActionPreviewProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
  readonly changes?: ActionPreviewChange[];
  readonly warning?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly loading?: boolean;
  readonly mobile?: boolean;
  readonly 'data-testid'?: string;
}

const TONE_COLORS = {
  ok:      { color: 'var(--p7-color-success, #027A48)',  bg: 'var(--p7-color-success-soft, #ECFDF3)' },
  warn:    { color: 'var(--p7-color-warning, #B54708)',  bg: 'var(--p7-color-warning-soft, #FFFAEB)' },
  neutral: { color: 'var(--p7-color-text-secondary, #475569)', bg: 'transparent' },
  money:   { color: 'var(--p7-color-money, #155EEF)',    bg: 'var(--p7-color-money-soft, #EFF4FF)' },
};

function ChangeRow({ change }: { change: ActionPreviewChange }) {
  const tone = change.tone ?? 'neutral';
  const c = TONE_COLORS[tone];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        borderBottom: '1px solid var(--p7-color-border, #D7DEE3)',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: 'var(--p7-color-text-muted, #667085)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          minWidth: 100,
          flexShrink: 0,
        }}
      >
        {change.area}
      </span>

      {change.before && (
        <>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--p7-color-text-muted, #667085)',
              textDecoration: 'line-through',
              opacity: 0.7,
            }}
          >
            {change.before}
          </span>
          <ArrowRight size={12} style={{ color: 'var(--p7-color-text-muted)', flexShrink: 0 }} />
        </>
      )}

      <span
        style={{
          fontSize: 12,
          fontWeight: 750,
          padding: '2px 7px',
          borderRadius: 6,
          background: c.bg,
          color: c.color,
        }}
      >
        {change.after}
      </span>
    </div>
  );
}

export function ActionPreview({
  open,
  onClose,
  onConfirm,
  title,
  changes = [],
  warning,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  loading = false,
  mobile = false,
  'data-testid': testId,
}: ActionPreviewProps) {
  if (!open) return null;

  const panelStyle: React.CSSProperties = mobile
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderRadius: '20px 20px 0 0',
        maxHeight: '80vh',
        overflowY: 'auto',
        zIndex: 150,
        background: 'var(--pc-bg-card, #FFFFFF)',
        border: '1px solid var(--pc-border, #D7DEE3)',
        borderBottom: 'none',
        boxShadow: '0 -8px 32px rgba(15,20,25,0.12)',
        padding: 'calc(16px + env(safe-area-inset-bottom, 0px)) 16px 20px',
      }
    : {
        position: 'fixed',
        right: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 340,
        maxHeight: '70vh',
        overflowY: 'auto',
        zIndex: 150,
        background: 'var(--pc-bg-card, #FFFFFF)',
        border: '1px solid var(--pc-border, #D7DEE3)',
        borderRadius: 18,
        boxShadow: '0 16px 48px rgba(15,20,25,0.14)',
        padding: 20,
      };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,20,25,0.3)',
          zIndex: 140,
          backdropFilter: 'blur(2px)',
        }}
        aria-hidden='true'
      />

      {/* Panel */}
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='action-preview-title'
        data-testid={testId ?? 'p7-vil-action-preview'}
        style={panelStyle}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <h3
            id='action-preview-title'
            style={{ margin: 0, fontSize: 14, fontWeight: 850, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.4 }}
          >
            {title}
          </h3>
          <button
            type='button'
            onClick={onClose}
            aria-label='Закрыть'
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 10,
              border: '1px solid var(--pc-border)',
              background: 'var(--pc-bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--p7-color-text-muted)',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Changes */}
        {changes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 900, color: 'var(--p7-color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Изменится:
            </p>
            <div>
              {changes.map((change, index) => (
                <ChangeRow key={index} change={change} />
              ))}
            </div>
          </div>
        )}

        {/* Warning */}
        {warning && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid color-mix(in srgb, var(--p7-color-warning, #B54708) 28%, transparent)',
              background: 'var(--p7-color-warning-soft, #FFFAEB)',
              marginBottom: 14,
            }}
          >
            <AlertCircle size={14} strokeWidth={2} style={{ color: 'var(--p7-color-warning, #B54708)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--p7-color-warning, #B54708)', lineHeight: 1.4 }}>
              {warning}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'grid', gap: 8 }}>
          <button
            type='button'
            onClick={onConfirm}
            disabled={loading}
            style={{
              width: '100%',
              minHeight: 44,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1.5px solid var(--p7-color-brand, #0A7A5F)',
              background: loading ? 'var(--p7-color-surface-muted)' : 'var(--p7-color-brand, #0A7A5F)',
              color: loading ? 'var(--p7-color-text-muted)' : '#FFFFFF',
              fontSize: 14,
              fontWeight: 900,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Выполняется…' : confirmLabel}
          </button>
          <button
            type='button'
            onClick={onClose}
            disabled={loading}
            style={{
              width: '100%',
              minHeight: 44,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid var(--pc-border, #D7DEE3)',
              background: 'transparent',
              color: 'var(--p7-color-text-secondary, #475569)',
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </>
  );
}

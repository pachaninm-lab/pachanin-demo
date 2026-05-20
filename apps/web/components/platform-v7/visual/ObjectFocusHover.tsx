'use client';

import * as React from 'react';
import { X, ArrowRight } from 'lucide-react';

/**
 * ObjectFocusHover — при hover (desktop) или long-tap (mobile) показывает связанные элементы.
 *
 * Desktop: hover показывает popover со связями объекта.
 * Mobile: onLongPress() → bottom sheet "Связанные элементы".
 *
 * Использование:
 *   <ObjectFocusHover
 *     label="СДИЗ"
 *     relations={[
 *       { type: 'money', text: '9,65 млн ₽ заблокировано' },
 *       { type: 'action', text: 'Запросить закрытие СДИЗ', href: '/...' },
 *     ]}
 *   >
 *     <span>СДИЗ</span>
 *   </ObjectFocusHover>
 */

export interface ObjectRelation {
  readonly type: 'money' | 'document' | 'action' | 'journal' | 'responsible';
  readonly text: string;
  readonly href?: string;
}

export interface ObjectFocusHoverProps {
  readonly label: string;
  readonly relations: ObjectRelation[];
  readonly children: React.ReactNode;
  readonly mobileSheet?: boolean;
  readonly 'data-testid'?: string;
}

const RELATION_TYPE_COLORS = {
  money:       'var(--p7-color-money, #155EEF)',
  document:    'var(--p7-color-document, #0369A1)',
  action:      'var(--p7-color-brand, #0A7A5F)',
  journal:     'var(--p7-color-text-secondary, #475569)',
  responsible: 'var(--p7-color-text-primary, #0F1419)',
};

const RELATION_TYPE_LABELS = {
  money:       'Деньги',
  document:    'Документ',
  action:      'Действие',
  journal:     'Журнал',
  responsible: 'Ответственный',
};

export function ObjectFocusHover({
  label,
  relations,
  children,
  mobileSheet = false,
  'data-testid': testId,
}: ObjectFocusHoverProps) {
  const [visible, setVisible] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function startLongPress() {
    if (mobileSheet) {
      longPressTimer.current = setTimeout(() => setSheetOpen(true), 500);
    }
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  if (relations.length === 0) return <>{children}</>;

  return (
    <>
      <span
        data-testid={testId ?? 'p7-vil-object-focus-hover'}
        style={{ position: 'relative', display: 'inline-block', cursor: 'default' }}
        onMouseEnter={() => !mobileSheet && setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
      >
        {children}

        {/* Desktop popover */}
        {visible && !mobileSheet && (
          <div
            role='tooltip'
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 8,
              width: 240,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--pc-border, #D7DEE3)',
              background: 'var(--pc-bg-card, #FFFFFF)',
              boxShadow: '0 8px 24px rgba(15,20,25,0.12)',
              zIndex: 200,
              pointerEvents: 'none',
              display: 'grid',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--p7-color-text-muted, #667085)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}: связанные элементы
            </span>
            {relations.map((rel, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                <span
                  style={{
                    padding: '1px 5px',
                    borderRadius: 5,
                    background: 'var(--p7-color-surface-muted, #F2F6F0)',
                    color: RELATION_TYPE_COLORS[rel.type],
                    fontSize: 9,
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginTop: 1,
                  }}
                >
                  {RELATION_TYPE_LABELS[rel.type]}
                </span>
                <span style={{ fontSize: 12, color: 'var(--p7-color-text-primary, #0F1419)', lineHeight: 1.4 }}>
                  {rel.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </span>

      {/* Mobile bottom sheet */}
      {sheetOpen && mobileSheet && (
        <>
          <div
            onClick={() => setSheetOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,25,0.3)', zIndex: 140 }}
            aria-hidden='true'
          />
          <div
            role='dialog'
            aria-label={`Связанные элементы: ${label}`}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              borderRadius: '20px 20px 0 0',
              zIndex: 150,
              background: 'var(--pc-bg-card, #FFFFFF)',
              border: '1px solid var(--pc-border)',
              borderBottom: 'none',
              boxShadow: '0 -8px 32px rgba(15,20,25,0.12)',
              padding: 'calc(16px + env(safe-area-inset-bottom, 0px)) 16px 20px',
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 850, color: 'var(--p7-color-text-primary)' }}>
                {label}: связанные элементы
              </h3>
              <button
                type='button'
                onClick={() => setSheetOpen(false)}
                aria-label='Закрыть'
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  border: '1px solid var(--pc-border)',
                  background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--p7-color-text-muted)',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {relations.map((rel, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span
                  style={{
                    padding: '3px 7px',
                    borderRadius: 7,
                    background: 'var(--p7-color-surface-muted, #F2F6F0)',
                    color: RELATION_TYPE_COLORS[rel.type],
                    fontSize: 10,
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginTop: 2,
                  }}
                >
                  {RELATION_TYPE_LABELS[rel.type]}
                </span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--p7-color-text-primary)', lineHeight: 1.4, flex: 1 }}>
                    {rel.text}
                  </span>
                  {rel.href && (
                    <a href={rel.href} style={{ flexShrink: 0, color: 'var(--p7-color-brand)' }}>
                      <ArrowRight size={14} strokeWidth={2} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

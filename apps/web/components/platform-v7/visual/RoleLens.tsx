'use client';

import * as React from 'react';
import { Eye, ChevronDown } from 'lucide-react';

/**
 * RoleLens — переключатель "Смотреть как" для operator/admin/demo-view.
 *
 * ВАЖНО: только для ролей operator/admin.
 * НЕ ломает реальные права доступа.
 * Обычный seller не видит bank/operator data.
 * Driver не видит bank/investor/control tower.
 *
 * Компонент presentational: реальная фильтрация данных на уровне pages/guards.
 */

export type RoleLensRole =
  | 'seller'
  | 'buyer'
  | 'bank'
  | 'driver'
  | 'operator'
  | 'executive'
  | 'logistics'
  | 'lab'
  | 'elevator'
  | 'surveyor'
  | 'arbitrator'
  | 'compliance';

export interface RoleLensProps {
  readonly currentRole: RoleLensRole;
  readonly availableRoles: RoleLensRole[];
  readonly onChange: (role: RoleLensRole) => void;
  readonly disabled?: boolean;
  readonly 'data-testid'?: string;
}

const ROLE_LABELS: Record<RoleLensRole, string> = {
  seller:     'Продавец',
  buyer:      'Покупатель',
  bank:       'Банк',
  driver:     'Водитель',
  operator:   'Оператор',
  executive:  'Руководитель',
  logistics:  'Логистика',
  lab:        'Лаборатория',
  elevator:   'Элеватор',
  surveyor:   'Сюрвейер',
  arbitrator: 'Арбитр',
  compliance: 'Комплаенс',
};

export function RoleLens({
  currentRole,
  availableRoles,
  onChange,
  disabled = false,
  'data-testid': testId,
}: RoleLensProps) {
  const [open, setOpen] = React.useState(false);

  if (availableRoles.length === 0) return null;

  return (
    <div
      data-testid={testId ?? 'p7-vil-role-lens'}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type='button'
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup='listbox'
        aria-expanded={open}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 10,
          border: '1px solid var(--pc-border, #D7DEE3)',
          background: 'var(--pc-bg-card, #FFFFFF)',
          color: 'var(--p7-color-text-secondary, #475569)',
          fontSize: 12,
          fontWeight: 750,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        <Eye size={13} strokeWidth={2} />
        <span>Смотреть как: </span>
        <span style={{ fontWeight: 900, color: 'var(--p7-color-text-primary, #0F1419)' }}>
          {ROLE_LABELS[currentRole]}
        </span>
        <ChevronDown size={12} style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 95 }}
            aria-hidden='true'
          />
          <div
            role='listbox'
            aria-label='Выбрать роль для просмотра'
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              width: 180,
              borderRadius: 12,
              border: '1px solid var(--pc-border, #D7DEE3)',
              background: 'var(--pc-bg-card, #FFFFFF)',
              boxShadow: '0 8px 24px rgba(15,20,25,0.12)',
              overflow: 'hidden',
              zIndex: 96,
            }}
          >
            {availableRoles.map((role) => {
              const isSelected = role === currentRole;
              return (
                <button
                  key={role}
                  role='option'
                  aria-selected={isSelected}
                  type='button'
                  onClick={() => { onChange(role); setOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    border: 'none',
                    background: isSelected ? 'var(--pc-accent-bg)' : 'transparent',
                    color: isSelected ? 'var(--p7-color-brand, #0A7A5F)' : 'var(--p7-color-text-primary, #0F1419)',
                    fontSize: 12,
                    fontWeight: isSelected ? 850 : 600,
                    cursor: 'pointer',
                  }}
                >
                  {ROLE_LABELS[role]}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

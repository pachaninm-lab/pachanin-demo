'use client';

import { useEffect, useRef } from 'react';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';
import '@/styles/mobile-breakpoints.css';

const ROLES: Array<{ role: PlatformRole; label: string; emoji: string; href: string }> = [
  { role: 'operator',   label: 'Оператор',      emoji: '🎛️',  href: '/platform-v7/operator'   },
  { role: 'executive',  label: 'Руководитель',  emoji: '📊',  href: '/platform-v7/executive/grain' },
  { role: 'seller',     label: 'Продавец',      emoji: '🌾',  href: '/platform-v7/seller'     },
  { role: 'buyer',      label: 'Покупатель',    emoji: '🛒',  href: '/platform-v7/buyer'       },
  { role: 'logistics',  label: 'Логист',        emoji: '🚛',  href: '/platform-v7/logistics'  },
  { role: 'driver',     label: 'Водитель',      emoji: '🚚',  href: '/platform-v7/driver'     },
  { role: 'elevator',   label: 'Элеватор',      emoji: '🏭',  href: '/platform-v7/elevator'   },
  { role: 'lab',        label: 'Лаборатория',   emoji: '🔬',  href: '/platform-v7/lab'        },
  { role: 'bank',       label: 'Банк',          emoji: '🏦',  href: '/platform-v7/bank'       },
  { role: 'compliance', label: 'Комплаенс',     emoji: '⚖️',  href: '/platform-v7/compliance' },
  { role: 'arbitrator', label: 'Арбитр',        emoji: '🔏',  href: '/platform-v7/arbitrator' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RoleSwitcherBottomSheet({ open, onClose }: Props) {
  const { role: currentRole, setRole } = usePlatformV7RStore();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (open && sheetRef.current) {
      sheetRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className="bottom-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Переключить роль"
        tabIndex={-1}
      >
        <div className="bottom-sheet__handle" />
        <div className="bottom-sheet__title">Выберите роль</div>
        {ROLES.map(({ role, label, emoji, href }) => (
          <a
            key={role}
            href={href}
            className="bottom-sheet__item"
            aria-selected={role === currentRole}
            onClick={(e) => {
              e.preventDefault();
              setRole(role);
              onClose();
              window.location.href = href;
            }}
          >
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{emoji}</span>
            <span style={{ flex: 1 }}>{label}</span>
            {role === currentRole && (
              <span style={{ fontSize: '0.75rem', color: 'var(--p7-color-brand)', fontWeight: 600 }}>
                Текущая
              </span>
            )}
          </a>
        ))}
      </div>
    </>
  );
}

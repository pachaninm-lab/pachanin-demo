'use client';
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { useSessionStore } from '@/stores/useSessionStore';
import { roleLabels, type Role } from '@/lib/v9/roles';
import { cn } from '@/lib/v9/utils';

const availableRoles: Role[] = [
  'operator', 'buyer', 'seller', 'driver', 'surveyor',
  'elevator', 'lab', 'bank', 'compliance', 'admin', 'arbitrator',
];

interface RoleSwitcherProps {
  className?: string;
}

export function RoleSwitcher({ className }: RoleSwitcherProps) {
  const { role, setRole, demoMode } = useSessionStore();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
          'border border-border bg-surface hover:bg-muted transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Текущая роль: ${roleLabels[role]}`}
      >
        <RoleAvatar role={role} size={20} />
        <span className="text-text-primary">{roleLabels[role]}</span>
        <ChevronDown
          size={14}
          className={cn('text-text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Выбор роли"
          className={cn(
            'absolute right-0 top-full mt-1 z-50 min-w-[200px]',
            'bg-surface border border-border rounded-lg shadow-lg py-1',
          )}
        >
          {demoMode && (
            <div className="px-3 py-1.5 text-[11px] text-warning font-semibold border-b border-border mb-1">
              SANDBOX — переключение без перезагрузки
            </div>
          )}
          {availableRoles.map(r => (
            <button
              key={r}
              role="option"
              aria-selected={r === role}
              onClick={() => { setRole(r); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left',
                'hover:bg-muted transition-colors',
                r === role && 'bg-[rgba(10,122,95,0.06)] text-brand font-semibold'
              )}
            >
              <RoleAvatar role={r} size={18} />
              {roleLabels[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleAvatar({ role, size }: { role: Role; size: number }) {
  const initials: Record<Role, string> = {
    operator: 'ОП', buyer: 'ПК', seller: 'ПД',
    driver: 'ВД', surveyor: 'СЮ', elevator: 'ЭЛ',
    lab: 'ЛБ', bank: 'БК', compliance: 'КМ',
    admin: 'АД', arbitrator: 'АР',
  };
  const colors: Record<Role, string> = {
    operator: '#0A7A5F', buyer: '#0284C7', seller: '#16A34A',
    driver: '#D97706', surveyor: '#7C3AED', elevator: '#0E7490',
    lab: '#BE185D', bank: '#1D4ED8', compliance: '#4B5563',
    admin: '#0F1419', arbitrator: '#6B21A8',
  };

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        background: colors[role],
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        letterSpacing: '-0.02em',
      }}
    >
      {initials[role]}
    </span>
  );
}

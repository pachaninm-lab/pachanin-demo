'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

interface Command {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  action?: () => void;
}

function buildCommands(role: PlatformRole, router: ReturnType<typeof useRouter>): Command[] {
  const base: Command[] = [
    { id: 'ct', label: 'Центр управления', hint: 'dashboard', href: '/platform-v7/control-tower' },
    { id: 'deals', label: 'Сделки', hint: 'реестр', href: '/platform-v7/deals' },
    { id: 'bank', label: 'Банк', hint: 'резерв и проверка', href: '/platform-v7/bank' },
    { id: 'release', label: 'Проверка выплаты', hint: 'банковские условия', href: '/platform-v7/bank/release-safety' },
    { id: 'disputes', label: 'Споры', hint: 'удержания', href: '/platform-v7/disputes' },
    { id: 'money', label: 'Деньги', hint: 'контур', href: '/platform-v7/money' },
    { id: 'docs', label: 'Документы', hint: 'СДИЗ, ЭТрН, КЭП', href: '/platform-v7/documents' },
    { id: 'logistics', label: 'Логистика', hint: 'рейсы и груз', href: '/platform-v7/logistics' },
    { id: 'dl9106', label: 'DL-9106', hint: 'Пшеница 3 кл.', href: '/platform-v7/deals/DL-9106/clean' },
    { id: 'dl9102', label: 'DL-9102', hint: 'Пшеница 4 кл.', href: '/platform-v7/deals/DL-9102/clean' },
  ];

  const byRole: Partial<Record<PlatformRole, Command[]>> = {
    driver: [{ id: 'driver', label: 'Маршрут водителя', href: '/platform-v7/driver' }],
    surveyor: [{ id: 'surveyor', label: 'Кабинет сюрвейера', href: '/platform-v7/surveyor' }],
    bank: [{ id: 'bankp', label: 'Кабинет банка', href: '/platform-v7/bank' }],
    compliance: [{ id: 'comp', label: 'Комплаенс', href: '/platform-v7/compliance' }],
    arbitrator: [{ id: 'arb', label: 'Арбитр', href: '/platform-v7/arbitrator' }],
    executive: [{ id: 'exec', label: 'Управленческий срез', href: '/platform-v7/executive' }],
  };

  return [...(byRole[role] ?? []), ...base];
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const role = usePlatformV7RStore((s) => s.role);
  const router = useRouter();

  const commands = buildCommands(role, router);

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.hint?.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  function run(cmd: Command) {
    setOpen(false);
    if (cmd.href) router.push(cmd.href);
    else cmd.action?.();
  }

  if (!open) return null;

  return (
    <div style={backdrop} onClick={() => setOpen(false)} role="dialog" aria-modal aria-label="Командная панель">
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={inputWrap}>
          <span style={searchIcon} aria-hidden>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти экран или сделку…"
            style={inputStyle}
            aria-label="Поиск команд"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered[0]) run(filtered[0]);
            }}
          />
          <kbd style={kbdStyle}>Esc</kbd>
        </div>
        <div style={list} role="listbox" aria-label="Результаты поиска">
          {filtered.length === 0 ? (
            <div style={emptyMsg}>Ничего не найдено</div>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.id}
                role="option"
                aria-selected={false}
                onClick={() => run(cmd)}
                style={cmdBtn}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-bg-elevated, #F1F5F9)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={cmdLabel}>{cmd.label}</span>
                {cmd.hint && <span style={cmdHint}>{cmd.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  background: 'rgba(15,20,40,0.44)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: 'max(10vh, 80px)',
};

const dialog: React.CSSProperties = {
  width: 'min(560px, calc(100vw - 32px))',
  background: 'var(--pc-bg-card, #fff)',
  border: '1px solid var(--pc-border, #E4E6EA)',
  borderRadius: 18,
  boxShadow: '0 24px 64px rgba(15,20,40,0.28)',
  overflow: 'hidden',
};

const inputWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  borderBottom: '1px solid var(--pc-border, #E4E6EA)',
};

const searchIcon: React.CSSProperties = {
  color: 'var(--pc-accent, #0A7A5F)',
  fontSize: 16,
  fontWeight: 900,
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: 'var(--pc-text-primary, #0F1419)',
  fontSize: 15,
  fontWeight: 700,
};

const kbdStyle: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 6,
  border: '1px solid var(--pc-border, #E4E6EA)',
  background: 'var(--pc-bg-elevated, #F8FAFB)',
  color: 'var(--pc-text-muted, #64748B)',
  fontSize: 11,
  fontWeight: 700,
  flexShrink: 0,
};

const list: React.CSSProperties = {
  maxHeight: 'min(360px, 50vh)',
  overflowY: 'auto',
  padding: '6px 0',
};

const emptyMsg: React.CSSProperties = {
  padding: '20px 16px',
  textAlign: 'center',
  color: 'var(--pc-text-muted, #64748B)',
  fontSize: 13,
};

const cmdBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '9px 16px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 80ms ease',
};

const cmdLabel: React.CSSProperties = {
  flex: 1,
  color: 'var(--pc-text-primary, #0F1419)',
  fontSize: 13,
  fontWeight: 800,
};

const cmdHint: React.CSSProperties = {
  color: 'var(--pc-text-muted, #64748B)',
  fontSize: 11,
  fontWeight: 700,
};

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

const ROLE_COMMANDS: Record<PlatformRole, Command[]> = {
  operator: [
    { id: 'ct', label: 'Центр управления', hint: 'блокеры и следующий шаг', href: '/platform-v7/control-tower' },
    { id: 'deals', label: 'Сделки', hint: 'реестр исполнения', href: '/platform-v7/deals' },
    { id: 'lots', label: 'Лоты', hint: 'партии и допуск', href: '/platform-v7/lots' },
    { id: 'procurement', label: 'Закупки', hint: 'заявки покупателя', href: '/platform-v7/procurement' },
    { id: 'logistics', label: 'Логистика', hint: 'рейсы и отклонения', href: '/platform-v7/logistics' },
    { id: 'bank', label: 'Банковское основание', hint: 'резерв и проверка', href: '/platform-v7/bank' },
    { id: 'disputes', label: 'Споры', hint: 'доказательства и разбор', href: '/platform-v7/disputes' },
    { id: 'compliance', label: 'Комплаенс', hint: 'допуск и риски', href: '/platform-v7/compliance' },
    { id: 'executive', label: 'Сводка руководителя', hint: 'управленческий срез', href: '/platform-v7/executive' },
  ],
  buyer: [
    { id: 'buyer-home', label: 'Кабинет покупателя', hint: 'мои закупки и поставки', href: '/platform-v7/buyer' },
    { id: 'buyer-procurement', label: 'Мои закупки', hint: 'потребности и предложения', href: '/platform-v7/procurement' },
  ],
  seller: [
    { id: 'seller-home', label: 'Кабинет продавца', hint: 'партии, офферы, документы', href: '/platform-v7/seller' },
  ],
  logistics: [
    { id: 'logistics-home', label: 'Диспетчерская', hint: 'рейсы и перевозчики', href: '/platform-v7/logistics' },
  ],
  driver: [
    { id: 'driver-home', label: 'Мой маршрут', hint: 'рейс, прибытие, фото', href: '/platform-v7/driver' },
  ],
  surveyor: [
    { id: 'surveyor-home', label: 'Мои назначения', hint: 'осмотр и факты', href: '/platform-v7/surveyor' },
  ],
  elevator: [
    { id: 'elevator-home', label: 'Приёмка', hint: 'вес, очередь, выгрузка', href: '/platform-v7/elevator' },
  ],
  lab: [
    { id: 'lab-home', label: 'Пробы и протоколы', hint: 'качество и результат', href: '/platform-v7/lab' },
  ],
  bank: [
    { id: 'bank-home', label: 'Банковское основание', hint: 'проверка документов и статусов', href: '/platform-v7/bank' },
    { id: 'bank-factoring', label: 'Факторинг', hint: 'статус заявки', href: '/platform-v7/bank/factoring' },
    { id: 'bank-escrow', label: 'Эскроу', hint: 'условия удержания', href: '/platform-v7/bank/escrow' },
  ],
  arbitrator: [
    { id: 'arbitrator-home', label: 'Комнаты разбора', hint: 'спор и доказательства', href: '/platform-v7/arbitrator' },
  ],
  compliance: [
    { id: 'compliance-home', label: 'Комплаенс', hint: 'допуск и стоп-факторы', href: '/platform-v7/compliance' },
  ],
  executive: [
    { id: 'exec-home', label: 'Сводка', hint: 'деньги, риски, статус', href: '/platform-v7/executive' },
    { id: 'exec-ct', label: 'Центр управления', hint: 'операционная картина', href: '/platform-v7/control-tower' },
    { id: 'exec-deals', label: 'Сделки', hint: 'реестр исполнения', href: '/platform-v7/deals' },
    { id: 'exec-bank', label: 'Банковское основание', hint: 'основания и удержания', href: '/platform-v7/bank' },
    { id: 'exec-disputes', label: 'Споры', hint: 'разбор и доказательства', href: '/platform-v7/disputes' },
  ],
};

function buildCommands(role: PlatformRole): Command[] {
  return ROLE_COMMANDS[role] ?? ROLE_COMMANDS.operator;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const role = usePlatformV7RStore((s) => s.role);
  const router = useRouter();

  const commands = buildCommands(role);

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
            placeholder="Найти экран своей роли…"
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

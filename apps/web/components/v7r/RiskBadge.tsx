'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ShieldAlert, ShieldCheck, X } from 'lucide-react';

function getRiskStyle(score: number) {
  if (score >= 61) {
    return {
      bg: 'var(--pc-danger-bg)',
      color: 'var(--pc-danger)',
      border: 'rgba(255,139,144,0.22)',
      label: 'Высокий',
      Icon: ShieldAlert,
    };
  }
  if (score >= 31) {
    return {
      bg: 'var(--pc-warning-bg)',
      color: 'var(--pc-warning)',
      border: 'rgba(245,180,30,0.22)',
      label: 'Средний',
      Icon: AlertTriangle,
    };
  }
  return {
    bg: 'var(--pc-success-bg)',
    color: 'var(--pc-success)',
    border: 'rgba(126,242,196,0.22)',
    label: 'Низкий',
    Icon: ShieldCheck,
  };
}

const FACTORS: Array<{ title: string; weight: string; detail: string }> = [
  { title: 'Финансы контрагента', weight: '35%', detail: 'СПАРК-рейтинг, история резервов и просрочек по сделкам.' },
  { title: 'Документы и качество', weight: '25%', detail: 'Полнота пакета, статус ФГИС, расхождения лабораторных протоколов.' },
  { title: 'Логистика', weight: '20%', detail: 'Отклонения GPS, задержки на приёмке, история водителя.' },
  { title: 'История споров', weight: '20%', detail: 'Открытые/закрытые DK-кейсы, средний SLA, ballAt.' },
];

function RiskDialogContent({ score, label, onClose }: { score: number; label: string; onClose: () => void }) {
  return (
    <>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Risk score · {score} · {label}</span>
        <button
          type='button'
          onClick={onClose}
          aria-label='Закрыть методологию risk score'
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 34,
            minHeight: 34,
            borderRadius: 999,
            border: '1px solid var(--pc-border)',
            background: 'var(--pc-bg-elevated)',
            color: 'var(--pc-text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={15} strokeWidth={2.1} />
        </button>
      </span>
      <span style={{ display: 'block', marginTop: 8, color: 'var(--pc-text-muted)', fontSize: 11 }}>
        Считается как взвешенная сумма факторов. Чем выше — тем выше риск срыва сделки.
      </span>
      <span style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {FACTORS.map((factor) => (
          <span
            key={factor.title}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              padding: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--pc-border)',
              borderRadius: 12,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--pc-text-primary)', minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, wordBreak: 'break-word' }}>{factor.title}</span>
              <span style={{ display: 'block', color: 'var(--pc-text-muted)', fontSize: 11, marginTop: 2, lineHeight: 1.45, wordBreak: 'break-word' }}>{factor.detail}</span>
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: 'var(--pc-accent)', fontSize: 12, whiteSpace: 'nowrap' }}>{factor.weight}</span>
          </span>
        ))}
      </span>
      <span style={{ display: 'block', marginTop: 10, fontSize: 11, color: 'var(--pc-text-muted)' }}>
        Пороги: ≥70 — высокий, 30–69 — средний, 0–29 — низкий.
      </span>
    </>
  );
}

export function RiskBadge({ score }: { score: number }) {
  const s = getRiskStyle(score);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [mobile, setMobile] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);
  const Icon = s.Icon;

  React.useEffect(() => {
    setMounted(true);
    const update = () => setMobile(window.innerWidth <= 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node) && !(event.target as HTMLElement)?.closest?.('[data-risk-dialog]')) setOpen(false);
    }
    function onEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const desktopDialog = open ? (
    <span
      role='dialog'
      aria-label='Методология risk score'
      data-risk-dialog
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 8,
        width: 340,
        maxWidth: 'min(340px, calc(100vw - 24px))',
        background: 'linear-gradient(180deg, rgba(17,28,25,0.98) 0%, rgba(10,18,16,0.99) 100%)',
        border: '1px solid var(--pc-border)',
        borderRadius: 16,
        boxShadow: 'var(--pc-shadow-lg)',
        padding: 14,
        zIndex: 120,
        fontSize: 12,
        color: 'var(--pc-text-primary)',
        lineHeight: 1.55,
      }}
    >
      <RiskDialogContent score={score} label={s.label} onClose={() => setOpen(false)} />
    </span>
  ) : null;

  const mobileDialog = mounted && open && mobile
    ? createPortal(
        <div data-risk-dialog style={{ position: 'fixed', inset: 0, zIndex: 160, background: 'rgba(15,20,25,0.52)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '12px 12px calc(12px + env(safe-area-inset-bottom))' }}>
          <div role='dialog' aria-label='Методология risk score' style={{ width: '100%', maxWidth: 480, maxHeight: '75dvh', overflowY: 'auto', background: 'linear-gradient(180deg, rgba(17,28,25,0.98) 0%, rgba(10,18,16,0.99) 100%)', border: '1px solid var(--pc-border)', borderRadius: 18, boxShadow: 'var(--pc-shadow-lg)', padding: 16, fontSize: 12, color: 'var(--pc-text-primary)', lineHeight: 1.55 }}>
            <RiskDialogContent score={score} label={s.label} onClose={() => setOpen(false)} />
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', maxWidth: '100%' }}>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-label={`Risk score ${score}, ${s.label}. Подробнее о методологии.`}
        aria-expanded={open}
        style={{
          background: s.bg,
          color: s.color,
          border: `1px solid ${s.border}`,
          padding: '4px 9px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          cursor: 'pointer',
          maxWidth: '100%',
          boxShadow: 'var(--pc-shadow-sm)',
        }}
      >
        <Icon size={12} strokeWidth={2.1} />
        {score}
      </button>
      {!mobile ? desktopDialog : null}
      {mobileDialog}
    </span>
  );
}

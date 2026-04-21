'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

function getRiskStyle(score: number) {
  if (score >= 61) return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Высокий' };
  if (score >= 31) return { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', label: 'Средний' };
  return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Низкий' };
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
        <span style={{ fontSize: 13, fontWeight: 800 }}>Risk score · {score} · {label}</span>
        <button type='button' onClick={onClose} aria-label='Закрыть методологию risk score' style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, minHeight: 32, borderRadius: 999, border: '1px solid #E4E6EA', background: '#fff', color: '#6B778C', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>×</button>
      </span>
      <span style={{ display: 'block', marginTop: 8, color: '#6B778C', fontSize: 11 }}>Считается как взвешенная сумма факторов. Чем выше — тем выше риск срыва сделки.</span>
      <span style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {FACTORS.map((factor) => (
          <span key={factor.title} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 10 }}>
            <span style={{ fontSize: 12, color: '#0F1419', minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, wordBreak: 'break-word' }}>{factor.title}</span>
              <span style={{ display: 'block', color: '#6B778C', fontSize: 11, marginTop: 2, lineHeight: 1.45, wordBreak: 'break-word' }}>{factor.detail}</span>
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 12, whiteSpace: 'nowrap' }}>{factor.weight}</span>
          </span>
        ))}
      </span>
      <span style={{ display: 'block', marginTop: 10, fontSize: 11, color: '#6B778C' }}>Пороги: ≥70 — высокий (красный), 30–69 — средний (жёлтый), 0–29 — низкий (зелёный).</span>
    </>
  );
}

export function RiskBadge({ score }: { score: number }) {
  const s = getRiskStyle(score);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [mobile, setMobile] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);

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
    <span role='dialog' aria-label='Методология risk score' data-risk-dialog style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 320, maxWidth: 'min(320px, calc(100vw - 24px))', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, boxShadow: '0 16px 40px rgba(9,30,66,0.16)', padding: 14, zIndex: 120, fontSize: 12, color: '#0F1419', lineHeight: 1.55 }}>
      <RiskDialogContent score={score} label={s.label} onClose={() => setOpen(false)} />
    </span>
  ) : null;

  const mobileDialog = mounted && open && mobile
    ? createPortal(
        <div data-risk-dialog style={{ position: 'fixed', inset: 0, zIndex: 160, background: 'rgba(15,20,25,0.36)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '12px 12px calc(12px + env(safe-area-inset-bottom))' }}>
          <div role='dialog' aria-label='Методология risk score' style={{ width: '100%', maxWidth: 480, maxHeight: '75dvh', overflowY: 'auto', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, boxShadow: '0 16px 40px rgba(9,30,66,0.16)', padding: 16, fontSize: 12, color: '#0F1419', lineHeight: 1.55 }}>
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
          padding: '2px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          maxWidth: '100%',
        }}
      >
        {score}
        <span aria-hidden style={{ fontSize: 10, opacity: 0.72 }}>ⓘ</span>
      </button>
      {!mobile ? desktopDialog : null}
      {mobileDialog}
    </span>
  );
}

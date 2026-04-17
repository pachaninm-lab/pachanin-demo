'use client';

import * as React from 'react';

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

export function RiskBadge({ score }: { score: number }) {
  const s = getRiskStyle(score);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
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

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Risk score ${score}, ${s.label}. Подробнее о методологии.`}
        aria-expanded={open}
        style={{
          background: s.bg, color: s.color, border: `1px solid ${s.border}`,
          padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800,
          display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
        }}
      >
        {score}
        <span aria-hidden style={{ fontSize: 10, opacity: 0.72 }}>ⓘ</span>
      </button>
      {open ? (
        <span role="dialog" aria-label="Методология risk score" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, width: 320, maxWidth: '90vw', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, boxShadow: '0 16px 40px rgba(9,30,66,0.16)', padding: 14, zIndex: 90, fontSize: 12, color: '#0F1419', lineHeight: 1.55 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Risk score · {score} · {s.label}</span>
            <span style={{ fontSize: 11, color: '#6B778C' }}>0–100</span>
          </span>
          <span style={{ display: 'block', marginTop: 8, color: '#6B778C', fontSize: 11 }}>Считается как взвешенная сумма факторов. Чем выше — тем выше риск срыва сделки.</span>
          <span style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {FACTORS.map((factor) => (
              <span key={factor.title} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: 8, background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: '#0F1419' }}>
                  <span style={{ display: 'block', fontWeight: 700 }}>{factor.title}</span>
                  <span style={{ display: 'block', color: '#6B778C', fontSize: 11, marginTop: 2 }}>{factor.detail}</span>
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 12 }}>{factor.weight}</span>
              </span>
            ))}
          </span>
          <span style={{ display: 'block', marginTop: 10, fontSize: 11, color: '#6B778C' }}>Пороги: ≥70 — высокий (красный), 30–69 — средний (жёлтый), 0–29 — низкий (зелёный).</span>
        </span>
      ) : null}
    </span>
  );
}

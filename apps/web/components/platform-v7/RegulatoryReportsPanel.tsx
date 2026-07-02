'use client';

import { useState } from 'react';

type ReportStatus = 'ready' | 'generating' | 'sent' | 'overdue';

interface Report {
  id: string;
  recipient: string;
  format: string;
  period: string;
  frequency: string;
  status: ReportStatus;
  deadline: string;
  lastSent?: string;
}

const REPORTS: Report[] = [
  {
    id: 'minagro',
    recipient: 'Минсельхоз',
    format: 'XML (форматы МСХ)',
    period: 'Май 2026',
    frequency: 'Ежемесячно',
    status: 'ready',
    deadline: '05.07.2026',
    lastSent: '05.06.2026',
  },
  {
    id: 'rosstat',
    recipient: 'Росстат',
    format: 'Excel (форма 29-сх)',
    period: 'Q1 2026',
    frequency: 'Ежеквартально',
    status: 'sent',
    deadline: '30.04.2026',
    lastSent: '28.04.2026',
  },
  {
    id: 'fgis',
    recipient: 'ФГИС «Зерно»',
    format: 'API push',
    period: 'Текущий',
    frequency: 'При каждой сделке',
    status: 'ready',
    deadline: 'Авто',
    lastSent: '27.06.2026 14:32',
  },
  {
    id: 'rosfinmon',
    recipient: 'Росфинмониторинг',
    format: 'ФЭС (форматы 407)',
    period: 'Текущий',
    frequency: 'При пороговых операциях',
    status: 'overdue',
    deadline: '15.06.2026',
    lastSent: '01.05.2026',
  },
  {
    id: 'fns',
    recipient: 'ФНС (налоговая)',
    format: 'XML (ОНФ)',
    period: 'Q1 2026',
    frequency: 'Ежеквартально',
    status: 'sent',
    deadline: '25.04.2026',
    lastSent: '22.04.2026',
  },
];

const STATUS_CONFIG: Record<ReportStatus, { label: string; bg: string; color: string }> = {
  ready: { label: 'Готов к отправке', bg: '#EFF6FF', color: '#2563EB' },
  generating: { label: 'Формируется', bg: '#FFFBEB', color: '#D97706' },
  sent: { label: 'Отправлен', bg: '#F0FDF4', color: '#0A7A5F' },
  overdue: { label: 'Просрочен', bg: '#FFF1F1', color: '#DC2626' },
};

export function RegulatoryReportsPanel() {
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState<Set<string>>(new Set());

  function generate(id: string) {
    setGenerating((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setGenerating((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setSent((prev) => new Set([...prev, id]));
    }, 2000);
  }

  const label: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

  const overdue = REPORTS.filter((r) => r.status === 'overdue').length;
  const ready = REPORTS.filter((r) => r.status === 'ready').length;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Status summary */}
      {overdue > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 14, background: '#FFF1F1', border: '1px solid #FECACA', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#DC2626' }}>{overdue} отчёт просрочен</div>
            <div style={{ fontSize: 11, color: '#DC2626' }}>Требует немедленной отправки во избежание штрафов</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
        {[
          { label: 'Отправлено', value: REPORTS.filter((r) => r.status === 'sent' || sent.has(r.id)).length, color: '#0A7A5F' },
          { label: 'Готовы', value: ready, color: '#2563EB' },
          { label: 'Просрочено', value: overdue, color: '#DC2626' },
          { label: 'Получателей', value: REPORTS.length, color: '#0F1419' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 14px', borderRadius: 14, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
            <div style={label}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Reports list */}
      <div style={{ display: 'grid', gap: 10 }}>
        {REPORTS.map((r) => {
          const isGenerating = generating.has(r.id);
          const isSent = sent.has(r.id) || r.status === 'sent';
          const effectiveStatus: ReportStatus = isGenerating ? 'generating' : isSent ? 'sent' : r.status;
          const sc = STATUS_CONFIG[effectiveStatus];

          return (
            <div key={r.id} style={{ padding: '14px 16px', borderRadius: 14, border: `1px solid ${r.status === 'overdue' && !isSent ? '#FECACA' : '#E4E6EA'}`, background: '#fff', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{r.recipient}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{r.format} · {r.frequency}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                    Период: {r.period} · Срок: {r.deadline}
                  </div>
                  {r.lastSent && (
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>Последняя отправка: {r.lastSent}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 8, background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                  {!isSent && !isGenerating && (r.status === 'ready' || r.status === 'overdue') && (
                    <button
                      onClick={() => generate(r.id)}
                      style={{
                        padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: r.status === 'overdue' ? '#DC2626' : '#2563EB',
                        color: '#fff', fontSize: 11, fontWeight: 800,
                      }}
                    >
                      Сформировать и отправить
                    </button>
                  )}
                  {isGenerating && (
                    <span style={{ fontSize: 11, color: '#D97706', fontWeight: 700 }}>Формируется…</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Демо-превью. В боевом контуре — Airflow DAG → sFTP/LK Росстата/API ФГИС, автоформирование отчётов, уведомления о просрочках.
      </div>
    </div>
  );
}

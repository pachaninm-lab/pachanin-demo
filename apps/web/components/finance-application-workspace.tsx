'use client';

import { useMemo, useState } from 'react';

type TimelineStep = { step: string; detail?: string; status?: string };
type WaterfallItem = { title: string; amountRub?: number; status?: string };

type FinanceApplication = {
  id: string;
  status?: string;
  amount?: number;
  nextAction?: string;
  blocker?: string;
  timeline?: TimelineStep[];
};

export function FinanceApplicationWorkspace({
  applicationId,
  initialApplication,
  initialWaterfall,
}: {
  applicationId: string;
  initialApplication: FinanceApplication;
  initialWaterfall?: { items?: WaterfallItem[] } | null;
}) {
  const [status, setStatus] = useState(initialApplication?.status || 'REVIEW');
  const [note, setNote] = useState('');

  const waterfall = useMemo(() => {
    const seeded = initialWaterfall?.items || [];
    if (seeded.length) return seeded;
    return [
      { title: 'Reserve', amountRub: Math.round(Number(initialApplication?.amount || 0) * 0.2), status: 'pending' },
      { title: 'Partial release', amountRub: Math.round(Number(initialApplication?.amount || 0) * 0.5), status: 'pending' },
      { title: 'Final release', amountRub: Math.round(Number(initialApplication?.amount || 0) * 0.3), status: 'hold' },
    ];
  }, [initialApplication, initialWaterfall]);

  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">Finance workspace · {applicationId}</div>
          <div className="muted small" style={{ marginTop: 6 }}>
            Статус, note и payment waterfall в одном месте, без ухода в отдельный ручной Excel.
          </div>
        </div>
        <span className="mini-chip blue">{status}</span>
      </div>

      <div className="workspace-grid" style={{ marginTop: 16 }}>
        <div className="soft-box">
          <div className="text-sm font-semibold">Текущий статус</div>
          <div className="muted small" style={{ marginTop: 8 }}>{initialApplication?.nextAction || 'Следующий шаг не указан'}</div>
          <div className="muted tiny" style={{ marginTop: 6 }}>{initialApplication?.blocker || 'Критичного блокера не видно'}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['REVIEW', 'APPROVED', 'ON_HOLD', 'FUNDED'].map((item) => (
              <button key={item} className="secondary-link" onClick={() => setStatus(item)}>{item}</button>
            ))}
          </div>
        </div>

        <div className="soft-box">
          <div className="text-sm font-semibold">Комментарий оператора</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-transparent p-3 text-sm text-white" rows={5} placeholder="Причина hold / next step / note для finance trail" />
        </div>
      </div>

      <div className="section-stack" style={{ marginTop: 16 }}>
        <div className="text-sm font-semibold">Payment waterfall</div>
        {waterfall.map((item) => (
          <div key={item.title} className="list-row">
            <div>
              <div style={{ fontWeight: 700 }}>{item.title}</div>
              <div className="muted small" style={{ marginTop: 4 }}>{Number(item.amountRub || 0).toLocaleString('ru-RU')} ₽</div>
            </div>
            <span className={`mini-chip ${String(item.status || '').toLowerCase()}`}>{item.status || 'pending'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

'use client';

import { useMemo, useState } from 'react';

type Slot = {
  id: string;
  vehicle: string;
  slot: string;
  status: string;
  linkedDealId?: string | null;
  etaLabel?: string;
};

export function ReceivingQueueConsole({ initialSlots }: { initialSlots: Slot[] }) {
  const [filter, setFilter] = useState('');
  const slots = useMemo(() => filter ? initialSlots.filter((item) => item.status === filter) : initialSlots, [initialSlots, filter]);
  const statuses = useMemo(() => Array.from(new Set(initialSlots.map((item) => item.status))), [initialSlots]);

  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">Queue console</div>
          <div className="muted tiny" style={{ marginTop: 4 }}>Слоты, ETA и handoff в receiving rail.</div>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Все статусы</option>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>
      <div className="section-stack" style={{ marginTop: 12 }}>
        {slots.map((slot) => (
          <div key={slot.id} className="list-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{slot.vehicle} · {slot.slot}</div>
              <div className="muted small" style={{ marginTop: 4 }}>{slot.etaLabel || 'ETA —'} · deal {slot.linkedDealId || '—'}</div>
            </div>
            <span className="mini-chip">{slot.status}</span>
          </div>
        ))}
        {!slots.length ? <div className="muted small">Слоты под текущий фильтр не найдены.</div> : null}
      </div>
    </section>
  );
}

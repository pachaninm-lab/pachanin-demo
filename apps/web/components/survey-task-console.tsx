'use client';

import { useMemo, useState } from 'react';

export function SurveyTaskConsole({ initial }: { initial: any[] }) {
  const [filter, setFilter] = useState('');
  const rows = useMemo(() => filter ? initial.filter((item) => item.status === filter) : initial, [initial, filter]);
  const statuses = useMemo(() => Array.from(new Set(initial.map((item) => item.status))).filter(Boolean), [initial]);

  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">Survey task console</div>
          <div className="muted tiny" style={{ marginTop: 4 }}>Фильтр по статусу и быстрый просмотр owner/SLA.</div>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Все статусы</option>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>
      <div className="section-stack" style={{ marginTop: 12 }}>
        {rows.map((item, index) => (
          <div key={item.id || index} className="list-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{item.providerName || 'provider'} · {item.surveyType || item.type || 'survey'}</div>
              <div className="muted small" style={{ marginTop: 4 }}>{item.reason || '—'}</div>
              <div className="muted tiny" style={{ marginTop: 4 }}>owner {item.owner || '—'} · SLA {item.slaHours || '—'} ч</div>
            </div>
            <span className="mini-chip">{item.status || 'open'}</span>
          </div>
        ))}
        {!rows.length ? <div className="muted small">Под фильтр задачи не найдены.</div> : null}
      </div>
    </section>
  );
}

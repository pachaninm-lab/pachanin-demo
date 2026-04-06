'use client';

import { useState } from 'react';

export function MapSimulation({ points = [] }: { points?: Array<{ id: string; label: string }> }) {
  const [active, setActive] = useState(points[0]?.id || '');
  return (
    <section className="card">
      <div className="section-title">Map simulation</div>
      <div className="detail-meta" style={{ marginTop: 12 }}>
        {points.map((p) => <button key={p.id} className={`mini-chip ${active === p.id ? 'active' : ''}`} onClick={() => setActive(p.id)}>{p.label}</button>)}
      </div>
      <div className="soft-box" style={{ marginTop: 12 }}>Активная точка: {active || '—'}</div>
    </section>
  );
}

'use client';

import { useState } from 'react';

export function SimulationConsole({ scenarios = [] }: { scenarios?: Array<{ id: string; title: string; detail?: string }> }) {
  const [active, setActive] = useState('');
  return (
    <section className="card">
      <div className="section-title">Simulation console</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {scenarios.map((item) => (
          <div key={item.id} className="soft-box">
            <div className="list-row"><b>{item.title}</b><button className="mini-chip" onClick={() => setActive(item.id)}>{active === item.id ? 'active' : 'run'}</button></div>
            {item.detail ? <div className="muted small" style={{ marginTop: 6 }}>{item.detail}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

'use client';

import { useMemo, useState } from 'react';

const CULTURES = ['all', 'wheat', 'barley', 'corn', 'sunflower', 'soybean'];
const REGIONS = ['all', 'Тамбовская область', 'Липецкая область', 'Воронежская область'];

export function LotsFilterClient() {
  const [culture, setCulture] = useState('all');
  const [region, setRegion] = useState('all');
  const [mode, setMode] = useState('all');

  const summary = useMemo(() => {
    const parts = [];
    if (culture !== 'all') parts.push(`культура: ${culture}`);
    if (region !== 'all') parts.push(`регион: ${region}`);
    if (mode !== 'all') parts.push(`режим: ${mode}`);
    return parts.length ? parts.join(' · ') : 'Все активные лоты';
  }, [culture, region, mode]);

  return (
    <div className="soft-box">
      <div className="section-title">Фильтры</div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 12 }}>
        <select className="input" value={culture} onChange={(e) => setCulture(e.target.value)}>
          {CULTURES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="all">all modes</option>
          <option value="auction">auction</option>
          <option value="instant">instant offer</option>
          <option value="target">target</option>
          <option value="operator">operator managed</option>
        </select>
      </div>
      <div className="muted tiny" style={{ marginTop: 10 }}>{summary}</div>
    </div>
  );
}

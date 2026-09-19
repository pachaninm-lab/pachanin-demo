'use client';

import { useState } from 'react';

export function CreateLotWizard() {
  const [culture, setCulture] = useState('Пшеница');
  const [volume, setVolume] = useState('1000');
  const [price, setPrice] = useState('17000');
  const [windowValue, setWindowValue] = useState('Следующая неделя');

  return (
    <section className="section-card">
      <div className="section-title">Create lot wizard</div>
      <div className="info-grid-2" style={{ marginTop: 12 }}>
        <label className="field"><span>Культура</span><input value={culture} onChange={(e) => setCulture(e.target.value)} /></label>
        <label className="field"><span>Объём, т</span><input value={volume} onChange={(e) => setVolume(e.target.value)} /></label>
        <label className="field"><span>Цена, ₽/т</span><input value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="field"><span>Окно</span><input value={windowValue} onChange={(e) => setWindowValue(e.target.value)} /></label>
      </div>
      <div className="soft-box" style={{ marginTop: 14 }}>
        <div className="muted tiny">Черновик лота</div>
        <div style={{ marginTop: 6, fontWeight: 700 }}>{culture} · {volume} т · {price} ₽/т · {windowValue}</div>
      </div>
    </section>
  );
}

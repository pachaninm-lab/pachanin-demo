'use client';

import { useMemo, useState } from 'react';

export function LotCalculator() {
  const [volume, setVolume] = useState('1000');
  const [price, setPrice] = useState('17000');
  const [logistics, setLogistics] = useState('1200');
  const [qualityDelta, setQualityDelta] = useState('0');

  const result = useMemo(() => {
    const v = Number(volume || 0);
    const p = Number(price || 0);
    const l = Number(logistics || 0);
    const q = Number(qualityDelta || 0);
    const gross = v * p;
    const net = v * (p - l + q);
    return { gross, net };
  }, [volume, price, logistics, qualityDelta]);

  return (
    <section className="section-card-tight">
      <div className="section-title">Lot calculator</div>
      <div className="info-grid-2" style={{ marginTop: 12 }}>
        <label className="field"><span>Объём, т</span><input value={volume} onChange={(e) => setVolume(e.target.value)} /></label>
        <label className="field"><span>Цена, ₽/т</span><input value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="field"><span>Логистика, ₽/т</span><input value={logistics} onChange={(e) => setLogistics(e.target.value)} /></label>
        <label className="field"><span>Quality delta, ₽/т</span><input value={qualityDelta} onChange={(e) => setQualityDelta(e.target.value)} /></label>
      </div>
      <div className="mobile-stat-grid" style={{ marginTop: 12 }}>
        <div className="soft-box"><div className="muted tiny">Gross</div><div style={{ marginTop: 6, fontWeight: 700 }}>{result.gross.toLocaleString('ru-RU')} ₽</div></div>
        <div className="soft-box"><div className="muted tiny">Netback</div><div style={{ marginTop: 6, fontWeight: 700 }}>{result.net.toLocaleString('ru-RU')} ₽</div></div>
      </div>
    </section>
  );
}

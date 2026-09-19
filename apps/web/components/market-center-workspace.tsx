'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type MarketRow = {
  id: string;
  buyerName: string;
  culture: string;
  region: string;
  basis: string;
  grossPrice: number;
  netbackRubPerTon: number;
  logisticsRubPerTon: number;
  queueRiskRubPerTon: number;
  qualityAdjustmentRubPerTon: number;
  trust: number;
  paymentSpeed?: string;
  linkedLotId?: string | null;
  linkedDealId?: string | null;
  financeAvailable?: string;
};

type MarketAlert = {
  id: string;
  title: string;
  detail: string;
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'gray';
};

export function MarketCenterWorkspace({
  initialRows,
  initialAlerts = []
}: {
  initialRows: MarketRow[];
  initialAlerts?: MarketAlert[];
}) {
  const [regionFilter, setRegionFilter] = useState('');
  const [cultureFilter, setCultureFilter] = useState('');
  const [sortMode, setSortMode] = useState<'netback' | 'gross' | 'trust'>('netback');

  const regions = useMemo(() => Array.from(new Set(initialRows.map((item) => item.region))).sort(), [initialRows]);
  const cultures = useMemo(() => Array.from(new Set(initialRows.map((item) => item.culture))).sort(), [initialRows]);

  const rows = useMemo(() => {
    let data = [...initialRows];
    if (regionFilter) data = data.filter((item) => item.region === regionFilter);
    if (cultureFilter) data = data.filter((item) => item.culture === cultureFilter);
    data.sort((a, b) => {
      if (sortMode === 'gross') return b.grossPrice - a.grossPrice;
      if (sortMode === 'trust') return b.trust - a.trust;
      return b.netbackRubPerTon - a.netbackRubPerTon;
    });
    return data;
  }, [initialRows, regionFilter, cultureFilter, sortMode]);

  return (
    <div className="section-stack">
      {!!initialAlerts.length && (
        <section className="section-card-tight">
          <div className="section-title">Сигналы рынка</div>
          <div className="section-stack" style={{ marginTop: 12 }}>
            {initialAlerts.map((alert) => (
              <div key={alert.id} className="list-row">
                <div>
                  <div style={{ fontWeight: 700 }}>{alert.title}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>{alert.detail}</div>
                </div>
                <span className={`mini-chip ${alert.tone || 'gray'}`}>{alert.tone || 'info'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section-card-tight">
        <div className="section-title">Фильтры</div>
        <div className="mobile-two-grid" style={{ marginTop: 12 }}>
          <label className="field-block">
            <span>Регион</span>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="">Все регионы</option>
              {regions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field-block">
            <span>Культура</span>
            <select value={cultureFilter} onChange={(e) => setCultureFilter(e.target.value)}>
              <option value="">Все культуры</option>
              {cultures.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field-block">
            <span>Сортировка</span>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)}>
              <option value="netback">По netback</option>
              <option value="gross">По gross</option>
              <option value="trust">По trust</option>
            </select>
          </label>
        </div>
      </section>

      <section className="section-card-tight">
        <div className="section-title">Buyer rows</div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {rows.map((row) => (
            <Link key={row.id} href={`/market-center/${row.id}`} className="list-row linkable" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{row.buyerName} · {row.culture}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{row.region} · {row.basis}</div>
                <div className="muted tiny" style={{ marginTop: 6 }}>
                  logistics {row.logisticsRubPerTon.toLocaleString('ru-RU')} ₽/т · queue risk {row.queueRiskRubPerTon.toLocaleString('ru-RU')} ₽/т · quality {row.qualityAdjustmentRubPerTon.toLocaleString('ru-RU')} ₽/т
                </div>
                <div className="muted tiny" style={{ marginTop: 4 }}>
                  trust {row.trust} · money {row.paymentSpeed || '—'} · finance {row.financeAvailable || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="mini-chip">gross {row.grossPrice.toLocaleString('ru-RU')} ₽/т</div>
                <div className="mini-chip" style={{ marginTop: 6 }}>netback {row.netbackRubPerTon.toLocaleString('ru-RU')} ₽/т</div>
                <div className="muted tiny" style={{ marginTop: 6 }}>{row.linkedDealId || row.linkedLotId || 'open'}</div>
              </div>
            </Link>
          ))}
          {!rows.length ? <div className="muted small">Под фильтры ничего не найдено.</div> : null}
        </div>
      </section>
    </div>
  );
}

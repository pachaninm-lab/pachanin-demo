'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

const GMV_BY_DAY = [
  { date: '01.03', gmv: 280, deals: 18 },
  { date: '04.03', gmv: 342, deals: 22 },
  { date: '07.03', gmv: 190, deals: 12 },
  { date: '10.03', gmv: 456, deals: 29 },
  { date: '13.03', gmv: 621, deals: 38 },
  { date: '16.03', gmv: 398, deals: 25 },
  { date: '19.03', gmv: 534, deals: 34 },
  { date: '20.03', gmv: 287, deals: 18 },
];

const GMV_BY_CROP = [
  { crop: 'Пшеница 3кл', gmv: 1820, pct: 38 },
  { crop: 'Пшеница 4кл', gmv: 1140, pct: 24 },
  { crop: 'Ячмень',      gmv: 760,  pct: 16 },
  { crop: 'Подсолнечник',gmv: 610,  pct: 13 },
  { crop: 'Кукуруза',    gmv: 430,  pct: 9  },
];

const REGION_DATA = [
  { region: 'Краснодарский кр.', gmv: 1240, deals: 82 },
  { region: 'Ростовская обл.',   gmv: 890,  deals: 59 },
  { region: 'Ставропольский кр.', gmv: 710, deals: 47 },
  { region: 'Воронежская обл.',  gmv: 540,  deals: 36 },
  { region: 'Белгородская обл.', gmv: 380,  deals: 25 },
];

const FUNNEL = [
  { stage: 'Заявок',       count: 1842, pct: 100 },
  { stage: 'Переговоров',  count: 734,  pct: 40 },
  { stage: 'Договоров',    count: 441,  pct: 24 },
  { stage: 'Оплата',       count: 389,  pct: 21 },
  { stage: 'Закрыто',      count: 312,  pct: 17 },
];

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

type Tab = 'gmv' | 'crops' | 'regions' | 'funnel';

export function ClickHouseAnalyticsPanel() {
  const [tab, setTab] = useState<Tab>('gmv');

  const totalGmv = GMV_BY_DAY.reduce((s, d) => s + d.gmv, 0);
  const totalDeals = GMV_BY_DAY.reduce((s, d) => s + d.deals, 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        {[
          { label: 'GMV (март)',    value: `${totalGmv} млн ₽`,    color: '#0F1419' },
          { label: 'Сделок',        value: totalDeals,               color: '#1E40AF' },
          { label: 'Ср. чек',       value: `${(totalGmv/totalDeals).toFixed(1)} млн ₽`, color: '#0A7A5F' },
          { label: 'Конверсия',     value: '17%',                   color: '#5B21B6' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ClickHouse info */}
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 9, color: '#1E40AF', fontWeight: 700, lineHeight: 1.6 }}>
        ClickHouse 23.8 · MergeTree ENGINE · Partition by month · Materialized View gmv_by_day (SummingMergeTree) · ETL из PostgreSQL через Airflow · Sub-second query latency · Демо-данные
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {([['gmv', 'GMV по дням'], ['crops', 'По культурам'], ['regions', 'По регионам'], ['funnel', 'Воронка']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '4px 10px', borderRadius: 6, border: tab === id ? 'none' : '1px solid #E4E6EA', background: tab === id ? '#0F1419' : '#F8FAFB', color: tab === id ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Charts */}
      {tab === 'gmv' && (
        <div style={{ height: 200 }}>
          <div style={{ ...lbl, marginBottom: 6 }}>GMV + Количество сделок по дням (млн ₽)</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={GMV_BY_DAY} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E6EA" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v: number) => [`${v} млн ₽`]} />
              <Bar dataKey="gmv" name="GMV" fill="#0A7A5F" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'crops' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={lbl}>GMV по культурам (млн ₽)</div>
          {GMV_BY_CROP.map((c) => (
            <div key={c.crop} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#374151', minWidth: 140 }}>{c.crop}</span>
              <div style={{ flex: 1, height: 16, background: '#E4E6EA', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${c.pct}%`, height: '100%', background: '#0A7A5F', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#0F1419', minWidth: 60, textAlign: 'right' }}>{c.gmv} млн · {c.pct}%</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'regions' && (
        <div style={{ height: 180 }}>
          <div style={{ ...lbl, marginBottom: 6 }}>GMV по регионам (млн ₽)</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={REGION_DATA} layout="vertical" margin={{ top: 0, right: 30, left: 80, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="region" tick={{ fontSize: 8 }} width={80} />
              <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v: number) => [`${v} млн ₽`]} />
              <Bar dataKey="gmv" name="GMV" fill="#1E40AF" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'funnel' && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={lbl}>Воронка конверсии заявки → закрытые сделки</div>
          {FUNNEL.map((f, i) => (
            <div key={f.stage} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#374151', minWidth: 90 }}>{f.stage}</span>
              <div style={{ flex: 1, height: 20, background: '#E4E6EA', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${f.pct}%`, height: '100%', background: `hsl(${160 - i*20}, 60%, ${40 + i*5}%)`, display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{f.count}</span>
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#0F1419', minWidth: 30 }}>{f.pct}%</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        ClickHouse · deals_fact table · gmv_by_day MV · ETL Airflow 2.8 · Росстат отчёты · Аналитика в реальном времени · Демо-данные.
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const CROPS = [
  { id: 'wheat4', label: 'Пшеница 4 класса', base: 12500 },
  { id: 'wheat3', label: 'Пшеница 3 класса', base: 14200 },
  { id: 'barley', label: 'Ячмень', base: 10800 },
  { id: 'corn', label: 'Кукуруза', base: 11600 },
  { id: 'sunflower', label: 'Подсолнечник', base: 32000 },
  { id: 'soy', label: 'Соя', base: 38500 },
];

const REGIONS = [
  { id: 'tambov', label: 'Тамбовская', factor: 1.0 },
  { id: 'voronezh', label: 'Воронежская', factor: 1.02 },
  { id: 'stavropol', label: 'Ставропольский', factor: 0.98 },
  { id: 'kuban', label: 'Краснодарский', factor: 1.05 },
  { id: 'volgograd', label: 'Волгоградская', factor: 0.97 },
];

function generatePriceSeries(base: number, factor: number) {
  const noise = [0.96, 0.97, 0.98, 0.99, 1.0, 1.01, 1.02, 1.01, 1.03, 1.04, 1.02, 1.01];
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  return months.map((month, i) => ({
    month,
    price: Math.round(base * factor * noise[i]),
    predicted: i >= 9 ? Math.round(base * factor * noise[i] * (1 + (i - 9) * 0.005)) : undefined,
  }));
}

const rub = (n: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
const label: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

export function PricePredictorWidget() {
  const [cropId, setCropId] = useState('wheat4');
  const [regionId, setRegionId] = useState('tambov');
  const [predicting, setPredicting] = useState(false);
  const [predicted, setPredicted] = useState(false);

  const crop = CROPS.find((c) => c.id === cropId)!;
  const region = REGIONS.find((r) => r.id === regionId)!;
  const series = generatePriceSeries(crop.base, region.factor);
  const currentPrice = series[8].price;
  const predictedPrice = Math.round(currentPrice * 1.023);
  const confidence = 82;

  function runPrediction() {
    setPredicting(true);
    setTimeout(() => { setPredicting(false); setPredicted(true); }, 1800);
  }

  const select: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA',
    background: '#fff', fontSize: 12, fontWeight: 600, color: '#0F1419', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select value={cropId} onChange={(e) => { setCropId(e.target.value); setPredicted(false); }} style={select}>
          {CROPS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={regionId} onChange={(e) => { setRegionId(e.target.value); setPredicted(false); }} style={select}>
          {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label} обл.</option>)}
        </select>
      </div>

      {/* Chart */}
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
        <div style={{ ...label, marginBottom: 12 }}>Динамика цены · ₽/т · 2026 г.</div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E4E6EA' }}
              formatter={(v: number) => [rub(v)]}
            />
            <ReferenceLine x="Сен" stroke="#94A3B8" strokeDasharray="3 3" label={{ value: 'Сейчас', fontSize: 9, fill: '#94A3B8' }} />
            <Line type="monotone" dataKey="price" stroke="#0A7A5F" strokeWidth={2} dot={false} name="Факт" connectNulls />
            <Line type="monotone" dataKey="predicted" stroke="#2563EB" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Прогноз ML" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Current price + prediction */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ padding: '12px 16px', borderRadius: 14, border: '1px solid #E4E6EA', background: '#F8FAFB' }}>
          <div style={label}>Текущая цена</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0F1419', marginTop: 4 }}>{rub(currentPrice)}</div>
          <div style={{ fontSize: 10, color: '#94A3B8' }}>Сентябрь 2026 · {region.label}</div>
        </div>
        <div style={{
          padding: '12px 16px', borderRadius: 14,
          border: `1px solid ${predicted ? '#BFDBFE' : '#E4E6EA'}`,
          background: predicted ? '#EFF6FF' : '#F8FAFB',
        }}>
          <div style={label}>Прогноз ML (30 дней)</div>
          {predicted ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#2563EB', marginTop: 4 }}>{rub(predictedPrice)}</div>
              <div style={{ fontSize: 10, color: '#2563EB' }}>
                +{Math.round((predictedPrice / currentPrice - 1) * 100 * 10) / 10}% · Уверенность {confidence}%
              </div>
            </>
          ) : (
            <button
              onClick={runPrediction}
              disabled={predicting}
              style={{
                marginTop: 8, padding: '8px 14px', borderRadius: 10, border: 'none',
                cursor: predicting ? 'not-allowed' : 'pointer',
                background: predicting ? '#E4E6EA' : '#2563EB',
                color: predicting ? '#94A3B8' : '#fff', fontSize: 11, fontWeight: 800,
              }}
            >
              {predicting ? 'Считаем…' : 'Запустить прогноз'}
            </button>
          )}
        </div>
      </div>

      {/* Feature contributions */}
      {predicted && (
        <div style={{ padding: '12px 16px', borderRadius: 14, border: '1px solid #BFDBFE', background: '#EFF6FF' }}>
          <div style={{ ...label, marginBottom: 10 }}>Ключевые факторы прогноза</div>
          {[
            { factor: 'Погода и урожайность', impact: '+1.8%', positive: true },
            { factor: 'Экспортные квоты', impact: '-0.5%', positive: false },
            { factor: 'Спрос (история сделок)', impact: '+1.1%', positive: true },
            { factor: 'Сезонность', impact: '-0.1%', positive: false },
          ].map((f) => (
            <div key={f.factor} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
              <span style={{ color: '#0F1419' }}>{f.factor}</span>
              <span style={{ fontWeight: 800, color: f.positive ? '#0A7A5F' : '#DC2626' }}>{f.impact}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#94A3B8', padding: '4px 8px', borderRadius: 6, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
        Демо-превью. В боевом контуре — ML-модель на scikit-learn/LightGBM, данные из ClickHouse (история сделок + погода НСХП). Serving через FastAPI.
      </div>
    </div>
  );
}

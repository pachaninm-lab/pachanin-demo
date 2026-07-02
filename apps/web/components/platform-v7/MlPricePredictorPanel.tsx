'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart } from 'recharts';

type Crop = 'wheat3' | 'wheat4' | 'barley' | 'sunflower' | 'corn';

const CROP_LABELS: Record<Crop, string> = {
  wheat3:    'Пшеница 3кл',
  wheat4:    'Пшеница 4кл',
  barley:    'Ячмень',
  sunflower: 'Подсолнечник',
  corn:      'Кукуруза',
};

const PREDICTIONS: Record<Crop, {
  currentPrice: number;
  predicted7d: number;
  predicted30d: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  factors: string[];
  history: Array<{ week: string; actual: number | null; predicted: number; lower: number; upper: number }>;
}> = {
  wheat3: {
    currentPrice: 14800, predicted7d: 15200, predicted30d: 15800, confidence: 78, trend: 'up',
    factors: ['Экспортный спрос (+)', 'Запасы в РФ ниже среднего (+)', 'Урожай Аргентины выше ожиданий (-)'],
    history: [
      { week: 'Янв', actual: 13400, predicted: 13200, lower: 12800, upper: 13600 },
      { week: 'Фев', actual: 14100, predicted: 14000, lower: 13500, upper: 14500 },
      { week: 'Мар-1', actual: 14600, predicted: 14700, lower: 14200, upper: 15200 },
      { week: 'Мар-2', actual: 14800, predicted: 14900, lower: 14400, upper: 15400 },
      { week: 'Мар-3', actual: null, predicted: 15200, lower: 14600, upper: 15800 },
      { week: 'Апр', actual: null, predicted: 15800, lower: 14900, upper: 16700 },
    ],
  },
  wheat4: {
    currentPrice: 13200, predicted7d: 13500, predicted30d: 14100, confidence: 74, trend: 'up',
    factors: ['Спрэд к пшенице 3кл сужается (+)', 'Внутренний спрос мукомолов (+)'],
    history: [
      { week: 'Янв', actual: 11900, predicted: 11700, lower: 11200, upper: 12200 },
      { week: 'Фев', actual: 12400, predicted: 12300, lower: 11800, upper: 12800 },
      { week: 'Мар-1', actual: 12900, predicted: 13000, lower: 12500, upper: 13500 },
      { week: 'Мар-2', actual: 13200, predicted: 13100, lower: 12600, upper: 13600 },
      { week: 'Мар-3', actual: null, predicted: 13500, lower: 12900, upper: 14100 },
      { week: 'Апр', actual: null, predicted: 14100, lower: 13200, upper: 15000 },
    ],
  },
  barley: {
    currentPrice: 11600, predicted7d: 11400, predicted30d: 11200, confidence: 71, trend: 'down',
    factors: ['Давление со стороны урожая ЕС (-)', 'Снижение экспортных квот (-)'],
    history: [
      { week: 'Янв', actual: 12200, predicted: 12100, lower: 11700, upper: 12500 },
      { week: 'Фев', actual: 11900, predicted: 11800, lower: 11400, upper: 12200 },
      { week: 'Мар-1', actual: 11700, predicted: 11600, lower: 11200, upper: 12000 },
      { week: 'Мар-2', actual: 11600, predicted: 11500, lower: 11100, upper: 11900 },
      { week: 'Мар-3', actual: null, predicted: 11400, lower: 10900, upper: 11900 },
      { week: 'Апр', actual: null, predicted: 11200, lower: 10600, upper: 11800 },
    ],
  },
  sunflower: {
    currentPrice: 32400, predicted7d: 33100, predicted30d: 34500, confidence: 65, trend: 'up',
    factors: ['Мировые запасы масла на минимуме (+)', 'Урожай Украины под вопросом (+)'],
    history: [
      { week: 'Янв', actual: 30100, predicted: 29800, lower: 28900, upper: 30700 },
      { week: 'Фев', actual: 31200, predicted: 31000, lower: 30000, upper: 32000 },
      { week: 'Мар-1', actual: 31900, predicted: 32100, lower: 31000, upper: 33200 },
      { week: 'Мар-2', actual: 32400, predicted: 32600, lower: 31400, upper: 33800 },
      { week: 'Мар-3', actual: null, predicted: 33100, lower: 31700, upper: 34500 },
      { week: 'Апр', actual: null, predicted: 34500, lower: 32600, upper: 36400 },
    ],
  },
  corn: {
    currentPrice: 10800, predicted7d: 10800, predicted30d: 11100, confidence: 69, trend: 'stable',
    factors: ['Цены стабилизировались (→)', 'Спрос со стороны комбикормов (+)'],
    history: [
      { week: 'Янв', actual: 10200, predicted: 10100, lower: 9800, upper: 10400 },
      { week: 'Фев', actual: 10500, predicted: 10400, lower: 10100, upper: 10700 },
      { week: 'Мар-1', actual: 10700, predicted: 10700, lower: 10400, upper: 11000 },
      { week: 'Мар-2', actual: 10800, predicted: 10800, lower: 10500, upper: 11100 },
      { week: 'Мар-3', actual: null, predicted: 10800, lower: 10400, upper: 11200 },
      { week: 'Апр', actual: null, predicted: 11100, lower: 10600, upper: 11600 },
    ],
  },
};

const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' };

function fmtPrice(v: number) { return `${v.toLocaleString('ru-RU')} ₽/т`; }

export function MlPricePredictorPanel() {
  const [crop, setCrop] = useState<Crop>('wheat3');
  const data = PREDICTIONS[crop];
  const delta7 = data.predicted7d - data.currentPrice;
  const deltaSign = delta7 >= 0 ? '+' : '';
  const trendColor = data.trend === 'up' ? '#065F46' : data.trend === 'down' ? '#991B1B' : '#1E40AF';
  const trendIcon = data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Crop selector */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {(Object.keys(CROP_LABELS) as Crop[]).map((c) => (
          <button key={c} onClick={() => setCrop(c)} style={{ padding: '4px 10px', borderRadius: 6, border: crop === c ? 'none' : '1px solid #E4E6EA', background: crop === c ? '#0F1419' : '#F8FAFB', color: crop === c ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
            {CROP_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Prediction summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        {[
          { label: 'Сейчас',        value: fmtPrice(data.currentPrice), color: '#0F1419' },
          { label: 'Прогноз 7 дн',  value: `${fmtPrice(data.predicted7d)} (${deltaSign}${delta7.toLocaleString('ru-RU')})`, color: trendColor },
          { label: 'Прогноз 30 дн', value: fmtPrice(data.predicted30d), color: trendColor },
          { label: 'Достоверность', value: `${data.confidence}%`, color: data.confidence >= 75 ? '#065F46' : '#92400E' },
          { label: 'Тренд',         value: `${trendIcon} ${data.trend === 'up' ? 'Рост' : data.trend === 'down' ? 'Снижение' : 'Стабильно'}`, color: trendColor },
        ].map((s) => (
          <div key={s.label} style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
            <div style={lbl}>{s.label}</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: s.color, marginTop: 4, lineHeight: 1.3 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Prediction chart */}
      <div style={{ height: 200 }}>
        <div style={{ ...lbl, marginBottom: 6 }}>История + Прогноз с доверительным интервалом (₽/т)</div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E6EA" />
            <XAxis dataKey="week" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} tickFormatter={(v) => `${(v/1000).toFixed(0)}к`} />
            <Tooltip contentStyle={{ fontSize: 9 }} formatter={(v: number) => [`${v.toLocaleString('ru-RU')} ₽/т`]} />
            <ReferenceLine x="Мар-2" stroke="#94A3B8" strokeDasharray="4 2" label={{ value: 'Сегодня', fontSize: 8, fill: '#94A3B8' }} />
            <Area type="monotone" dataKey="upper" stroke="none" fill="#D1FAE5" fillOpacity={0.6} name="Верх. граница" />
            <Area type="monotone" dataKey="lower" stroke="none" fill="#fff" fillOpacity={1} name="Ниж. граница" />
            <Line type="monotone" dataKey="predicted" stroke="#0A7A5F" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Прогноз" />
            <Line type="monotone" dataKey="actual" stroke="#0F1419" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} name="Факт" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Factors */}
      <div>
        <div style={{ ...lbl, marginBottom: 6 }}>Факторы прогноза</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {data.factors.map((f) => {
            const isPos = f.includes('(+)');
            const isNeg = f.includes('(-)');
            return (
              <div key={f} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, padding: '4px 8px', borderRadius: 6, background: isPos ? '#F0FDF4' : isNeg ? '#FEF2F2' : '#EFF6FF', border: `1px solid ${isPos ? '#BBF7D0' : isNeg ? '#FECACA' : '#BFDBFE'}` }}>
                <span style={{ fontWeight: 900, color: isPos ? '#0A7A5F' : isNeg ? '#DC2626' : '#1E40AF' }}>{isPos ? '▲' : isNeg ? '▼' : '→'}</span>
                <span style={{ color: '#374151' }}>{f}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 9, color: '#92400E', fontWeight: 700 }}>
        ML: LightGBM · Признаки: регион, культура, класс, погода (НСХП), биржевые цены МБТС, исторические данные · Переобучение еженедельно (Airflow) · Serving: FastAPI + Redis Feature Store · Демо-данные.
      </div>
    </div>
  );
}

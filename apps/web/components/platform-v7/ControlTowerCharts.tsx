'use client';

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// --- GMV area chart data (12 months) ---
const GMV_DATA = [
  { month: 'Июл', gmv: 42, deals: 8 },
  { month: 'Авг', gmv: 55, deals: 11 },
  { month: 'Сен', gmv: 61, deals: 13 },
  { month: 'Окт', gmv: 78, deals: 16 },
  { month: 'Ноя', gmv: 68, deals: 14 },
  { month: 'Дек', gmv: 52, deals: 10 },
  { month: 'Янв', gmv: 38, deals: 7 },
  { month: 'Фев', gmv: 47, deals: 9 },
  { month: 'Мар', gmv: 73, deals: 15 },
  { month: 'Апр', gmv: 118, deals: 20 },
  { month: 'Май', gmv: 136, deals: 24 },
  { month: 'Июн', gmv: 142, deals: 26 },
];

// --- Status donut data ---
const STATUS_DATA = [
  { name: 'Активны', value: 9, color: '#0A7A5F' },
  { name: 'Выплачены', value: 5, color: '#059669' },
  { name: 'Споры', value: 3, color: '#D97706' },
  { name: 'Заблокированы', value: 2, color: '#DC2626' },
  { name: 'Закрыты', value: 1, color: '#94A3B8' },
];

// --- Weekly activity heatmap ---
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKS = 8;
function genHeatmap() {
  const data: number[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const row: number[] = [];
    for (let d = 0; d < 7; d++) {
      const isWeekend = d >= 5;
      row.push(isWeekend ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 12) + 1);
    }
    data.push(row);
  }
  return data;
}
const HEATMAP = genHeatmap();

function heatColor(v: number): string {
  if (v === 0) return 'var(--p7-color-surface-muted, #F1F5F9)';
  if (v <= 3) return 'rgba(10,122,95,0.15)';
  if (v <= 7) return 'rgba(10,122,95,0.40)';
  return 'rgba(10,122,95,0.80)';
}

const TOOLTIP_STYLE = {
  background: 'var(--p7-color-surface, #fff)',
  border: '1px solid var(--p7-color-border, #E4E6EA)',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--pc-text-primary, #0F1419)',
  padding: '6px 10px',
};

function GmvTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.name === 'gmv' ? '#0A7A5F' : '#2563EB' }}>
          {p.name === 'gmv' ? `GMV: ${p.value} млн ₽` : `Сделок: ${p.value}`}
        </div>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  const total = STATUS_DATA.reduce((s, d) => s + d.value, 0);
  const p = payload[0];
  return (
    <div style={TOOLTIP_STYLE}>
      {p.name}: {p.value} ({Math.round((p.value / total) * 100)}%)
    </div>
  );
}

export function ControlTowerCharts() {
  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* GMV Area Chart */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>
          GMV и количество сделок · 12 мес.
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={GMV_DATA} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0A7A5F" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#0A7A5F" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="dealsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--pc-text-muted, #94A3B8)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--pc-text-muted, #94A3B8)' }} tickLine={false} axisLine={false} />
            <Tooltip content={<GmvTooltip />} />
            <Area type="monotone" dataKey="gmv" stroke="#0A7A5F" strokeWidth={2} fill="url(#gmvGrad)" dot={false} />
            <Area type="monotone" dataKey="deals" stroke="#2563EB" strokeWidth={1.5} fill="url(#dealsGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {/* Donut Chart */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>
            Статусы сделок
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={STATUS_DATA}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
              >
                {STATUS_DATA.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
              <Legend
                iconSize={8}
                formatter={(value: string) => <span style={{ fontSize: 9, color: 'var(--pc-text-muted)', fontWeight: 600 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Heatmap */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>
            Активность по дням (событий)
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gap: '0.25rem' }}>
              {Array.from({ length: WEEKS }, (_, w) => (
                <div key={w} style={{ fontSize: 8, color: 'var(--pc-text-muted)', textAlign: 'center', fontWeight: 600 }}>
                  Н{WEEKS - w}
                </div>
              ))}
            </div>
            {DAYS.map((day, d) => (
              <div key={day} style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gap: '0.25rem', alignItems: 'center' }}>
                {HEATMAP.map((week, w) => (
                  <div
                    key={w}
                    title={`${day}, Н${WEEKS - w}: ${week[d]} событий`}
                    style={{
                      height: 18,
                      borderRadius: 3,
                      background: heatColor(week[d]),
                      border: '1px solid rgba(0,0,0,0.04)',
                    }}
                  />
                ))}
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', marginTop: '0.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: 8, color: 'var(--pc-text-muted)' }}>Меньше</span>
              {[0, 2, 5, 10].map((v) => (
                <div key={v} style={{ width: 12, height: 12, borderRadius: 2, background: heatColor(v), border: '1px solid rgba(0,0,0,0.06)' }} />
              ))}
              <span style={{ fontSize: 8, color: 'var(--pc-text-muted)' }}>Больше</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.375rem' }}>
            {DAYS.map((d) => (
              <span key={d} style={{ fontSize: 8, color: 'var(--pc-text-muted)', fontWeight: 600, minWidth: 12, textAlign: 'center' }}>{d}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', lineHeight: 1.5 }}>
        Графики на демо-данных сценария. Реальные метрики подключаются через live-интеграции с банковским и операционным контуром.
      </div>
    </div>
  );
}

'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

interface FunnelStage {
  label: string;
  count: number;
  amountMln: number;
  pct: number;
  color: string;
}

const FUNNEL: FunnelStage[] = [
  { label: 'Опубликованные лоты',     count: 48,  amountMln: 980,  pct: 100, color: '#0A7A5F' },
  { label: 'Получили предложения',    count: 31,  amountMln: 640,  pct: 65,  color: '#059669' },
  { label: 'Согласованы условия',     count: 20,  amountMln: 420,  pct: 42,  color: '#10B981' },
  { label: 'Резерв в банке',          count: 14,  amountMln: 295,  pct: 29,  color: '#34D399' },
  { label: 'Груз доставлен',          count: 11,  amountMln: 228,  pct: 23,  color: '#6EE7B7' },
  { label: 'Выплата подтверждена',    count: 8,   amountMln: 165,  pct: 17,  color: '#A7F3D0' },
];

interface TooltipPayload {
  payload?: FunnelStage;
}

function FunnelTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const s = payload[0].payload;
  return (
    <div style={{
      background: '#fff', border: '1px solid #E4E6EA', borderRadius: 10,
      padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#0F1419',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ marginBottom: 4, fontWeight: 800 }}>{s.label}</div>
      <div>{s.count} сделок · {s.amountMln} млн ₽</div>
      <div style={{ color: '#0A7A5F' }}>Конверсия: {s.pct}%</div>
    </div>
  );
}

export function SalesFunnelChart() {
  const maxCount = FUNNEL[0].count;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Bar chart */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Сделок по этапам
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={FUNNEL} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, maxCount]} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={false} axisLine={false} tickLine={false} width={0} />
              <Tooltip content={<FunnelTooltip />} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {FUNNEL.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
                <LabelList dataKey="count" position="right" style={{ fontSize: 10, fontWeight: 700, fill: 'var(--pc-text-primary, #0F1419)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stage table */}
        <div style={{ display: 'grid', gap: '0.375rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.125rem' }}>
            Конверсия воронки
          </div>
          {FUNNEL.map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <div style={{ fontSize: 10, color: 'var(--pc-text-secondary)', flex: 1, lineHeight: 1.3 }}>{s.label}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: s.pct < 30 ? '#D97706' : '#059669', minWidth: 28, textAlign: 'right' }}>{s.pct}%</div>
              {i > 0 && (
                <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', minWidth: 28, textAlign: 'right' }}>
                  -{FUNNEL[i - 1].pct - s.pct}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conversion summary */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.15)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#0A7A5F' }}>Общая конверсия: {FUNNEL[FUNNEL.length - 1].pct}%</span>
        </div>
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.15)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>
            GMV выплачено: {FUNNEL[FUNNEL.length - 1].amountMln} млн ₽ из {FUNNEL[0].amountMln} млн ₽
          </span>
        </div>
        <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.15)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#B45309' }}>
            Конверсия лот→выплата: {FUNNEL[FUNNEL.length - 1].count} из {FUNNEL[0].count}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 9, color: 'var(--pc-text-muted)', lineHeight: 1.5 }}>
        Воронка на демо-данных. Реальные цифры зависят от live-трафика платформы.
      </div>
    </div>
  );
}

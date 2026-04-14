'use client';

import * as React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';

const monthlyDeals = [
  { month: 'Янв', deals: 12, revenue: 45 },
  { month: 'Фев', deals: 18, revenue: 67 },
  { month: 'Мар', deals: 24, revenue: 91 },
  { month: 'Апр', deals: 31, revenue: 118 },
];

const dealsByStatus = [
  { name: 'Закрыта',   value: 24, color: '#0A7A5F' },
  { name: 'В пути',    value: 5,  color: '#0B6B9A' },
  { name: 'Спор',      value: 2,  color: '#DC2626' },
  { name: 'Прочие',    value: 4,  color: '#D97706' },
];

const topCounterparties = [
  { name: 'Агрохолдинг СК',      deals: 8, volume: 38.4 },
  { name: 'ЗАО МелькомбинатЮг',  deals: 5, volume: 22.1 },
  { name: 'МаслоПресс ООО',      deals: 4, volume: 17.2 },
  { name: 'Экспортёр Юг',        deals: 3, volume: 43.5 },
  { name: 'КомбикормЦентр',      deals: 3, volume: 12.6 },
];

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419', marginTop: 8, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{sub}</div>
    </div>
  );
}

export default function AnalyticsV7RPage() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', margin: 0, borderLeft: '4px solid #0A7A5F', paddingLeft: 12 }}>Сводка руководителя</h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4, paddingLeft: 16 }}>Executive view по исполнению сделок, обороту и спорности</p>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <Kpi label="Спорность" value="8%" sub="Снизилась с 12% в марте ✅" />
        <Kpi label="Средний чек" value="4,2 млн ₽" sub="Средний размер сделки" />
        <Kpi label="Скорость закрытия" value="8,3 дн." sub="Среднее от контракта до расчёта" />
        <Kpi label="Сделок в апреле" value="31" sub="Пик по текущему ряду" />
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Сделки по месяцам</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyDeals} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B778C' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B778C' }} />
              <Tooltip formatter={(v: number) => [`${v} сделок`, '']} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Bar dataKey="deals" fill="#0A7A5F" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Оборот по месяцам, млн ₽</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyDeals} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F5" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B778C' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B778C' }} />
              <Tooltip formatter={(v: number) => [`${v} млн ₽`, '']} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" stroke="#0B6B9A" strokeWidth={2.5} dot={{ r: 4, fill: '#0B6B9A' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie + Table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Распределение по статусам</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={dealsByStatus} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                  {dealsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, name: string) => [`${v} сделок`, name]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gap: 8 }}>
              {dealsByStatus.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#374151' }}>{s.name}: <strong>{s.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Топ-5 контрагентов</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Контрагент', 'Сделок', 'Объём, млн ₽'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700, color: '#6B778C', textAlign: 'left', textTransform: 'uppercase', borderBottom: '1px solid #E4E6EA' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topCounterparties.map((c, i) => (
                <tr key={c.name} style={{ borderBottom: i < topCounterparties.length - 1 ? '1px solid #F1F3F5' : 'none' }}>
                  <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '10px 8px', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{c.deals}</td>
                  <td style={{ padding: '10px 8px', fontSize: 13, fontWeight: 700, textAlign: 'right', color: '#0A7A5F' }}>{c.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Тренды */}
      <div style={{ padding: '14px 18px', borderRadius: 16, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.14)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>📈</span>
        <div style={{ fontSize: 13, color: '#374151' }}>
          <strong>Тренды:</strong> спорность снизилась с 12% (март) до 8% (апрель) ✅ · оборот +30% месяц к месяцу · среднее время закрытия −0,7 дня
        </div>
      </div>
    </div>
  );
}

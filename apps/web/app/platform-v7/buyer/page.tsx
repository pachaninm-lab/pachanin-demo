'use client';
import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { KpiCard } from '@/components/v9/cards/KpiCard';
import { useSessionStore } from '@/stores/useSessionStore';
import { toast } from 'sonner';

// Price history data — wheat grade 4 class
const priceHistory = [
  { month: 'Окт', price: 14200, avg: 13800 },
  { month: 'Ноя', price: 13900, avg: 13800 },
  { month: 'Дек', price: 14100, avg: 13900 },
  { month: 'Янв', price: 14500, avg: 14000 },
  { month: 'Фев', price: 14800, avg: 14100 },
  { month: 'Мар', price: 15200, avg: 14200 },
  { month: 'Апр', price: 15600, avg: 14300 },
];

const currentPrice = 15600;
const marketAvg = 14300;
const delta = ((currentPrice - marketAvg) / marketAvg * 100).toFixed(1);
const isAboveMarket = currentPrice > marketAvg;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 6, padding: '8px 12px', fontSize: 12, boxShadow: '0 2px 8px rgba(9,30,66,0.12)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.dataKey === 'price' ? '#0A7A5F' : '#6B778C' }}>
          {p.dataKey === 'price' ? 'Цена сделки' : 'Ср. рынок'}: {p.value.toLocaleString('ru-RU')} ₽/т
        </div>
      ))}
    </div>
  );
}

export default function BuyerPage() {
  useSessionStore(s => s.demoMode);
  const { data, isLoading } = useQuery<{ data: Array<{id:string;grain:string;quantity:number;unit:string;reservedAmount:number;holdAmount:number;riskScore:number;dispute:{id:string}|null;status:string}> }>({
    queryKey: ['deals'],
    queryFn: () => fetch('/api/deals').then(r => r.json()),
  });

  const deals = data?.data ?? [];
  const myDeals = deals.filter(d => d.riskScore > 0).slice(0, 6);
  const totalBudget = myDeals.reduce((s, d) => s + d.reservedAmount, 0);
  const onHold = myDeals.reduce((s, d) => s + d.holdAmount, 0);
  const inDispute = myDeals.filter(d => d.dispute).length;

  const [activeShortlist, setActiveShortlist] = React.useState<string[]>(['DL-9104', 'DL-9107']);

  const toggleShortlist = (id: string) => {
    const wasIn = activeShortlist.includes(id);
    setActiveShortlist(prev => wasIn ? prev.filter(x => x !== id) : [...prev, id]);
    toast.success(wasIn ? `${id} удалён из шортлиста` : `${id} добавлен в шортлист`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ borderLeft: '4px solid #0284C7', paddingLeft: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F1419', margin: 0 }}>Воркспейс покупателя</h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>Shortlist, ценовая аналитика и контроль качества сделки</p>
      </div>

      {/* KPI bento */}
      <div className="v9-bento">
        <KpiCard title="Бюджет зарезервирован" value={isLoading ? '—' : `${(totalBudget/1_000_000).toFixed(1)} млн ₽`} loading={isLoading} tone="neutral" />
        <KpiCard title="Под hold" value={isLoading ? '—' : `${(onHold/1_000).toFixed(0)} тыс. ₽`} loading={isLoading} tone={onHold > 0 ? 'danger' : 'success'} />
        <KpiCard title="Споры" value={isLoading ? '—' : String(inDispute)} loading={isLoading} tone={inDispute > 0 ? 'warning' : 'success'} />
        <KpiCard title="Активных сделок" value={isLoading ? '—' : String(myDeals.length)} loading={isLoading} tone="neutral" />
      </div>

      {/* Price analytics */}
      <section className="v9-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Ценовая аналитика · Пшеница 4 кл.</h2>
            <p style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>Динамика цен сделки vs средний рынок (₽/т)</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isAboveMarket ? <TrendingUp size={14} color="#DC2626" /> : <TrendingDown size={14} color="#0A7A5F" />}
            <span style={{ fontSize: 12, fontWeight: 700, color: isAboveMarket ? '#DC2626' : '#0A7A5F' }}>
              {isAboveMarket ? '+' : ''}{delta}% vs рынок
            </span>
          </div>
        </div>

        <div style={{ height: 200, marginBottom: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceHistory} margin={{ top: 4, right: 24, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0A7A5F" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0A7A5F" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6B778C" stopOpacity={0.08} />
                  <stop offset="95%" stopColor="#6B778C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F7" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B778C' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6B778C' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={marketAvg} stroke="#6B778C" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="avg" stroke="#6B778C" strokeWidth={1} fill="url(#avgGrad)" dot={false} name="Ср. рынок" />
              <Area type="monotone" dataKey="price" stroke="#0A7A5F" strokeWidth={2} fill="url(#priceGrad)" dot={{ r: 3, fill: '#0A7A5F' }} activeDot={{ r: 5 }} name="Цена сделки" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderTop: '1px solid #E4E6EA' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Цена в контракте</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0A7A5F' }}>{currentPrice.toLocaleString('ru-RU')} ₽/т</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Средний рынок (апр)</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#495057' }}>{marketAvg.toLocaleString('ru-RU')} ₽/т</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#6B778C' }}>Переплата на объём</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>
              +{((currentPrice - marketAvg) * 200 / 1000).toFixed(0)} тыс. ₽
            </div>
            <div style={{ fontSize: 10, color: '#6B778C' }}>на 200 т</div>
          </div>
        </div>
      </section>

      {/* Shortlist */}
      <section className="v9-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Shortlist лотов</h2>
          <Badge variant="neutral">{activeShortlist.length} в шортлисте</Badge>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { id: 'DL-9104', grain: 'Кукуруза 1 кл.', qty: 150, price: 12800, quality: 98, origin: 'Ростовская обл.' },
            { id: 'DL-9107', grain: 'Подсолнечник', qty: 80, price: 31000, quality: 96, origin: 'Краснодарский кр.' },
            { id: 'DL-9109', grain: 'Пшеница 3 кл.', qty: 300, price: 16200, quality: 94, origin: 'Ставропольский кр.' },
            { id: 'DL-9111', grain: 'Ячмень 2 кл.', qty: 120, price: 11500, quality: 97, origin: 'Воронежская обл.' },
          ].map(lot => {
            const inList = activeShortlist.includes(lot.id);
            return (
              <div key={lot.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: inList ? 'rgba(10,122,95,0.04)' : '#FAFAFA', borderRadius: 6, border: `1px solid ${inList ? 'rgba(10,122,95,0.2)' : '#E4E6EA'}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, fontWeight: 700, color: '#0A7A5F' }}>{lot.id}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{lot.grain}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>
                    {lot.qty} т · {lot.price.toLocaleString('ru-RU')} ₽/т · {lot.origin} · Кач. {lot.quality}%
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => toggleShortlist(lot.id)}
                    style={{
                      padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      background: inList ? 'rgba(10,122,95,0.1)' : '#F4F5F7',
                      color: inList ? '#0A7A5F' : '#6B778C',
                    }}
                  >
                    {inList ? '★ В шортлисте' : '☆ Добавить'}
                  </button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/platform-v7/deals/${lot.id}`}>→</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Action required */}
      <section className="v9-card" style={{ background: 'rgba(220,38,38,0.03)', border: '1px solid rgba(220,38,38,0.15)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={16} color="#DC2626" style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>DL-9102 · Подтвердить частичный release 70%</div>
            <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Лаб-результат получен · Спор DK-2024-89 · Hold 624 000 ₽</div>
          </div>
          <Button variant="primary" size="sm" asChild>
            <Link href="/platform-v7/deals/DL-9102">Перейти →</Link>
          </Button>
        </div>
      </section>

      {/* My deals */}
      <section className="v9-card">
        <h2 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Мои сделки</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myDeals.map(deal => (
            <Link key={deal.id} href={`/platform-v7/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#FAFAFA', borderRadius: 6, border: '1px solid #E4E6EA' }}>
              <div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>{deal.id}</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2, color: '#495057' }}>{deal.grain} · {deal.quantity} {deal.unit}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {deal.dispute && <Badge variant="danger" dot>Спор</Badge>}
                {deal.holdAmount > 0 && <Badge variant="danger">{(deal.holdAmount/1000).toFixed(0)} тыс. удерж.</Badge>}
                <span style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 700 }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

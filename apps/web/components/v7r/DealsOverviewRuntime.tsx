'use client';

import * as React from 'react';
import Link from 'next/link';
import { DEALS, type Deal } from '@/lib/v7r/data';
import { formatCompactMoney, formatMoney, statusLabel } from '@/lib/v7r/helpers';
import { useBuyerRuntimeStore } from '@/stores/useBuyerRuntimeStore';

function palette(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warning') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  if (tone === 'danger') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { bg: '#F8FAFB', border: '#E4E6EA', color: '#475569' };
}

function Badge({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral'; children: React.ReactNode }) {
  const p = palette(tone);
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 11, fontWeight: 800 }}>{children}</span>;
}

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 8 }}>{note}</div>
    </section>
  );
}

function toneByDealStatus(item: Deal) {
  if (item.status === 'quality_disputed') return 'danger' as const;
  if (item.status === 'in_transit' || item.status === 'payment_reserved' || item.status === 'release_requested') return 'warning' as const;
  return 'success' as const;
}

function riskTone(score: number) {
  if (score >= 70) return 'danger' as const;
  if (score >= 30) return 'warning' as const;
  return 'success' as const;
}

export function DealsOverviewRuntime() {
  const { draftDeals, removeDraftDeal } = useBuyerRuntimeStore();
  const highRisk = DEALS.filter((item) => item.riskScore >= 70).length;
  const releaseRequested = DEALS.filter((item) => item.status === 'release_requested').length;
  const activeDeals = DEALS.filter((item) => item.status !== 'closed').length;
  const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [riskFilter, setRiskFilter] = React.useState('');

  const filteredDeals = DEALS.filter((item) => {
    const statusOk = !statusFilter || item.status === statusFilter;
    const riskOk = !riskFilter || (riskFilter === 'high' ? item.riskScore >= 70 : riskFilter === 'medium' ? item.riskScore >= 30 && item.riskScore < 70 : item.riskScore < 30);
    return statusOk && riskOk;
  });

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Сделки</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>Табличный операционный обзор. Здесь уже видно lot → deal → route и денежный контур без разрывов между экранами.</div>
          </div>
          <Link href='/platform-v7/procurement' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700 }}>Открыть закупку</Link>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Сделки в реестре' value={String(DEALS.length)} note='Все доменные сделки текущего контура.' />
        <StatCard title='Активные' value={String(activeDeals)} note='Без закрытых архивных кейсов.' />
        <StatCard title='Высокий риск' value={String(highRisk)} note='Сделки с risk ≥ 70.' />
        <StatCard title='В резерве' value={formatCompactMoney(totalReserved)} note='Деньги по активным сделкам.' />
      </div>

      {draftDeals.length ? (
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Draft-сделки</div>
          {draftDeals.map((item) => (
            <section key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>{item.grain} · {item.volume} т</div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{item.region} · {item.sellerName} → {item.buyerName}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge tone='neutral'>{item.sourceType}</Badge>
                  <Badge tone='warning'>{item.status}</Badge>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.nextStep}</div></div>
                <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Деньги и документы</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>Резерв: {item.reserveState} · Документы: {item.docsState}</div></div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href={`/platform-v7/deal-drafts/${item.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700 }}>Открыть draft</Link>
                <button onClick={() => removeDraftDeal(item.id)} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Удалить</button>
              </div>
            </section>
          ))}
        </section>
      ) : null}

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 16, borderBottom: '1px solid #E4E6EA', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Операционная таблица сделок</div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6B778C' }}>Сортировка по риску и сумме, явные lot/route поля и быстрый переход в карточку.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', fontSize: 12 }}>
              <option value=''>Все статусы</option>
              <option value='quality_disputed'>Есть спор</option>
              <option value='in_transit'>В пути</option>
              <option value='release_requested'>Ожидает выпуск</option>
              <option value='docs_complete'>Документы готовы</option>
            </select>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', fontSize: 12 }}>
              <option value=''>Все риски</option>
              <option value='high'>Высокий</option>
              <option value='medium'>Средний</option>
              <option value='low'>Низкий</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
            <thead>
              <tr style={{ background: '#F8FAFB', textAlign: 'left' }}>
                {['Сделка', 'Лот', 'Маршрут', 'Стороны', 'Сумма', 'Риск', 'Статус', 'Следующий шаг', 'Действие'].map((head) => (
                  <th key={head} style={{ padding: '12px 16px', borderBottom: '1px solid #E4E6EA', fontSize: 12, color: '#6B778C', fontWeight: 800 }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDeals
                .slice()
                .sort((a, b) => b.riskScore - a.riskScore || b.reservedAmount - a.reservedAmount)
                .map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #E4E6EA' }}>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{item.grain} · {item.quantity} {item.unit}</div>
                    </td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, color: '#0F1419' }}>{item.lotId ?? '—'}</div>
                    </td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, color: '#0F1419' }}>{item.routeId ?? '—'}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{item.routeState ?? 'Маршрут не назначен'} {item.routeEta ? `· ETA ${item.routeEta}` : ''}</div>
                    </td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontSize: 13, color: '#0F1419', fontWeight: 700 }}>{item.buyer.name}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{item.seller.name}</div>
                    </td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', fontWeight: 800, color: '#0F1419' }}>{formatMoney(item.reservedAmount)}</td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}><Badge tone={riskTone(item.riskScore)}>{item.riskScore}</Badge></td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}><Badge tone={toneByDealStatus(item)}>{statusLabel(item.status)}</Badge></td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>
                        {item.status === 'quality_disputed' ? 'Закрыть спор и снять hold' : item.status === 'release_requested' ? 'Подтвердить выпуск денег' : item.status === 'docs_complete' ? 'Запросить выпуск денег' : 'Довести до следующего шага'}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{item.blockers.length ? item.blockers.join(' · ') : 'Блокеров нет'}</div>
                    </td>
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <Link href={`/platform-v7/deals/${item.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 12, fontWeight: 700 }}>Открыть</Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

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

function nextStepLabel(item: Deal) {
  if (item.status === 'quality_disputed') return 'Закрыть спор и снять hold';
  if (item.status === 'release_requested') return 'Подтвердить выпуск денег';
  if (item.status === 'docs_complete') return 'Запросить выпуск денег';
  return 'Довести до следующего шага';
}

function MobileDealCard({ item, selected, onToggle }: { item: Deal; selected: boolean; onToggle: () => void }) {
  return (
    <article style={{ background: '#fff', border: selected ? '1px solid rgba(10,122,95,0.24)' : '1px solid #E4E6EA', borderRadius: 18, padding: 16, display: 'grid', gap: 12, boxShadow: selected ? '0 0 0 2px rgba(10,122,95,0.06) inset' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type='checkbox' aria-label={`Выбрать сделку ${item.id}`} checked={selected} onChange={onToggle} />
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 14 }}>{item.id}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6B778C' }}>{item.grain} · {item.quantity} {item.unit}</div>
          </div>
        </label>
        <Badge tone={toneByDealStatus(item)}>{statusLabel(item.status)}</Badge>
      </div>

      <Link href={`/platform-v7/deals/${item.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
          <InfoCell label='Лот' value={item.lotId ?? '—'} />
          <InfoCell label='Маршрут' value={item.routeId ?? '—'} />
          <InfoCell label='Сумма' value={formatCompactMoney(item.reservedAmount)} />
          <InfoCell label='Риск' value={String(item.riskScore)} tone={riskTone(item.riskScore)} />
        </div>

        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
          <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Стороны</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{item.buyer.name}</div>
          <div style={{ fontSize: 12, color: '#6B778C' }}>{item.seller.name}</div>
        </div>

        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 14, background: 'rgba(10,122,95,0.04)', border: '1px solid rgba(10,122,95,0.12)' }}>
          <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{nextStepLabel(item)}</div>
          <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.5 }}>{item.blockers.length ? item.blockers.join(' · ') : item.routeState ?? 'Критичных блокеров нет'}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: '#6B778C' }}>{item.routeState ?? 'Маршрут не назначен'}{item.routeEta ? ` · ETA ${item.routeEta}` : ''}</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#0A7A5F', color: '#fff', fontSize: 12, fontWeight: 800 }}>Открыть сделку</span>
        </div>
      </Link>
    </article>
  );
}

function InfoCell({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const p = tone ? palette(tone) : null;
  return (
    <div style={{ padding: 12, borderRadius: 14, background: '#fff', border: '1px solid #E4E6EA' }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: p ? p.color : '#0F1419' }}>{value}</div>
    </div>
  );
}

export function DealsOverviewRuntime() {
  const { draftDeals, removeDraftDeal } = useBuyerRuntimeStore();
  const highRisk = DEALS.filter((item) => item.riskScore >= 70).length;
  const releaseRequested = DEALS.filter((item) => item.status === 'release_requested').length;
  const activeDeals = DEALS.filter((item) => item.status !== 'closed').length;
  const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [riskFilter, setRiskFilter] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkToast, setBulkToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!bulkToast) return;
    const t = setTimeout(() => setBulkToast(null), 3500);
    return () => clearTimeout(t);
  }, [bulkToast]);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runBulkAction = (action: 'release' | 'dispute' | 'close') => {
    if (!selected.size) return;
    const ids = Array.from(selected).sort().join(', ');
    const label = action === 'release' ? `Запрошен выпуск денег по ${selected.size} сделкам` : action === 'dispute' ? `Открыты споры по ${selected.size} сделкам` : `Закрыты ${selected.size} сделок`;
    setBulkToast(`${label}: ${ids}`);
    setSelected(new Set());
  };

  const filteredDeals = DEALS.filter((item) => {
    const statusOk = !statusFilter || item.status === statusFilter;
    const riskOk = !riskFilter || (riskFilter === 'high' ? item.riskScore >= 70 : riskFilter === 'medium' ? item.riskScore >= 30 && item.riskScore < 70 : item.riskScore < 30);
    const q = search.trim().toLowerCase();
    const searchOk = !q || [item.id, item.grain, item.seller.name, item.buyer.name, item.lotId ?? '', item.routeId ?? ''].some((field) => field.toLowerCase().includes(q));
    return statusOk && riskOk && searchOk;
  });

  const orderedDeals = filteredDeals
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore || b.reservedAmount - a.reservedAmount);

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <style>{`
        .deals-desktop-table{display:block}
        .deals-mobile-cards{display:none}
        @media (max-width: 860px){
          .deals-desktop-table{display:none}
          .deals-mobile-cards{display:grid;gap:12px;padding:12px}
        }
      `}</style>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Сделки</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>Операционный обзор сделок. На телефоне — карточки с полным контекстом, на широком экране — таблица для массовой работы.</div>
          </div>
          <Link href='/platform-v7/procurement' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700 }}>Открыть закупку</Link>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Сделки в реестре' value={String(DEALS.length)} note='Все доменные сделки текущего контура.' />
        <StatCard title='Активные' value={String(activeDeals)} note='Без закрытых архивных кейсов.' />
        <StatCard title='Высокий риск' value={String(highRisk)} note='Сделки с risk ≥ 70.' />
        <StatCard title='Ожидают выпуск' value={String(releaseRequested)} note='Сделки, где деньги уже у выпуска.' />
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
        {selected.size ? (
          <div role='toolbar' aria-label='Массовые действия по сделкам' style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E4E6EA', background: 'rgba(10,122,95,0.06)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0A7A5F' }}>{selected.size} выбрано</span>
            <button onClick={() => runBulkAction('release')} style={{ padding: '8px 12px', borderRadius: 10, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Запросить выпуск</button>
            <button onClick={() => runBulkAction('dispute')} style={{ padding: '8px 12px', borderRadius: 10, background: '#fff', border: '1px solid rgba(220,38,38,0.3)', color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Открыть спор</button>
            <button onClick={() => runBulkAction('close')} style={{ padding: '8px 12px', borderRadius: 10, background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Закрыть сделки</button>
            <button onClick={() => setSelected(new Set())} style={{ padding: '8px 12px', borderRadius: 10, background: 'transparent', border: '1px solid #E4E6EA', color: '#6B778C', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>Сбросить выбор</button>
          </div>
        ) : null}
        {bulkToast ? (
          <div role='status' aria-live='polite' style={{ padding: '10px 16px', background: 'rgba(10,122,95,0.08)', borderBottom: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 700 }}>{bulkToast}</div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 16, borderBottom: '1px solid #E4E6EA', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Операционный обзор сделок</div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6B778C' }}>Каждая сделка полностью кликабельна. На мобиле внутри карточки уже есть деньги, маршрут, риск, следующий шаг и переход внутрь.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Поиск: DL-9102, Тамбов, Агро-Юг…' aria-label='Поиск по сделкам' style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', fontSize: 12, minWidth: 220 }} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label='Фильтр по статусу' style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', fontSize: 12 }}>
              <option value=''>Все статусы</option>
              <option value='quality_disputed'>Есть спор</option>
              <option value='in_transit'>В пути</option>
              <option value='release_requested'>Ожидает выпуск</option>
              <option value='docs_complete'>Документы готовы</option>
            </select>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} aria-label='Фильтр по риску' style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', fontSize: 12 }}>
              <option value=''>Все риски</option>
              <option value='high'>Высокий</option>
              <option value='medium'>Средний</option>
              <option value='low'>Низкий</option>
            </select>
            {search || statusFilter || riskFilter ? (
              <button onClick={() => { setSearch(''); setStatusFilter(''); setRiskFilter(''); }} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', fontSize: 12, fontWeight: 700, color: '#6B778C', cursor: 'pointer' }}>Сбросить</button>
            ) : null}
            <span style={{ fontSize: 11, color: '#6B778C', marginLeft: 'auto' }}>{orderedDeals.length} из {DEALS.length}</span>
          </div>
        </div>

        <div className='deals-mobile-cards'>
          {orderedDeals.map((item) => (
            <MobileDealCard key={item.id} item={item} selected={selected.has(item.id)} onToggle={() => toggleRow(item.id)} />
          ))}
        </div>

        <div className='deals-desktop-table' style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
            <thead>
              <tr style={{ background: '#F8FAFB', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', borderBottom: '1px solid #E4E6EA', width: 44 }}>
                  <input
                    type='checkbox'
                    aria-label='Выбрать все сделки на странице'
                    checked={orderedDeals.length > 0 && orderedDeals.every((item) => selected.has(item.id))}
                    onChange={(event) => {
                      if (event.target.checked) setSelected(new Set(orderedDeals.map((item) => item.id)));
                      else setSelected(new Set());
                    }}
                  />
                </th>
                {['Сделка', 'Лот', 'Маршрут', 'Стороны', 'Сумма', 'Риск', 'Статус', 'Следующий шаг', 'Действие'].map((head) => (
                  <th key={head} style={{ padding: '12px 16px', borderBottom: '1px solid #E4E6EA', fontSize: 12, color: '#6B778C', fontWeight: 800 }}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orderedDeals.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #E4E6EA', background: selected.has(item.id) ? 'rgba(10,122,95,0.04)' : undefined }}>
                  <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                    <input type='checkbox' aria-label={`Выбрать сделку ${item.id}`} checked={selected.has(item.id)} onChange={() => toggleRow(item.id)} />
                  </td>
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{nextStepLabel(item)}</div>
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

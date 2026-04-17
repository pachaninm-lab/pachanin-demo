'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { lots as baseLots, type LotItem } from '@/lib/v7r/esia-fgis-data';
import { DEALS as LIVE_DEALS } from '@/lib/v7r/data';
import { useCommercialRuntimeStore } from '@/stores/useCommercialRuntimeStore';

function palette(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warning') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  if (tone === 'danger') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { bg: '#F8FAFB', border: '#E4E6EA', color: '#475569' };
}

function toneByState(state: LotItem['readiness']['state']) {
  if (state === 'PASS') return 'success' as const;
  if (state === 'REVIEW') return 'warning' as const;
  return 'danger' as const;
}

function Badge({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral'; children: React.ReactNode }) {
  const p = palette(tone);
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 11, fontWeight: 800 }}>{children}</span>;
}

function ClickableStatCard({ title, value, note, active, onClick }: { title: string; value: string; note: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', background: active ? 'rgba(10,122,95,0.06)' : '#fff', border: active ? '1px solid rgba(10,122,95,0.18)' : '1px solid #E4E6EA', borderRadius: 18, padding: 18, cursor: 'pointer' }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 8 }}>{note}</div>
    </button>
  );
}

export function SellerLotsRuntimeV2() {
  const router = useRouter();
  const { manualLots } = useCommercialRuntimeStore();
  const [sourceFilter, setSourceFilter] = React.useState<'ALL' | 'FGIS' | 'MANUAL'>('ALL');
  const [stateFilter, setStateFilter] = React.useState<'ALL' | 'PASS' | 'REVIEW' | 'FAIL'>('ALL');
  const [search, setSearch] = React.useState('');

  const mergedLots = React.useMemo(() => [...manualLots, ...baseLots], [manualLots]);
  const filteredLots = mergedLots.filter((item) => {
    const sourceOk = sourceFilter === 'ALL' ? true : item.sourceType === sourceFilter;
    const stateOk = stateFilter === 'ALL' ? true : item.readiness.state === stateFilter;
    const q = search.trim().toLowerCase();
    const searchOk = !q || [item.id, item.title, item.grain, item.sourceReference ?? ''].some((field) => field.toLowerCase().includes(q));
    return sourceOk && stateOk && searchOk;
  });

  const passCount = mergedLots.filter((item) => item.readiness.state === 'PASS').length;
  const reviewCount = mergedLots.filter((item) => item.readiness.state === 'REVIEW').length;
  const failCount = mergedLots.filter((item) => item.readiness.state === 'FAIL').length;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419' }}>Лоты продавца</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>
              Лот больше не висит отдельно. Если по нему уже создана сделка, это видно прямо в списке и в карточке лота.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/lots/create' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700 }}>Создать лот</Link>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <ClickableStatCard title='Всего лотов' value={String(mergedLots.length)} note='Все видимые лоты текущего контура.' active={stateFilter === 'ALL'} onClick={() => setStateFilter('ALL')} />
        <ClickableStatCard title='Готовы к движению' value={String(passCount)} note='Можно идти в переговоры без ручного gate.' active={stateFilter === 'PASS'} onClick={() => setStateFilter('PASS')} />
        <ClickableStatCard title='Нужна проверка' value={String(reviewCount)} note='Есть manual- или документные блокеры.' active={stateFilter === 'REVIEW'} onClick={() => setStateFilter('REVIEW')} />
        <ClickableStatCard title='Жёсткий стоп' value={String(failCount)} note='Gate FAIL, движение дальше запрещено.' active={stateFilter === 'FAIL'} onClick={() => setStateFilter('FAIL')} />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Поиск: LOT-2401, пшеница, FGIS-PARTY-…' aria-label='Поиск по лотам' style={{ flex: '1 1 240px', minWidth: 200, padding: '10px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', fontSize: 13 }} />
          {search ? (
            <button onClick={() => setSearch('')} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #E4E6EA', background: '#fff', fontSize: 12, fontWeight: 700, color: '#6B778C', cursor: 'pointer' }}>Сбросить поиск</button>
          ) : null}
          <span style={{ fontSize: 11, color: '#6B778C', marginLeft: 'auto' }}>{filteredLots.length} из {mergedLots.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['ALL', 'Все источники'],
            ['FGIS', 'FGIS'],
            ['MANUAL', 'MANUAL'],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setSourceFilter(value as 'ALL' | 'FGIS' | 'MANUAL')} style={{ borderRadius: 999, padding: '10px 12px', border: sourceFilter === value ? '1px solid rgba(10,122,95,0.16)' : '1px solid #E4E6EA', background: sourceFilter === value ? 'rgba(10,122,95,0.08)' : '#fff', color: sourceFilter === value ? '#0A7A5F' : '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
          ))}
          {[
            ['ALL', 'Все состояния'],
            ['PASS', 'PASS'],
            ['REVIEW', 'REVIEW'],
            ['FAIL', 'FAIL'],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setStateFilter(value as 'ALL' | 'PASS' | 'REVIEW' | 'FAIL')} style={{ borderRadius: 999, padding: '10px 12px', border: stateFilter === value ? '1px solid rgba(10,122,95,0.16)' : '1px solid #E4E6EA', background: stateFilter === value ? 'rgba(10,122,95,0.08)' : '#fff', color: stateFilter === value ? '#0A7A5F' : '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gap: 12 }}>
        {filteredLots.map((item) => {
          const tone = toneByState(item.readiness.state);
          const linkedDeal = LIVE_DEALS.find((deal) => deal.lotId === item.id);
          return (
            <div key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{item.grain} · {item.volumeTons} т · {item.sourceReference ?? 'Ручной контур без внешнего reference'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge tone={item.sourceType === 'FGIS' ? 'warning' : 'neutral'}>{item.sourceType}</Badge>
                  <Badge tone={tone}>{item.readiness.state}</Badge>
                  {linkedDeal ? <Badge tone='success'>{linkedDeal.id}</Badge> : <Badge tone='neutral'>Без сделки</Badge>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                  <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.readiness.nextStep ?? '—'}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                  <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Владелец / связка</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.readiness.nextOwner ?? '—'}{linkedDeal ? ` · ${linkedDeal.routeId ?? 'маршрут не задан'}` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => router.push(`/platform-v7/lots/${item.id}`)} style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Открыть карточку лота</button>
                {linkedDeal ? <Link href={`/platform-v7/deals/${linkedDeal.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Открыть сделку</Link> : <Link href='/platform-v7/procurement' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Создать сделку</Link>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

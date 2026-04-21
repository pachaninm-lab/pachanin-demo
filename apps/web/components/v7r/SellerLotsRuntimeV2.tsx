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

type ViewPreset = 'all' | 'ready' | 'review' | 'fgis';

export function SellerLotsRuntimeV2() {
  const router = useRouter();
  const { manualLots, clearManualLots, favouriteLotIds, toggleFavouriteLot, compareLotIds, toggleCompareLot, clearCompareLots } = useCommercialRuntimeStore();
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  const [compareToast, setCompareToast] = React.useState<string | null>(null);
  const [bulkToast, setBulkToast] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [viewPreset, setViewPreset] = React.useState<ViewPreset>('all');

  React.useEffect(() => {
    if (!compareToast) return;
    const t = setTimeout(() => setCompareToast(null), 3000);
    return () => clearTimeout(t);
  }, [compareToast]);

  React.useEffect(() => {
    if (!bulkToast) return;
    const t = setTimeout(() => setBulkToast(null), 3500);
    return () => clearTimeout(t);
  }, [bulkToast]);

  const [sourceFilter, setSourceFilter] = React.useState<'ALL' | 'FGIS' | 'MANUAL'>('ALL');
  const [stateFilter, setStateFilter] = React.useState<'ALL' | 'PASS' | 'REVIEW' | 'FAIL'>('ALL');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    if (viewPreset === 'ready') {
      setSourceFilter('ALL');
      setStateFilter('PASS');
      return;
    }
    if (viewPreset === 'review') {
      setSourceFilter('ALL');
      setStateFilter('REVIEW');
      return;
    }
    if (viewPreset === 'fgis') {
      setSourceFilter('FGIS');
      setStateFilter('ALL');
      return;
    }
    setSourceFilter('ALL');
    setStateFilter('ALL');
  }, [viewPreset]);

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

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulkAction = (action: 'favorite' | 'compare' | 'hide') => {
    if (!selected.size) return;
    const ids = Array.from(selected).sort();
    if (action === 'favorite') {
      ids.forEach((id) => {
        if (!favouriteLotIds.includes(id)) toggleFavouriteLot(id);
      });
      setBulkToast(`Добавлено в избранное: ${ids.join(', ')}`);
    }
    if (action === 'compare') {
      ids.slice(0, 3).forEach((id) => {
        if (!compareLotIds.includes(id)) {
          const result = toggleCompareLot(id);
          if (!result.ok && result.reason === 'limit') setCompareToast('Сравнить можно максимум 3 лота. Уберите один перед добавлением нового.');
        }
      });
      setBulkToast(`Отправлено в сравнение: ${ids.slice(0, 3).join(', ')}`);
    }
    if (action === 'hide') {
      setBulkToast(`Скрытие подготовлено: ${ids.join(', ')}`);
    }
    setSelected(new Set());
  };

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
            {devMode && manualLots.length ? (
              <button
                onClick={() => {
                  if (window.confirm(`Удалить ${manualLots.length} manual-лотов из витрины?`)) clearManualLots();
                }}
                aria-label='Очистить manual-лоты (dev-режим)'
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px dashed rgba(220,38,38,0.4)', color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                DEV · Очистить manual-лоты ({manualLots.length})
              </button>
            ) : null}
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

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { id: 'all', label: 'Все лоты' },
            { id: 'ready', label: 'Готовы к движению' },
            { id: 'review', label: 'Нужна проверка' },
            { id: 'fgis', label: 'Только FGIS' },
          ].map((preset) => (
            <button key={preset.id} onClick={() => setViewPreset(preset.id as ViewPreset)} style={{ padding: '8px 12px', borderRadius: 999, border: `1px solid ${viewPreset === preset.id ? 'rgba(10,122,95,0.18)' : '#E4E6EA'}`, background: viewPreset === preset.id ? 'rgba(10,122,95,0.08)' : '#fff', color: viewPreset === preset.id ? '#0A7A5F' : '#475569', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{preset.label}</button>
          ))}
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

      {selected.size ? (
        <section style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', borderRadius: 18, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.18)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0A7A5F' }}>{selected.size} выбрано</span>
          <button onClick={() => runBulkAction('favorite')} style={{ padding: '8px 12px', borderRadius: 10, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>В избранное</button>
          <button onClick={() => runBulkAction('compare')} style={{ padding: '8px 12px', borderRadius: 10, background: '#fff', border: '1px solid rgba(37,99,235,0.3)', color: '#2563EB', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Сравнить</button>
          <button onClick={() => runBulkAction('hide')} style={{ padding: '8px 12px', borderRadius: 10, background: '#fff', border: '1px solid #E4E6EA', color: '#6B778C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Скрыть</button>
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 10, background: 'transparent', border: '1px solid #E4E6EA', color: '#6B778C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Сбросить выбор</button>
        </section>
      ) : null}

      {compareLotIds.length ? (
        <section aria-label='Сравнение лотов' style={{ background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.18)', borderRadius: 18, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#2563EB' }}>Сравнение · {compareLotIds.length} из 3</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={clearCompareLots} style={{ borderRadius: 10, padding: '6px 10px', background: '#fff', border: '1px solid #E4E6EA', color: '#6B778C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Очистить</button>
            </div>
          </div>
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#fff' }}>
                  <th style={{ padding: '10px 12px', fontSize: 11, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Параметр</th>
                  {compareLotIds.map((id) => {
                    const l = mergedLots.find((item) => item.id === id);
                    return <th key={id} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 800, color: '#0F1419' }}>{l?.id ?? id}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Название', (l: typeof mergedLots[number]) => l.title],
                  ['Культура', (l: typeof mergedLots[number]) => l.grain],
                  ['Объём, т', (l: typeof mergedLots[number]) => String(l.volumeTons)],
                  ['Источник', (l: typeof mergedLots[number]) => l.sourceType],
                  ['Состояние', (l: typeof mergedLots[number]) => l.readiness.state],
                  ['Следующий шаг', (l: typeof mergedLots[number]) => l.readiness.nextStep ?? '—'],
                ].map(([label, getter]) => (
                  <tr key={label as string} style={{ borderTop: '1px solid #E4E6EA' }}>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#6B778C', fontWeight: 700 }}>{label as string}</td>
                    {compareLotIds.map((id) => {
                      const l = mergedLots.find((item) => item.id === id);
                      return <td key={`${label}-${id}`} style={{ padding: '10px 12px', fontSize: 13, color: '#0F1419', fontWeight: 700 }}>{l ? (getter as (lot: typeof mergedLots[number]) => string)(l) : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {compareToast ? (
        <div role='status' aria-live='polite' style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 12, color: '#B91C1C', fontSize: 12, fontWeight: 700 }}>{compareToast}</div>
      ) : null}

      {bulkToast ? (
        <div role='status' aria-live='polite' style={{ padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 12, color: '#0A7A5F', fontSize: 12, fontWeight: 700 }}>{bulkToast}</div>
      ) : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {filteredLots.map((item) => {
          const tone = toneByState(item.readiness.state);
          const linkedDeal = LIVE_DEALS.find((deal) => deal.lotId === item.id);
          const isFavourite = favouriteLotIds.includes(item.id);
          const isCompared = compareLotIds.includes(item.id);
          const isSelected = selected.has(item.id);
          return (
            <div key={item.id} style={{ background: '#fff', border: isSelected ? '1px solid rgba(10,122,95,0.24)' : '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12, boxShadow: isSelected ? '0 0 0 2px rgba(10,122,95,0.06) inset' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <input type='checkbox' aria-label={`Выбрать лот ${item.id}`} checked={isSelected} onChange={() => toggleRow(item.id)} style={{ marginTop: 4 }} />
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{item.grain} · {item.volumeTons} т · {item.sourceReference ?? 'Ручной контур без внешнего reference'}</div>
                  </div>
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
                <button
                  onClick={() => toggleFavouriteLot(item.id)}
                  aria-pressed={isFavourite}
                  aria-label={isFavourite ? `Убрать лот ${item.id} из избранного` : `Добавить лот ${item.id} в избранное`}
                  style={{ borderRadius: 12, padding: '10px 12px', background: isFavourite ? 'rgba(217,119,6,0.08)' : '#fff', border: isFavourite ? '1px solid rgba(217,119,6,0.3)' : '1px solid #E4E6EA', color: isFavourite ? '#B45309' : '#6B778C', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  {isFavourite ? '★ В избранном' : '☆ В избранное'}
                </button>
                <button
                  onClick={() => {
                    const result = toggleCompareLot(item.id);
                    if (!result.ok && result.reason === 'limit') setCompareToast('Сравнить можно максимум 3 лота. Уберите один перед добавлением нового.');
                  }}
                  aria-pressed={isCompared}
                  aria-label={isCompared ? `Убрать лот ${item.id} из сравнения` : `Добавить лот ${item.id} в сравнение`}
                  style={{ borderRadius: 12, padding: '10px 12px', background: isCompared ? 'rgba(37,99,235,0.08)' : '#fff', border: isCompared ? '1px solid rgba(37,99,235,0.3)' : '1px solid #E4E6EA', color: isCompared ? '#2563EB' : '#6B778C', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  {isCompared ? '− Из сравнения' : '+ Сравнить'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

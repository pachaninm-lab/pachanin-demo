'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { lots as baseLots, type LotItem } from '@/lib/v7r/esia-fgis-data';
import { selectRuntimeDealByLotId } from '@/lib/domain/selectors';
import { useCommercialRuntimeStore } from '@/stores/useCommercialRuntimeStore';

const SURFACE = 'var(--pc-bg-card)';
const SURFACE_SOFT = 'var(--pc-bg-elevated)';
const BORDER = 'var(--pc-border)';
const TEXT = 'var(--pc-text-primary)';
const MUTED = 'var(--pc-text-secondary)';
const ACCENT = 'var(--pc-accent-strong)';
const ACCENT_BG = 'var(--pc-accent-bg)';
const ACCENT_BORDER = 'var(--pc-accent-border)';
const WARNING_BG = 'rgba(245,180,30,0.10)';
const WARNING_BORDER = 'rgba(245,180,30,0.20)';
const WARNING_TEXT = '#F5B41E';
const DANGER_BG = 'rgba(255,139,144,0.10)';
const DANGER_BORDER = 'rgba(255,139,144,0.20)';
const DANGER_TEXT = '#FF8B90';

function palette(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return { bg: ACCENT_BG, border: ACCENT_BORDER, color: ACCENT };
  if (tone === 'warning') return { bg: WARNING_BG, border: WARNING_BORDER, color: WARNING_TEXT };
  if (tone === 'danger') return { bg: DANGER_BG, border: DANGER_BORDER, color: DANGER_TEXT };
  return { bg: SURFACE_SOFT, border: BORDER, color: MUTED };
}

function toneByState(state: LotItem['readiness']['state']) {
  if (state === 'PASS') return 'success' as const;
  if (state === 'REVIEW') return 'warning' as const;
  return 'danger' as const;
}

function stateLabel(state: LotItem['readiness']['state']) {
  if (state === 'PASS') return 'ГОТОВ';
  if (state === 'REVIEW') return 'ПРОВЕРКА';
  return 'СТОП';
}

function sourceLabel(source: 'FGIS' | 'MANUAL') {
  return source === 'FGIS' ? 'ФГИС' : 'РУЧНОЙ';
}

function Badge({ tone, children }: { tone: 'success' | 'warning' | 'danger' | 'neutral'; children: React.ReactNode }) {
  const p = palette(tone);
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 9px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 11, fontWeight: 800 }}>{children}</span>;
}

function MetricCard({ title, value, note, active, onClick }: { title: string; value: string; note: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: active ? ACCENT_BG : SURFACE,
        border: `1px solid ${active ? ACCENT_BORDER : BORDER}`,
        borderRadius: 18,
        padding: 18,
        cursor: 'pointer',
        minWidth: 0,
        color: TEXT,
      }}
    >
      <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: active ? ACCENT : TEXT, marginTop: 8, wordBreak: 'break-word' }}>{value}</div>
      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginTop: 8, wordBreak: 'break-word' }}>{note}</div>
    </button>
  );
}

type ViewPreset = 'all' | 'ready' | 'review' | 'fgis';

function pillStyle(active: boolean, tone: 'default' | 'accent' = 'default') {
  return {
    borderRadius: 999,
    padding: '9px 12px',
    border: `1px solid ${active ? tone === 'accent' ? ACCENT_BORDER : BORDER : BORDER}`,
    background: active ? tone === 'accent' ? ACCENT_BG : SURFACE_SOFT : SURFACE,
    color: active ? tone === 'accent' ? ACCENT : TEXT : MUTED,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
  } as const;
}

function actionButton(kind: 'primary' | 'default' | 'warning' = 'default') {
  if (kind === 'primary') return { borderRadius: 12, padding: '10px 14px', background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' } as const;
  if (kind === 'warning') return { borderRadius: 12, padding: '10px 14px', background: WARNING_BG, border: `1px solid ${WARNING_BORDER}`, color: WARNING_TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' } as const;
  return { borderRadius: 12, padding: '10px 14px', background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' } as const;
}

export function SellerLotsRuntimeV2() {
  const router = useRouter();
  const { manualLots, clearManualLots, favouriteLotIds, toggleFavouriteLot, compareLotIds, toggleCompareLot, clearCompareLots } = useCommercialRuntimeStore();
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  const [compareToast, setCompareToast] = React.useState<string | null>(null);
  const [bulkToast, setBulkToast] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [viewPreset, setViewPreset] = React.useState<ViewPreset>('all');
  const [sourceFilter, setSourceFilter] = React.useState<'ALL' | 'FGIS' | 'MANUAL'>('ALL');
  const [stateFilter, setStateFilter] = React.useState<'ALL' | 'PASS' | 'REVIEW' | 'FAIL'>('ALL');
  const [search, setSearch] = React.useState('');

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
    <div className='seller-lots-shell'>
      <style>{`
        .seller-lots-shell{display:grid;gap:18px;padding:8px 0;max-width:100%;overflow-x:hidden}
        .seller-lots-surface{background:${SURFACE};border:1px solid ${BORDER};border-radius:18px;padding:18px;min-width:0;overflow:hidden;color:${TEXT}}
        .seller-lots-top{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start}
        .seller-lots-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
        .seller-lots-toolbar{display:grid;gap:12px}
        .seller-lots-searchrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .seller-lots-pillrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .seller-lots-bulk{display:flex;gap:10px;align-items:center;padding:12px 16px;border-radius:18px;background:${ACCENT_BG};border:1px solid ${ACCENT_BORDER};flex-wrap:wrap}
        .seller-lots-compare{background:${SURFACE};border:1px solid ${BORDER};border-radius:18px;padding:16px;overflow:hidden}
        .seller-lots-grid{display:grid;gap:12px}
        .seller-lot-card{background:${SURFACE};border:1px solid ${BORDER};border-radius:18px;padding:18px;display:grid;gap:12px;min-width:0;overflow:hidden}
        .seller-lot-card.is-selected{border-color:${ACCENT_BORDER};box-shadow:0 0 0 2px rgba(126,242,196,0.08) inset}
        .seller-lot-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
        .seller-lot-head-main{display:flex;gap:10px;align-items:flex-start;min-width:0;flex:1 1 auto}
        .seller-lot-badges{display:flex;gap:8px;flex-wrap:wrap}
        .seller-lot-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .seller-lot-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
        .seller-lot-actions > *{min-width:0;min-height:48px;text-align:center;white-space:normal;word-break:break-word}
        @media (max-width: 900px){.seller-lot-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media (max-width: 680px){
          .seller-lots-surface{padding:16px;border-radius:16px}
          .seller-lots-top,.seller-lots-searchrow,.seller-lots-pillrow{display:grid}
          .seller-lots-searchrow > *, .seller-lots-pillrow > *{min-width:0}
          .seller-lots-searchrow span{margin-left:0 !important}
          .seller-lots-metrics{grid-template-columns:1fr}
          .seller-lots-bulk{display:grid}
          .seller-lots-bulk button,.seller-lots-bulk span{width:100%;margin-left:0 !important}
          .seller-lot-head{display:grid}
          .seller-lot-head-main{display:grid;grid-template-columns:24px 1fr;gap:10px}
          .seller-lot-stats{grid-template-columns:1fr}
          .seller-lot-actions{grid-template-columns:1fr}
        }
      `}</style>

      <section className='seller-lots-surface'>
        <div className='seller-lots-top'>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 900, color: TEXT, wordBreak: 'break-word' }}>Лоты продавца</div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>Лот и сделка не живут в двух разных мирах. Если по лоту уже создана сделка, это видно прямо в списке и в карточке лота.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/lots/create' style={actionButton('primary')}>Создать лот</Link>
            {devMode && manualLots.length ? (
              <button onClick={() => { if (window.confirm(`Удалить ${manualLots.length} ручных лотов из витрины?`)) clearManualLots(); }} aria-label='Очистить ручные лоты' style={actionButton('warning')}>DEV · Очистить ручные ({manualLots.length})</button>
            ) : null}
          </div>
        </div>
      </section>

      <div className='seller-lots-metrics'>
        <MetricCard title='Всего лотов' value={String(mergedLots.length)} note='Все видимые лоты текущего контура.' active={stateFilter === 'ALL'} onClick={() => setStateFilter('ALL')} />
        <MetricCard title='Готовы к движению' value={String(passCount)} note='Можно идти дальше без ручного стопа.' active={stateFilter === 'PASS'} onClick={() => setStateFilter('PASS')} />
        <MetricCard title='Нужна проверка' value={String(reviewCount)} note='Есть документные или ручные блокеры.' active={stateFilter === 'REVIEW'} onClick={() => setStateFilter('REVIEW')} />
        <MetricCard title='Жёсткий стоп' value={String(failCount)} note='Движение запрещено до снятия стоп-фактора.' active={stateFilter === 'FAIL'} onClick={() => setStateFilter('FAIL')} />
      </div>

      <section className='seller-lots-surface seller-lots-toolbar'>
        <div className='seller-lots-searchrow'>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Поиск: LOT-2401, пшеница, ФГИС…' aria-label='Поиск по лотам' style={{ flex: '1 1 240px', minWidth: 0, width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT, fontSize: 13 }} />
          {search ? <button onClick={() => setSearch('')} style={actionButton()}>Сбросить поиск</button> : null}
          <span style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>{filteredLots.length} из {mergedLots.length}</span>
        </div>

        <div className='seller-lots-pillrow'>
          {[
            { id: 'all', label: 'Все лоты' },
            { id: 'ready', label: 'Готовы к движению' },
            { id: 'review', label: 'Нужна проверка' },
            { id: 'fgis', label: 'Только ФГИС' },
          ].map((preset) => (
            <button key={preset.id} onClick={() => setViewPreset(preset.id as ViewPreset)} style={pillStyle(viewPreset === preset.id, 'accent')}>{preset.label}</button>
          ))}
        </div>

        <div className='seller-lots-pillrow'>
          {[
            ['ALL', 'Все источники'],
            ['FGIS', 'ФГИС'],
            ['MANUAL', 'Ручные'],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setSourceFilter(value as 'ALL' | 'FGIS' | 'MANUAL')} style={pillStyle(sourceFilter === value)}>{label}</button>
          ))}
          {[
            ['ALL', 'Все состояния'],
            ['PASS', 'Готов'],
            ['REVIEW', 'Проверка'],
            ['FAIL', 'Стоп'],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setStateFilter(value as 'ALL' | 'PASS' | 'REVIEW' | 'FAIL')} style={pillStyle(stateFilter === value)}>{label}</button>
          ))}
        </div>
      </section>

      {selected.size ? (
        <section className='seller-lots-bulk'>
          <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT }}>{selected.size} выбрано</span>
          <button onClick={() => runBulkAction('favorite')} style={actionButton('primary')}>В избранное</button>
          <button onClick={() => runBulkAction('compare')} style={actionButton()}>Сравнить</button>
          <button onClick={() => runBulkAction('hide')} style={actionButton()}>Скрыть</button>
          <button onClick={() => setSelected(new Set())} style={{ ...actionButton(), marginLeft: 'auto' }}>Сбросить выбор</button>
        </section>
      ) : null}

      {compareLotIds.length ? (
        <section aria-label='Сравнение лотов' className='seller-lots-compare'>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>Сравнение · {compareLotIds.length} из 3</div>
            <button onClick={clearCompareLots} style={actionButton()}>Очистить</button>
          </div>
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: 'left', background: SURFACE }}>
                  <th style={{ padding: '10px 12px', fontSize: 11, color: MUTED, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Параметр</th>
                  {compareLotIds.map((id) => {
                    const l = mergedLots.find((item) => item.id === id);
                    return <th key={id} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 800, color: TEXT }}>{l?.id ?? id}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Название', (l: typeof mergedLots[number]) => l.title],
                  ['Культура', (l: typeof mergedLots[number]) => l.grain],
                  ['Объём, т', (l: typeof mergedLots[number]) => String(l.volumeTons)],
                  ['Источник', (l: typeof mergedLots[number]) => sourceLabel(l.sourceType)],
                  ['Состояние', (l: typeof mergedLots[number]) => stateLabel(l.readiness.state)],
                  ['Следующий шаг', (l: typeof mergedLots[number]) => l.readiness.nextStep ?? '—'],
                ].map(([label, getter]) => (
                  <tr key={label as string} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: MUTED, fontWeight: 700 }}>{label as string}</td>
                    {compareLotIds.map((id) => {
                      const l = mergedLots.find((item) => item.id === id);
                      return <td key={`${label}-${id}`} style={{ padding: '10px 12px', fontSize: 13, color: TEXT, fontWeight: 700 }}>{l ? (getter as (lot: typeof mergedLots[number]) => string)(l) : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {compareToast ? <div role='status' aria-live='polite' style={{ padding: '10px 14px', background: DANGER_BG, border: `1px solid ${DANGER_BORDER}`, borderRadius: 12, color: DANGER_TEXT, fontSize: 12, fontWeight: 700 }}>{compareToast}</div> : null}
      {bulkToast ? <div role='status' aria-live='polite' style={{ padding: '10px 14px', background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 12, color: ACCENT, fontSize: 12, fontWeight: 700 }}>{bulkToast}</div> : null}

      <div className='seller-lots-grid'>
        {filteredLots.map((item) => {
          const tone = toneByState(item.readiness.state);
          const linkedDeal = selectRuntimeDealByLotId(item.id);
          const isFavourite = favouriteLotIds.includes(item.id);
          const isCompared = compareLotIds.includes(item.id);
          const isSelected = selected.has(item.id);
          return (
            <div key={item.id} className={`seller-lot-card${isSelected ? ' is-selected' : ''}`}>
              <div className='seller-lot-head'>
                <div className='seller-lot-head-main'>
                  <input type='checkbox' aria-label={`Выбрать лот ${item.id}`} checked={isSelected} onChange={() => toggleRow(item.id)} style={{ marginTop: 4, width: 20, height: 20, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: ACCENT, fontSize: 13, wordBreak: 'break-word' }}>{item.id}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, marginTop: 4, lineHeight: 1.3, wordBreak: 'break-word' }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.5, wordBreak: 'break-word' }}>{item.grain} · {item.volumeTons} т · {item.sourceReference ?? 'Ручной контур без внешнего reference'}</div>
                  </div>
                </div>
                <div className='seller-lot-badges'>
                  <Badge tone={item.sourceType === 'FGIS' ? 'warning' : 'neutral'}>{sourceLabel(item.sourceType)}</Badge>
                  <Badge tone={tone}>{stateLabel(item.readiness.state)}</Badge>
                  {linkedDeal ? <Badge tone='success'>{linkedDeal.id}</Badge> : <Badge tone='neutral'>Без сделки</Badge>}
                </div>
              </div>
              <div className='seller-lot-stats'>
                <div style={{ padding: 14, borderRadius: 14, background: SURFACE_SOFT, border: `1px solid ${BORDER}`, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginTop: 8, lineHeight: 1.5, wordBreak: 'break-word' }}>{item.readiness.nextStep ?? '—'}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 14, background: SURFACE_SOFT, border: `1px solid ${BORDER}`, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Владелец / связка</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginTop: 8, lineHeight: 1.5, wordBreak: 'break-word' }}>{item.readiness.nextOwner ?? '—'}{linkedDeal ? ` · ${linkedDeal.routeId ?? 'маршрут не задан'}` : ''}</div>
                </div>
              </div>
              <div className='seller-lot-actions'>
                <button onClick={() => router.push(`/platform-v7/lots/${item.id}`)} style={actionButton('primary')}>Открыть карточку лота</button>
                {linkedDeal ? <Link href={`/platform-v7/deals/${linkedDeal.id}`} style={actionButton()}>Открыть сделку</Link> : <Link href='/platform-v7/procurement' style={actionButton()}>Создать сделку</Link>}
                <button onClick={() => toggleFavouriteLot(item.id)} aria-pressed={isFavourite} aria-label={isFavourite ? `Убрать лот ${item.id} из избранного` : `Добавить лот ${item.id} в избранное`} style={isFavourite ? actionButton('warning') : actionButton()}>{isFavourite ? '★ В избранном' : '☆ В избранное'}</button>
                <button onClick={() => { const result = toggleCompareLot(item.id); if (!result.ok && result.reason === 'limit') setCompareToast('Сравнить можно максимум 3 лота. Уберите один перед добавлением нового.'); }} aria-pressed={isCompared} aria-label={isCompared ? `Убрать лот ${item.id} из сравнения` : `Добавить лот ${item.id} в сравнение`} style={isCompared ? actionButton('primary') : actionButton()}>{isCompared ? '− Из сравнения' : '+ Сравнить'}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { lots as baseLots, type LotItem } from '@/lib/v7r/esia-fgis-data';
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

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 8 }}>{note}</div>
    </section>
  );
}

export function SellerLotsRuntime() {
  const { manualLots, clearManualLots } = useCommercialRuntimeStore();
  const [sourceFilter, setSourceFilter] = React.useState<'ALL' | 'FGIS' | 'MANUAL'>('ALL');
  const [stateFilter, setStateFilter] = React.useState<'ALL' | 'PASS' | 'REVIEW' | 'FAIL'>('ALL');

  const mergedLots = React.useMemo(() => [...manualLots, ...baseLots], [manualLots]);
  const filteredLots = mergedLots.filter((item) => {
    const sourceOk = sourceFilter === 'ALL' ? true : item.sourceType === sourceFilter;
    const stateOk = stateFilter === 'ALL' ? true : item.readiness.state === stateFilter;
    return sourceOk && stateOk;
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
              Здесь объединены базовые демо-лоты и созданные вручную лоты текущей сессии. Пользовательские manual-лоты сохраняются локально и честно помечены как MANUAL без имитации live-FGIS-объекта.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/lots/create' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', fontSize: 13, fontWeight: 700 }}>Создать лот</Link>
            <button onClick={clearManualLots} style={{ borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Очистить мои manual-лоты</button>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Всего лотов' value={String(mergedLots.length)} note='Все видимые лоты текущего контура.' />
        <StatCard title='Готовы к движению' value={String(passCount)} note='Можно идти в переговоры без ручного gate.' />
        <StatCard title='Нужна проверка' value={String(reviewCount)} note='Есть manual- или документные блокеры.' />
        <StatCard title='Жёсткий стоп' value={String(failCount)} note='Gate FAIL, движение дальше запрещено.' />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
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
          return (
            <section key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{item.grain} · {item.volumeTons} т · {item.sourceReference ?? 'Ручной контур без внешнего reference'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge tone={item.sourceType === 'FGIS' ? 'warning' : 'neutral'}>{item.sourceType}</Badge>
                  <Badge tone={tone}>{item.readiness.state}</Badge>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                  <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Следующий шаг</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.readiness.nextStep ?? '—'}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                  <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Владелец</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419', marginTop: 8 }}>{item.readiness.nextOwner ?? '—'}</div>
                </div>
              </div>

              {item.readiness.blockers.length ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {item.readiness.blockers.map((blocker) => (
                    <div key={blocker.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.14)' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{blocker.title}</div>
                        <Badge tone='danger'>{blocker.reasonCode}</Badge>
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginTop: 8 }}>{blocker.detail}</div>
                      <div style={{ fontSize: 12, color: '#B91C1C', lineHeight: 1.6, marginTop: 8 }}>{blocker.impact}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 14, borderRadius: 14, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.14)', fontSize: 13, fontWeight: 700, color: '#0A7A5F' }}>
                  Блокеров нет. Лот готов к следующему этапу внутри платформы.
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

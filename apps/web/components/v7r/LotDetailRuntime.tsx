'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { lots as baseLots } from '@/lib/v7r/esia-fgis-data';
import { useCommercialRuntimeStore } from '@/stores/useCommercialRuntimeStore';
import { useBuyerRuntimeStore } from '@/stores/useBuyerRuntimeStore';
import { useToast } from '@/components/v7r/Toast';

function palette(tone: 'success' | 'warning' | 'danger' | 'neutral') {
  if (tone === 'success') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
  if (tone === 'warning') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' };
  if (tone === 'danger') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return { bg: '#F8FAFB', border: '#E4E6EA', color: '#475569' };
}

function toneByState(state: 'PASS' | 'REVIEW' | 'FAIL') {
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

export function LotDetailRuntime({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { manualLots } = useCommercialRuntimeStore();
  const addLocalRfq = useBuyerRuntimeStore((s) => s.addLocalRfq);
  const createDraftDealFromLocalRfq = useBuyerRuntimeStore((s) => s.createDraftDealFromLocalRfq);

  const lot = React.useMemo(() => [...manualLots, ...baseLots].find((item) => item.id === id) ?? null, [manualLots, id]);

  if (!lot) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Лот не найден</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>Лот {id} отсутствует в текущем контуре.</div>
        </section>
        <Link href='/platform-v7/lots' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 14, fontWeight: 700 }}>Назад к лотам</Link>
      </div>
    );
  }

  const tone = toneByState(lot.readiness.state);

  function startNegotiation() {
    const rfq = addLocalRfq({
      grain: lot.grain,
      volume: lot.volumeTons,
      region: 'Тамбовская обл.',
      targetPrice: 15000,
      quality: 'По паспорту партии',
      payment: 'Резерв / выпуск по этапам',
    });
    const draft = createDraftDealFromLocalRfq(rfq);
    toast(`Создана draft-сделка ${draft.id} из лота ${lot.id}.`, 'success');
    router.push(`/platform-v7/deal-drafts/${draft.id}`);
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{lot.id}</div>
            <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419', marginTop: 6 }}>{lot.title}</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>{lot.grain} · {lot.volumeTons} т · {lot.sourceReference ?? 'Ручной источник'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge tone={lot.sourceType === 'FGIS' ? 'warning' : 'neutral'}>{lot.sourceType}</Badge>
            <Badge tone={tone}>{lot.readiness.state}</Badge>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <StatCard title='Объём' value={`${lot.volumeTons}`} note='Тонн в текущем лоте.' />
        <StatCard title='Следующий шаг' value='1' note={lot.readiness.nextStep ?? '—'} />
        <StatCard title='Владелец' value={lot.readiness.nextOwner ?? '—'} note='Кто должен двигать лот дальше.' />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Blockers и readiness</div>
        {lot.readiness.blockers.length ? lot.readiness.blockers.map((blocker) => (
          <div key={blocker.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.14)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{blocker.title}</div>
              <Badge tone='danger'>{blocker.reasonCode}</Badge>
            </div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginTop: 8 }}>{blocker.detail}</div>
            <div style={{ fontSize: 12, color: '#B91C1C', lineHeight: 1.6, marginTop: 8 }}>{blocker.impact}</div>
          </div>
        )) : <div style={{ padding: 14, borderRadius: 14, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.14)', fontSize: 13, fontWeight: 700, color: '#0A7A5F' }}>Блокеров нет. Лот готов к переговорам и переходу в сделку.</div>}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Действия</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={startNegotiation} style={{ padding: '12px 16px', borderRadius: 12, border: 'none', background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Создать draft-сделку</button>
          <Link href='/platform-v7/procurement' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 14, fontWeight: 700 }}>Открыть закупку</Link>
          <Link href='/platform-v7/lots' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 14, fontWeight: 700 }}>Назад к лотам</Link>
        </div>
      </section>
    </div>
  );
}

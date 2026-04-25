'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { selectRuntimeRfqs } from '@/lib/domain/selectors';
import { formatMoney } from '@/lib/v7r/helpers';
import { useToast } from '@/components/v7r/Toast';
import { useBuyerRuntimeStore } from '@/stores/useBuyerRuntimeStore';

function chip(active: boolean) {
  return {
    borderRadius: 999,
    padding: '10px 12px',
    border: active ? '1px solid rgba(10,122,95,0.16)' : '1px solid #E4E6EA',
    background: active ? 'rgba(10,122,95,0.08)' : '#fff',
    color: active ? '#0A7A5F' : '#0F1419',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties;
}

function statLabel(text: string) { return text.toUpperCase(); }
function Card({ title, value, note }: { title: string; value: string; note: string }) {
  return <section style={{ background:'#fff', border:'1px solid #E4E6EA', borderRadius:18, padding:18 }}><div style={{ fontSize:11, color:'#6B778C', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:800 }}>{title}</div><div style={{ fontSize:28, lineHeight:1.1, fontWeight:800, color:'#0F1419', marginTop:8 }}>{value}</div><div style={{ fontSize:12, color:'#6B778C', lineHeight:1.6, marginTop:8 }}>{note}</div></section>;
}
function Badge({ text, tone='neutral' }: { text: string; tone?: 'neutral'|'success'|'warning' }) {
  const styles = tone === 'success' ? { background:'rgba(10,122,95,0.08)', border:'1px solid rgba(10,122,95,0.16)', color:'#0A7A5F' } : tone === 'warning' ? { background:'rgba(217,119,6,0.08)', border:'1px solid rgba(217,119,6,0.16)', color:'#B45309' } : { background:'#F8FAFB', border:'1px solid #E4E6EA', color:'#475569' };
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'4px 8px', borderRadius:999, fontSize:11, fontWeight:800, ...styles }}>{text}</span>;
}
function draftStatusLabel(status: string) {
  if (status === 'draft') return 'Черновик';
  if (status === 'docs_in_progress') return 'Документы в работе';
  if (status === 'reserve_pending') return 'Резерв на проверке';
  if (status === 'reserve_approved') return 'Резерв подтверждён';
  if (status === 'dispute_open') return 'Спор открыт';
  if (status === 'release_ready') return 'Готово к выпуску';
  if (status === 'released') return 'Деньги выпущены';
  return status;
}

export function BuyerProcurementRuntimeV2() {
  const router = useRouter();
  const toast = useToast();
  const marketRfqs = selectRuntimeRfqs();
  const { localRfqs, shortlistedSourceIds, draftDeals, addLocalRfq, toggleShortlist, createDraftDealFromMarket, createDraftDealFromLocalRfq } = useBuyerRuntimeStore();
  const [grain, setGrain] = React.useState('Пшеница 4 кл.');
  const [volume, setVolume] = React.useState('300');
  const [region, setRegion] = React.useState('Тамбовская обл.');
  const [targetPrice, setTargetPrice] = React.useState('14800');
  const [quality, setQuality] = React.useState('ГОСТ / влажность ≤14%');
  const [payment, setPayment] = React.useState('Сбер / резервирование');
  const [sourceFilter, setSourceFilter] = React.useState<'ALL'|'MARKET'|'LOCAL'>('ALL');

  const visibleMarket = sourceFilter === 'LOCAL' ? [] : marketRfqs;
  const visibleLocal = sourceFilter === 'MARKET' ? [] : localRfqs;

  function createRequest() {
    const numericVolume = Number(volume);
    const numericPrice = Number(targetPrice);
    if (!grain.trim()) return toast('Укажи культуру.', 'error');
    if (!region.trim()) return toast('Укажи регион.', 'error');
    if (!Number.isFinite(numericVolume) || numericVolume <= 0) return toast('Укажи корректный объём.', 'error');
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return toast('Укажи корректную цену.', 'error');
    const created = addLocalRfq({ grain: grain.trim(), volume: numericVolume, region: region.trim(), targetPrice: numericPrice, quality: quality.trim(), payment: payment.trim() });
    toast(`Запрос ${created.id} сохранён.`, 'success');
  }
  function shortlistButton(sourceId: string) {
    const active = shortlistedSourceIds.includes(sourceId);
    return <button onClick={() => toggleShortlist(sourceId)} style={chip(active)}>{active ? 'Убрать из отбора' : 'В отбор'}</button>;
  }

  return (
    <div style={{ display:'grid', gap:18, padding:'8px 0' }}>
      <section style={{ background:'#fff', border:'1px solid #E4E6EA', borderRadius:18, padding:18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:14, flexWrap:'wrap', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:28, lineHeight:1.15, fontWeight:800, color:'#0F1419' }}>Закупка и отбор вариантов</div>
            <div style={{ fontSize:13, color:'#6B778C', lineHeight:1.7, marginTop:8, maxWidth:920 }}>Запросы закупки, отобранные варианты и черновики сделок сохраняются внутри устойчивого runtime-контура. После обновления страницы сценарий не теряется.</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Badge text='УСТОЙЧИВОЕ ХРАНЕНИЕ' />
            <Link href='/platform-v7/deals' style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', justifyContent:'center', borderRadius:12, padding:'10px 14px', background:'#fff', border:'1px solid #E4E6EA', color:'#0F1419', fontSize:13, fontWeight:700 }}>Открыть сделки</Link>
          </div>
        </div>
      </section>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14 }}>
        <Card title={statLabel('Рынок')} value={String(marketRfqs.length)} note='Базовые рыночные предложения.' />
        <Card title={statLabel('Мои запросы')} value={String(localRfqs.length)} note='Созданные внутри платформы запросы.' />
        <Card title={statLabel('Отобрано')} value={String(shortlistedSourceIds.length)} note='Варианты, отложенные для сравнения.' />
        <Card title={statLabel('Черновики сделок')} value={String(draftDeals.length)} note='Созданные внутри контура черновики.' />
      </div>

      <section style={{ background:'#fff', border:'1px solid #E4E6EA', borderRadius:18, padding:18, display:'grid', gap:12 }}>
        <div style={{ fontSize:18, fontWeight:800, color:'#0F1419' }}>Текущее действие</div>
        <div style={{ padding:14, borderRadius:14, background:'rgba(10,122,95,0.08)', border:'1px solid rgba(10,122,95,0.16)', fontSize:14, color:'#0F1419', lineHeight:1.7 }}>
          <strong>Следующий шаг:</strong> либо создать новый запрос закупки, либо выбрать рыночный вариант и перевести его в черновик сделки. После создания черновика следующий владелец шага — покупатель.
        </div>
      </section>

      <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', gap:16 }}>
        <section style={{ background:'#fff', border:'1px solid #E4E6EA', borderRadius:18, padding:18, display:'grid', gap:14 }}>
          <div><div style={{ fontSize:18, fontWeight:800, color:'#0F1419' }}>Создать запрос закупки</div><div style={{ fontSize:13, color:'#6B778C', marginTop:4 }}>Покупатель формирует параметры партии и создаёт свой запрос.</div></div>
          <div style={{ display:'grid', gap:12 }}>
            <input value={grain} onChange={(e)=>setGrain(e.target.value)} placeholder='Культура' style={{ padding:'12px 14px', borderRadius:12, border:'1px solid #E4E6EA', fontSize:14 }} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <input value={volume} onChange={(e)=>setVolume(e.target.value)} inputMode='decimal' placeholder='Объём, т' style={{ padding:'12px 14px', borderRadius:12, border:'1px solid #E4E6EA', fontSize:14 }} />
              <input value={targetPrice} onChange={(e)=>setTargetPrice(e.target.value)} inputMode='decimal' placeholder='Целевая цена, ₽/т' style={{ padding:'12px 14px', borderRadius:12, border:'1px solid #E4E6EA', fontSize:14 }} />
            </div>
            <input value={region} onChange={(e)=>setRegion(e.target.value)} placeholder='Регион' style={{ padding:'12px 14px', borderRadius:12, border:'1px solid #E4E6EA', fontSize:14 }} />
            <input value={quality} onChange={(e)=>setQuality(e.target.value)} placeholder='Качество' style={{ padding:'12px 14px', borderRadius:12, border:'1px solid #E4E6EA', fontSize:14 }} />
            <input value={payment} onChange={(e)=>setPayment(e.target.value)} placeholder='Оплата' style={{ padding:'12px 14px', borderRadius:12, border:'1px solid #E4E6EA', fontSize:14 }} />
          </div>
          <button onClick={createRequest} style={{ borderRadius:12, padding:'12px 16px', background:'#0A7A5F', border:'1px solid #0A7A5F', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>Сохранить запрос</button>
        </section>

        <section style={{ background:'#fff', border:'1px solid #E4E6EA', borderRadius:18, padding:18, display:'grid', gap:14 }}>
          <div><div style={{ fontSize:18, fontWeight:800, color:'#0F1419' }}>Последние черновики сделок</div><div style={{ fontSize:13, color:'#6B778C', marginTop:4 }}>Черновики появляются сразу после выбора варианта.</div></div>
          <div style={{ display:'grid', gap:10 }}>
            {draftDeals.length === 0 ? <div style={{ padding:14, borderRadius:14, background:'#F8FAFB', border:'1px solid #E4E6EA', fontSize:13, color:'#6B778C' }}>Пока нет черновиков сделок.</div> : draftDeals.slice(0,3).map((item) => (
              <div key={item.id} style={{ padding:14, borderRadius:14, background:'#F8FAFB', border:'1px solid #E4E6EA', display:'grid', gap:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}><div style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:800, color:'#0A7A5F', fontSize:13 }}>{item.id}</div><Badge text={draftStatusLabel(item.status)} tone='success' /></div>
                <div style={{ fontSize:14, fontWeight:700, color:'#0F1419' }}>{item.grain} · {item.volume} т · {formatMoney(item.price)} / т</div>
                <div style={{ fontSize:12, color:'#475569' }}><strong>Следующий шаг:</strong> {item.nextStep}</div>
                <Link href={`/platform-v7/deal-drafts/${item.id}`} style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', justifyContent:'center', borderRadius:12, padding:'10px 14px', background:'rgba(10,122,95,0.08)', border:'1px solid rgba(10,122,95,0.16)', color:'#0A7A5F', fontSize:13, fontWeight:700 }}>Открыть черновик</Link>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={{ background:'#fff', border:'1px solid #E4E6EA', borderRadius:18, padding:18, display:'grid', gap:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', gap:14, flexWrap:'wrap', alignItems:'center' }}>
          <div><div style={{ fontSize:18, fontWeight:800, color:'#0F1419' }}>Источники предложений</div><div style={{ fontSize:13, color:'#6B778C', marginTop:4 }}>Рынок и внутренние запросы объединены в один контур отбора.</div></div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{[['ALL','Все'],['MARKET','Рынок'],['LOCAL','Мои запросы']].map(([v,l]) => <button key={v} onClick={()=>setSourceFilter(v as 'ALL'|'MARKET'|'LOCAL')} style={chip(sourceFilter===v)}>{l}</button>)}</div>
        </div>

        <div style={{ display:'grid', gap:10 }}>
          {visibleMarket.map((item) => {
            const shortlisted = shortlistedSourceIds.includes(item.id);
            return <div key={item.id} style={{ background:'#fff', border:'1px solid #E4E6EA', borderRadius:16, padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, alignItems:'center' }}><div><div style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:800, color:'#0A7A5F', fontSize:13 }}>{item.id}</div><div style={{ fontSize:15, fontWeight:800, color:'#0F1419', marginTop:4 }}>{item.grain}</div><div style={{ fontSize:12, color:'#6B778C', marginTop:4 }}>{item.volume} т · {item.region}</div></div><div style={{ fontSize:14, fontWeight:700 }}>{formatMoney(item.price)} / т</div><div style={{ fontSize:12, color:'#6B778C' }}>{item.quality}</div><div style={{ fontSize:12, color:'#6B778C' }}>{item.payment}</div><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{shortlistButton(item.id)}<button onClick={() => { const created = createDraftDealFromMarket(item); toast(`Создан черновик сделки ${created.id}.`, 'success'); router.push(`/platform-v7/deal-drafts/${created.id}`); }} style={{ borderRadius:12, padding:'10px 14px', background:'rgba(10,122,95,0.08)', border:'1px solid rgba(10,122,95,0.16)', color:'#0A7A5F', fontSize:13, fontWeight:700, cursor:'pointer' }}>Создать черновик</button>{shortlisted ? <Badge text='ОТОБРАНО' tone='success' /> : null}</div></div>;
          })}

          {visibleLocal.map((item) => {
            const shortlisted = shortlistedSourceIds.includes(item.id);
            return <div key={item.id} style={{ background:'#fff', border:'1px solid #E4E6EA', borderRadius:16, padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, alignItems:'center' }}><div><div style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:800, color:'#0A7A5F', fontSize:13 }}>{item.id}</div><div style={{ fontSize:15, fontWeight:800, color:'#0F1419', marginTop:4 }}>{item.grain}</div><div style={{ fontSize:12, color:'#6B778C', marginTop:4 }}>{item.volume} т · {item.region}</div></div><div style={{ fontSize:14, fontWeight:700 }}>{formatMoney(item.targetPrice)} / т</div><div style={{ fontSize:12, color:'#6B778C' }}>{item.quality}</div><div style={{ fontSize:12, color:'#6B778C' }}>{item.payment}</div><div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{shortlistButton(item.id)}<button onClick={() => { const created = createDraftDealFromLocalRfq(item); toast(`Создан черновик сделки ${created.id}.`, 'success'); router.push(`/platform-v7/deal-drafts/${created.id}`); }} style={{ borderRadius:12, padding:'10px 14px', background:'rgba(10,122,95,0.08)', border:'1px solid rgba(10,122,95,0.16)', color:'#0A7A5F', fontSize:13, fontWeight:700, cursor:'pointer' }}>Создать черновик</button>{shortlisted ? <Badge text='ОТОБРАНО' tone='success' /> : null}<Badge text='ВНУТРЕННИЙ ЗАПРОС' /></div></div>;
          })}
        </div>
      </section>
    </div>
  );
}

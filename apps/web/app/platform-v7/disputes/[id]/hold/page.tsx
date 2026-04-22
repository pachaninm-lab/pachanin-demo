import type { Metadata } from 'next';
import Link from 'next/link';
import { getDisputeById } from '@/lib/v7r/data';
import { formatMoney } from '@/lib/v7r/helpers';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return {
    title: `Удержание по спору ${params.id}`,
    description: `Расчёт рекомендуемого hold по спору ${params.id}: качество, транспорт и документный риск.`,
  };
}

function CalcCard({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <section style={{ background: accent ? 'rgba(10,122,95,0.06)' : '#fff', border: `1px solid ${accent ? 'rgba(10,122,95,0.18)' : '#E4E6EA'}`, borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C', lineHeight: 1.5 }}>{note}</div>
    </section>
  );
}

export default function DisputeHoldPage({ params }: { params: { id: string } }) {
  const dispute = getDisputeById(params.id);

  if (!dispute) {
    return (
      <div style={{ display: 'grid', gap: 16, maxWidth: 900, margin: '0 auto' }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0F1419' }}>Спор не найден</div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C' }}>Для расчёта удержания нужен существующий dispute id.</div>
          <Link href='/platform-v7/disputes' style={{ display: 'inline-flex', marginTop: 14, textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Все споры</Link>
        </section>
      </div>
    );
  }

  const qualityDeltaPct = 6;
  const transportLossRub = 180000;
  const docsRiskRub = 120000;
  const qualityRiskRub = Math.round(dispute.holdAmount * (qualityDeltaPct / 100));
  const recommendedHold = Math.max(dispute.holdAmount + qualityRiskRub + transportLossRub + docsRiskRub, 0);
  const holdDelta = recommendedHold - dispute.holdAmount;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 8 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#B91C1C' }}>{dispute.id}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#0F1419' }}>Калькулятор удержания</div>
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Быстрый сценарный расчёт для оператора: насколько текущий hold покрывает качественную дельту, транспортный убыток и документный риск по спору.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <CalcCard label='Текущее удержание' value={formatMoney(dispute.holdAmount)} note='Фактический hold на споре.' />
        <CalcCard label='Риск по качеству' value={formatMoney(qualityRiskRub)} note={`При дельте ${qualityDeltaPct}% от текущего hold.`} />
        <CalcCard label='Транспортный риск' value={formatMoney(transportLossRub)} note='Отклонение по рейсу, простою или потерям.' />
        <CalcCard label='Документный риск' value={formatMoney(docsRiskRub)} note='Риск доукомплектования и формального отказа.' />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Рекомендация</div>
        <CalcCard label='Рекомендованный hold' value={formatMoney(recommendedHold)} note={holdDelta >= 0 ? `Нужно добавить ${formatMoney(holdDelta)} к текущему удержанию.` : `Можно снять ${formatMoney(Math.abs(holdDelta))} с текущего удержания.`} accent />
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Это не автоматическое движение денег. Это расчётная рекомендация оператору и банку, чтобы спор не жил в воздухе без понятной цифры удержания.
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/disputes/${dispute.id}`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Вернуться в спор
        </Link>
        <Link href='/platform-v7/bank/escrow' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Эскроу
        </Link>
        <Link href='/platform-v7/control-tower/hotlist' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Hotlist
        </Link>
      </div>
    </div>
  );
}

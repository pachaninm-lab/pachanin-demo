'use client';

import Link from 'next/link';
import { selectBankCallbackById } from '@/lib/domain/selectors';
import { formatMoney } from '@/lib/v7r/helpers';

function statusPalette(status: 'ok' | 'pending' | 'mismatch') {
  if (status === 'ok')       return { bg: 'rgba(10,122,95,0.08)',  border: 'rgba(10,122,95,0.18)',  color: '#0A7A5F', label: 'ОК' };
  if (status === 'pending')  return { bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.18)',  color: '#B45309', label: 'Ожидание' };
  return                            { bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.18)',  color: '#B91C1C', label: 'Расхождение' };
}

const TYPE_LABELS: Record<string, string> = {
  Reserve:  'Резерв',
  Mismatch: 'Расхождение',
  Release:  'Выпуск',
};

export default function BankEventPage({ params }: { params: { id: string } }) {
  const event = selectBankCallbackById(params.id);

  if (!event) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pc-text-primary)' }}>Событие {params.id}</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 8 }}>Событие не найдено.</div>
          <Link href='/platform-v7/bank' style={{ display: 'inline-flex', marginTop: 14, textDecoration: 'none', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Банковый контур</Link>
        </section>
      </div>
    );
  }

  const pal = statusPalette(event.status);

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 720, margin: '0 auto' }}>
      <section style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: 'var(--pc-accent)', fontSize: 14 }}>{event.id}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 6 }}>{TYPE_LABELS[event.type] ?? event.type}</div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted)', marginTop: 4 }}>{event.note}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 999, background: pal.bg, border: `1px solid ${pal.border}`, color: pal.color, fontSize: 12, fontWeight: 800 }}>{pal.label}</span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {[
          { label: 'Сумма',   value: event.amountRub ? formatMoney(event.amountRub) : '—' },
          { label: 'Сделка',  value: event.dealId },
          { label: 'Тип',     value: TYPE_LABELS[event.type] ?? event.type },
          { label: 'Статус',  value: pal.label },
        ].map(({ label, value }) => (
          <section key={label} style={{ background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary)', marginTop: 6 }}>{value}</div>
          </section>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/deals/${event.dealId}`} style={{ textDecoration: 'none', padding: '10px 16px', borderRadius: 12, background: 'var(--pc-accent)', border: '1px solid var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 800 }}>Открыть сделку {event.dealId}</Link>
        <Link href='/platform-v7/bank' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 700 }}>← Банковый контур</Link>
      </div>
    </div>
  );
}

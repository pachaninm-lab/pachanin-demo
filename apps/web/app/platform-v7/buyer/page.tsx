import Link from 'next/link';
import { DEALS } from '@/lib/v7r/data';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';

export default function PlatformV7BuyerPage() {
  const buyerDeals = DEALS.filter((deal) => deal.buyer.name === 'Агрохолдинг СК' || deal.buyer.name === 'ЗерноТрейд ООО' || deal.buyer.name === 'Экспортёр Юг' || deal.buyer.name === 'КомбикормЦентр');
  const totalReserved = buyerDeals.reduce((sum, deal) => sum + deal.reservedAmount, 0);
  const totalHold = buyerDeals.reduce((sum, deal) => sum + deal.holdAmount, 0);
  const releaseReady = buyerDeals.filter((deal) => deal.status === 'release_requested' || deal.status === 'docs_complete').reduce((sum, deal) => sum + (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0)), 0);
  const problemDeals = buyerDeals.filter((deal) => deal.holdAmount > 0 || deal.blockers.length > 0);
  const nextActionDeal = problemDeals[0] ?? buyerDeals[0];

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B778C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Кабинет покупателя</div>
            <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 900, color: '#0F1419', marginTop: 8 }}>Резерв, проблемы и ближайшее решение</div>
            <div style={{ marginTop: 8, fontSize: 14, color: '#6B778C', maxWidth: 860 }}>Первый экран покупателя должен отвечать на три вопроса: сколько денег стоит в резерве, что сейчас блокирует выпуск и какую сделку нужно открыть первой.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/deals' style={btn('primary')}>Открыть сделки</Link>
            <Link href='/platform-v7/bank' style={btn()}>Открыть банк</Link>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        <Metric title='В резерве' value={formatCompactMoney(totalReserved)} note='Деньги, уже заведённые в контур сделки.' />
        <Metric title='К выпуску' value={formatCompactMoney(releaseReady)} note='Сделки, которые ближе всего к выпуску.' tone='green' />
        <Metric title='Под удержанием' value={formatCompactMoney(totalHold)} note='Сумма под спором, проверкой или документами.' tone='red' />
        <Metric title='Проблемные сделки' value={String(problemDeals.length)} note='Требуют вашего решения прямо сейчас.' tone='red' />
      </div>

      {nextActionDeal ? (
        <section style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Главное действие</div>
          <div style={{ fontSize: 24, lineHeight: 1.15, fontWeight: 900, color: '#0F1419', marginTop: 8 }}>{nextActionDeal.id} · {nextActionDeal.grain}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C' }}>Статус: {statusLabel(nextActionDeal.status)} · Удержано: {formatCompactMoney(nextActionDeal.holdAmount)}</div>
          <div style={{ marginTop: 8, fontSize: 14, color: '#334155' }}>{nextActionDeal.holdAmount > 0 ? 'Решите спор или недостающие документы, чтобы снять удержание и довести сделку до выпуска.' : nextActionDeal.blockers.length ? 'Уберите блокеры по сделке, чтобы перейти к следующему этапу.' : 'Откройте сделку и доведите её до банкового выпуска.'}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href={`/platform-v7/deals/${nextActionDeal.id}`} style={btn('primary')}>Открыть сделку</Link>
            <Link href='/platform-v7/bank' style={btn()}>Открыть банк</Link>
          </div>
        </section>
      ) : null}

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Ваши сделки</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {buyerDeals.map((deal) => (
            <Link key={deal.id} href={`/platform-v7/deals/${deal.id}`} style={{ textDecoration: 'none', color: 'inherit', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16, background: '#fff', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: '#0A7A5F' }}>{deal.id}</div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>{statusLabel(deal.status)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{deal.grain} · {deal.quantity} {deal.unit}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                <Cell label='Резерв' value={formatCompactMoney(deal.reservedAmount)} />
                <Cell label='Удержано' value={formatCompactMoney(deal.holdAmount)} danger={deal.holdAmount > 0} />
                <Cell label='Продавец' value={deal.seller.name} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, note, tone = 'default' }: { title: string; value: string; note: string; tone?: 'default' | 'green' | 'red' }) {
  const palette = tone === 'green' ? { bg: '#F0FDF4', border: '#BBF7D0' } : tone === 'red' ? { bg: '#FEF2F2', border: '#FECACA' } : { bg: '#fff', border: '#E4E6EA' };
  return <section style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 18, padding: 18 }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div><div style={{ marginTop: 8, fontSize: 28, lineHeight: 1.1, fontWeight: 900, color: '#0F1419' }}>{value}</div><div style={{ marginTop: 8, fontSize: 12, color: '#6B778C' }}>{note}</div></section>;
}

function Cell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#fff' }}><div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div><div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: danger ? '#B91C1C' : '#0F1419', wordBreak: 'break-word' }}>{value}</div></div>;
}

function btn(kind: 'default' | 'primary' = 'default') {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 700 };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 };
}

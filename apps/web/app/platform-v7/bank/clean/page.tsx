import Link from 'next/link';
import { DEALS, getDealIntegrationState } from '@/lib/v7r/data';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';

const cards = DEALS.map((deal) => {
  const state = getDealIntegrationState(deal.id, deal.lotId);
  const reserved = deal.reservedAmount;
  const withheld = deal.holdAmount;
  const payable = state.gateState === 'FAIL' ? 0 : (deal.releaseAmount ?? Math.max(reserved - withheld, 0));
  return {
    id: deal.id,
    seller: deal.seller.name,
    buyer: deal.buyer.name,
    status: statusLabel(deal.status),
    reserved,
    withheld,
    payable,
    nextOwner: state.nextOwner ?? 'оператор',
    nextStep: state.nextStep ?? 'Нужна ручная сверка сделки',
    stopped: state.gateState === 'FAIL' || withheld > 0,
  };
});

const totals = cards.reduce((acc, card) => ({
  reserved: acc.reserved + card.reserved,
  withheld: acc.withheld + card.withheld,
  payable: acc.payable + card.payable,
  stopped: acc.stopped + (card.stopped ? 1 : 0),
}), { reserved: 0, withheld: 0, payable: 0, stopped: 0 });

export default function BankCleanPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={heroStyle}>
        <div style={badgeStyle}>Банковская панель · тестовый контур</div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.12, color: '#0F1419' }}>Деньги по сделкам</h1>
        <p style={{ margin: 0, maxWidth: 900, fontSize: 14, lineHeight: 1.7, color: '#5B6576' }}>
          Экран показывает резерв, удержание, сумму к выплате, следующего ответственного и причину остановки. Это контрольный слой для пилота, а не платёжный сервис.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/bank/release-safety" style={primaryLink}>Проверка выплаты</Link>
          <Link href="/platform-v7/bank/events" style={secondaryLink}>События банка</Link>
          <Link href="/platform-v7/control-tower" style={secondaryLink}>Центр управления</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <Metric label="В резерве" value={formatCompactMoney(totals.reserved)} />
        <Metric label="Удержано" value={formatCompactMoney(totals.withheld)} danger={totals.withheld > 0} />
        <Metric label="К выплате" value={formatCompactMoney(totals.payable)} />
        <Metric label="Остановлено" value={String(totals.stopped)} danger={totals.stopped > 0} />
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#0F1419' }}>Очередь банковской проверки</h2>
        {cards.slice(0, 8).map((card) => (
          <article key={card.id} style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 14, background: '#F8FAFB', border: '1px solid #EEF1F4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <Link href={`/platform-v7/deals/${card.id}`} style={{ fontFamily: 'monospace', color: '#0A7A5F', fontSize: 13, fontWeight: 900, textDecoration: 'none' }}>{card.id}</Link>
                <span style={{ marginLeft: 8, color: '#475569', fontSize: 13 }}>{card.seller} → {card.buyer}</span>
              </div>
              <span style={{ padding: '5px 9px', borderRadius: 999, background: card.stopped ? 'rgba(220,38,38,0.08)' : 'rgba(10,122,95,0.08)', border: card.stopped ? '1px solid rgba(220,38,38,0.18)' : '1px solid rgba(10,122,95,0.18)', color: card.stopped ? '#B91C1C' : '#0A7A5F', fontSize: 11, fontWeight: 900 }}>{card.stopped ? 'Остановлено' : 'Можно проверять'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              <Small label="Статус" value={card.status} />
              <Small label="Резерв" value={formatCompactMoney(card.reserved)} />
              <Small label="Удержано" value={formatCompactMoney(card.withheld)} danger={card.withheld > 0} />
              <Small label="К выплате" value={formatCompactMoney(card.payable)} />
            </div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
              <strong style={{ color: '#0F1419' }}>Ответственный:</strong> {card.nextOwner}. <strong style={{ color: '#0F1419' }}>Действие:</strong> {card.nextStep}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={{ background: '#fff', border: `1px solid ${danger ? '#FECACA' : '#E4E6EA'}`, borderRadius: 16, padding: 16 }}><div style={{ fontSize: 11, color: danger ? '#991B1B' : '#64748B', textTransform: 'uppercase', letterSpacing: '0.055em', fontWeight: 900 }}>{label}</div><div style={{ marginTop: 7, fontSize: 24, lineHeight: 1.1, color: danger ? '#991B1B' : '#0F1419', fontWeight: 950 }}>{value}</div></div>;
}

function Small({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 10 }}><div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.055em', fontWeight: 900 }}>{label}</div><div style={{ marginTop: 4, fontSize: 13, color: danger ? '#B91C1C' : '#0F1419', fontWeight: 800 }}>{value}</div></div>;
}

const heroStyle = { border: '1px solid #E4E6EA', borderRadius: 20, padding: 22, background: '#fff', display: 'grid', gap: 14 } as const;
const badgeStyle = { display: 'inline-flex', width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 } as const;
const primaryLink = { display: 'inline-flex', minHeight: 42, alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 900 } as const;
const secondaryLink = { ...primaryLink, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1' } as const;

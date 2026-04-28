import { DomainDisputesSummary } from '@/components/v7r/DomainDisputesSummary';
import { DisputesRuntime } from '@/components/v7r/DisputesRuntime';
import {
  PLATFORM_V7_EXECUTION_SOURCE,
  canRequestMoneyRelease,
  formatRub,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const S = 'var(--pc-bg-card)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const WARN = '#B45309';
const ERR = '#B91C1C';

function DL9102DisputeCard() {
  const { deal, dispute, money } = PLATFORM_V7_EXECUTION_SOURCE;
  const canRelease = canRequestMoneyRelease();
  const disputeColor = dispute.status === 'готово' ? BRAND : dispute.status === 'стоп' ? ERR : WARN;
  const disputeBg = dispute.status === 'готово' ? 'rgba(10,122,95,0.08)' : dispute.status === 'стоп' ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)';
  const disputeBorder = dispute.status === 'готово' ? 'rgba(10,122,95,0.18)' : dispute.status === 'стоп' ? 'rgba(220,38,38,0.18)' : 'rgba(217,119,6,0.18)';

  return (
    <section style={{ background: S, border: `1px solid ${BRAND}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: BRAND, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Демо-сделка · удержание и спор · {deal.maturity}</div>
        <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, color: T }}>{deal.id} · {deal.lotId}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <div style={{ background: disputeBg, border: `1px solid ${disputeBorder}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase' }}>Статус спора</div>
          <div style={{ marginTop: 5, fontSize: 14, fontWeight: 900, color: disputeColor }}>{dispute.status}</div>
        </div>
        <div style={{ background: money.holdRub > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(10,122,95,0.08)', border: `1px solid ${money.holdRub > 0 ? 'rgba(220,38,38,0.18)' : 'rgba(10,122,95,0.18)'}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase' }}>Удержано</div>
          <div style={{ marginTop: 5, fontSize: 14, fontWeight: 900, color: money.holdRub > 0 ? ERR : T }}>{formatRub(money.holdRub)}</div>
        </div>
        <div style={{ background: 'var(--pc-bg-elevated)', border: `1px solid ${B}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase' }}>Доказательств</div>
          <div style={{ marginTop: 5, fontSize: 14, fontWeight: 900, color: T }}>{dispute.evidenceCount}</div>
        </div>
        <div style={{ background: dispute.arbitratorNeeded ? 'rgba(217,119,6,0.08)' : 'rgba(10,122,95,0.08)', border: `1px solid ${dispute.arbitratorNeeded ? 'rgba(217,119,6,0.18)' : 'rgba(10,122,95,0.18)'}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, color: M, fontWeight: 900, textTransform: 'uppercase' }}>Арбитр</div>
          <div style={{ marginTop: 5, fontSize: 14, fontWeight: 900, color: dispute.arbitratorNeeded ? WARN : BRAND }}>{dispute.arbitratorNeeded ? 'нужен' : 'не нужен'}</div>
        </div>
      </div>

      {money.holdRub > 0 && (
        <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 12, padding: 12, fontSize: 13, color: ERR, fontWeight: 800 }}>
          Удержание {formatRub(money.holdRub)} — деньги нельзя выпускать: {dispute.holdReason || 'активное удержание'}
        </div>
      )}

      {!money.holdRub && (
        <div style={{ fontSize: 12, color: canRelease ? BRAND : WARN }}>
          {canRelease ? 'Удержаний нет, спор закрыт — этот gate не блокирует выпуск денег' : 'Выпуск денег заблокирован другими gate-проверками'}
        </div>
      )}
    </section>
  );
}

export default function PlatformV7DisputesPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <DL9102DisputeCard />
      <DomainDisputesSummary />
      <DisputesRuntime />
    </div>
  );
}

import Link from 'next/link';
import { DomainDealsSummary } from '@/components/v7r/DomainDealsSummary';
import { DealsOverviewRuntime } from '@/components/v7r/DealsOverviewRuntime';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';

const dealSnapshots = Object.values(DEAL360_SCENARIOS).map((s) => ({
  id: s.dealId,
  lot: s.lotId,
  stage: s.cockpit.currentStage,
  nextActor: s.cockpit.nextActor,
  money: s.cockpit.moneyStatus,
  docs: s.cockpit.docStatus,
  dispute: s.cockpit.disputeStatus,
  cannotHappenReason: s.cockpit.cannotHappenReason,
  href: `/platform-v7/deals/${s.dealId}/clean`,
}));

const stateColor = {
  ok: { border: 'rgba(10,122,95,0.18)', bg: 'rgba(10,122,95,0.06)', text: '#0A7A5F' },
  wait: { border: 'rgba(180,83,9,0.18)', bg: 'rgba(180,83,9,0.06)', text: '#B45309' },
  stop: { border: 'rgba(220,38,38,0.18)', bg: 'rgba(220,38,38,0.06)', text: '#B91C1C' },
  manual: { border: 'rgba(100,116,139,0.18)', bg: 'rgba(100,116,139,0.06)', text: '#475569' },
} as const;

export default function PlatformV7DealsPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 60%, #EEF6F3 100%)', border: '1px solid #E4E6EA', borderRadius: 26, padding: 22, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 8, maxWidth: 860 }}>
            <div style={{ display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
              Реестр исполнения · сделки в работе
            </div>
            <h1 style={{ margin: 0, fontSize: 'clamp(26px, 4.2vw, 44px)', lineHeight: 1.06, letterSpacing: '-0.04em', color: '#0F1419', fontWeight: 950 }}>
              Сделки: деньги, документы, рейс, спор
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/deals/DL-9102/clean' style={primary}>Открыть DL-9102</Link>
            <Link href='/platform-v7/control-tower' style={secondary}>Центр управления</Link>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {dealSnapshots.map((deal) => (
            <Link key={deal.id} href={deal.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{deal.id} · {deal.lot}</span>
                  <p style={{ margin: '4px 0 0', color: '#0F1419', fontSize: 14, fontWeight: 900 }}>{deal.stage}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, borderRadius: 999, padding: '4px 10px', border: `1px solid ${stateColor[deal.money.state].border}`, background: stateColor[deal.money.state].bg, color: stateColor[deal.money.state].text }}>
                  {deal.money.label}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                <GateChip label='Документы' value={deal.docs.label} state={deal.docs.state} />
                <GateChip label='Споры' value={deal.dispute.label} state={deal.dispute.state} />
                <div style={{ background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.14)', borderRadius: 10, padding: '7px 10px' }}>
                  <div style={{ color: '#64748B', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Следующий исполнитель</div>
                  <div style={{ color: '#0F1419', fontSize: 12, fontWeight: 900, marginTop: 3 }}>{deal.nextActor}</div>
                </div>
              </div>
              {deal.cannotHappenReason && (
                <p style={{ margin: 0, color: '#B91C1C', fontSize: 12, lineHeight: 1.4 }}>Остановлено: {deal.cannotHappenReason}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <DomainDealsSummary />
      <DealsOverviewRuntime />
    </div>
  );
}

function GateChip({ label, value, state }: { label: string; value: string; state: keyof typeof stateColor }) {
  const c = stateColor[state];
  return (
    <div style={{ border: `1px solid ${c.border}`, background: c.bg, borderRadius: 10, padding: '7px 10px' }}>
      <div style={{ color: '#64748B', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ color: c.text, fontSize: 12, fontWeight: 900, marginTop: 3 }}>{value}</div>
    </div>
  );
}

const primary = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 850 } as const;
const secondary = { ...primary, background: '#fff', color: '#0F1419', border: '1px solid #CBD5E1' } as const;

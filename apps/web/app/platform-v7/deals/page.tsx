import Link from 'next/link';
import { CanonicalDealsList } from '@/components/platform-v7/CanonicalDealsList';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';
import { ExcelExportButton } from '@/components/platform-v7/ExcelExportButton';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { E2EDealSimulationPanel } from '@/components/platform-v7/E2EDealSimulationPanel';

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
  manual: { border: 'rgba(100,116,139,0.18)', bg: 'rgba(100,116,139,0.06)', text: 'var(--pc-text-secondary, #475569)' },
} as const;

export default function PlatformV7DealsPage() {
  const stoppedDeals = dealSnapshots.filter((d) => d.cannotHappenReason || d.money.state === 'stop');
  const primaryDeal = stoppedDeals.find((deal) => deal.id === 'DL-9106') ?? stoppedDeals[0] ?? dealSnapshots[0];

  return (
    <div data-testid='platform-v7-deals-page' style={{ display: 'grid', gap: 18 }}>
      <CanonicalDealsList />
      <style dangerouslySetInnerHTML={{ __html: `
        @media(max-width:767px){
          [data-testid='platform-v7-deals-page']{gap:12px!important}
          .pc-deals-shell{padding:16px!important;border-radius:24px!important;gap:12px!important}
          .pc-deals-kicker,.pc-deals-summary,.pc-deals-secondary-cta,.pc-deals-gates{display:none!important}
          .pc-deals-title{font-size:clamp(28px,8vw,38px)!important;line-height:1.04!important}
          .pc-deals-list{gap:8px!important}
          .pc-deals-list > a:nth-child(n+6){display:none!important}
          .pc-deal-row{padding:13px!important;border-radius:16px!important;gap:7px!important}
          .pc-deal-row-top{align-items:flex-start!important;gap:8px!important}
          .pc-deal-row-id{font-size:10px!important}
          .pc-deal-row-stage{font-size:13px!important;line-height:1.25!important}
          .pc-deal-row-money{font-size:11px!important;padding:4px 9px!important;max-width:48vw;text-align:center}
          .pc-deal-row-stop{font-size:11px!important;line-height:1.35!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
          .pc-deals-primary-cta{width:100%;justify-content:center;min-height:52px!important}
        }
      ` }} />

      <section className='pc-deals-shell' style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFB 60%, #EEF6F3 100%)', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 26, padding: 22, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 8, maxWidth: 860 }}>
            <div className='pc-deals-kicker' style={{ display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 }}>
              Реестр исполнения · сделки в работе
            </div>
            <h1 className='pc-deals-title' style={{ margin: 0, fontSize: 'clamp(26px, 4.2vw, 44px)', lineHeight: 1.06, letterSpacing: '-0.04em', color: 'var(--pc-text-primary, #0F1419)', fontWeight: 950 }}>
              Сделки: деньги, документы, рейс, спор
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={primaryDeal.href} className='pc-deals-primary-cta' style={primary}>Открыть {primaryDeal.id}</Link>
            <Link href='/platform-v7/control-tower' className='pc-deals-secondary-cta' style={secondary}>Центр управления</Link>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
          <ExcelExportButton dataset="deals" label="Экспорт Excel" />
        </div>

        <div className='pc-deals-summary'>
          <SmartSectionSummary
            label='Реестр сделок'
            moneyFact='15,89 млн ₽ в работе'
            blockers={stoppedDeals.map((d) => `${d.id} · ${d.money.label}`)}
            facts={[`${dealSnapshots.length} сделок`, `${dealSnapshots.filter((d) => d.dispute.state !== 'ok').length} спора`]}
          />
        </div>

        <div className='pc-deals-list' style={{ display: 'grid', gap: 10 }}>
          {dealSnapshots.map((deal) => (
            <Link key={deal.id} href={deal.href} className='pc-deal-row' style={{ textDecoration: 'none', background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 16, padding: 14, display: 'grid', gap: 10 }}>
              <div className='pc-deal-row-top' style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span className='pc-deal-row-id' style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{deal.id} · {deal.lot}</span>
                  <p className='pc-deal-row-stage' style={{ margin: '4px 0 0', color: 'var(--pc-text-primary, #0F1419)', fontSize: 14, fontWeight: 900 }}>{deal.stage}</p>
                </div>
                <span className='pc-deal-row-money' style={{ fontSize: 11, fontWeight: 900, borderRadius: 999, padding: '4px 10px', border: `1px solid ${stateColor[deal.money.state].border}`, background: stateColor[deal.money.state].bg, color: stateColor[deal.money.state].text }}>
                  {deal.money.label}
                </span>
              </div>
              <div className='pc-deals-gates' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                <GateChip label='Документы' value={deal.docs.label} state={deal.docs.state} />
                <GateChip label='Споры' value={deal.dispute.label} state={deal.dispute.state} />
                <div style={{ background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.14)', borderRadius: 10, padding: '7px 10px' }}>
                  <div style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Следующий исполнитель</div>
                  <div style={{ color: 'var(--pc-text-primary, #0F1419)', fontSize: 12, fontWeight: 900, marginTop: 3 }}>{deal.nextActor}</div>
                </div>
              </div>
              {deal.cannotHappenReason && (
                <p className='pc-deal-row-stop' style={{ margin: 0, color: '#B91C1C', fontSize: 12, lineHeight: 1.4 }}>Остановлено: {deal.cannotHappenReason}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 20, padding: 16 }}>
        <CollapsibleSection title='E2E прогон сделки · 21 шаг' summary='FARMER+BUYER · KYC · УКЭП · Escrow · GPS · LAB · ЭДО · Evidence Chain · Audit' defaultOpen={false}>
          <E2EDealSimulationPanel />
        </CollapsibleSection>
      </section>
    </div>
  );
}

function GateChip({ label, value, state }: { label: string; value: string; state: keyof typeof stateColor }) {
  const c = stateColor[state];
  return (
    <div style={{ border: `1px solid ${c.border}`, background: c.bg, borderRadius: 10, padding: '7px 10px' }}>
      <div style={{ color: 'var(--pc-text-muted, #64748B)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ color: c.text, fontSize: 12, fontWeight: 900, marginTop: 3 }}>{value}</div>
    </div>
  );
}

const primary = { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '11px 14px', borderRadius: 14, background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 850 } as const;
const secondary = { ...primary, background: '#fff', color: 'var(--pc-text-primary, #0F1419)', border: '1px solid #CBD5E1' } as const;

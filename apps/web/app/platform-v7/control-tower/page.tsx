import Link from 'next/link';
import { P7Page } from '@/components/platform-v7/P7Page';
import { P7Section } from '@/components/platform-v7/P7Section';
import { P7Toolbar } from '@/components/platform-v7/P7Toolbar';
import { canonicalDomainDeals, selectRuntimeDeals, selectRuntimeDisputes, selectDealIntegrationState } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { primaryMoneyStopReason } from '@/lib/platform-v7/domain/money-stop-labels';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';
import { countTransportAwaitingSignatures, countTransportBlockedPacks, countTransportCompleted, getTransportHotlist } from '@/lib/v7r/transport-docs';
import { OperatorRadarIsland } from '@/components/platform-v7/visual/OperatorRadarIsland';
import type { RadarZoneData, RadarItemData } from '@/components/platform-v7/visual/OperatorRadarIsland';

function describeReason(code: string) {
  switch (code) {
    case 'FGIS_GATE_FAIL': return 'ФГИС не подтвердил партию';
    case 'ESIA_LINK_MISSING': return 'Нет связи с ЕСИА';
    case 'DOCS_MISSING': return 'Не хватает документов';
    case 'BANK_REVIEW_PENDING': return 'Банк отправил сделку на ручную проверку';
    case 'DISPUTE_OPEN': return 'Спор не закрыт';
    case 'SYNC_CONFIRM_REQUIRED': return 'Нужна финальная сверка данных';
    case 'QUALITY_DISPUTE': return 'Есть спор по качеству';
    case 'ESIA_REAUTH_REQUIRED': return 'Нужно повторно подтвердить ЕСИА';
    case 'lab_result': return 'Нет финального лабораторного результата';
    case 'bank_confirm': return 'Банк ещё не подтвердил проверку выплаты';
    case 'reserve': return 'Резерв средств ещё не подтверждён';
    case 'docs': return 'Не хватает документов';
    case 'dispute': return 'Открыт спор по сделке';
    default: return code;
  }
}

function resolvePrimaryAction(args: { dealId: string; status: string; disputeId?: string | null; reasonCodes: string[]; blockers: string[]; releaseStopped: boolean }) {
  const reasons = [...args.reasonCodes, ...args.blockers];
  if ((args.status === 'quality_disputed' || reasons.includes('DISPUTE_OPEN') || reasons.includes('QUALITY_DISPUTE') || reasons.includes('dispute')) && args.disputeId) {
    return { href: `/platform-v7/disputes/${args.disputeId}`, label: 'Открыть спор' };
  }
  if (reasons.includes('DOCS_MISSING') || reasons.includes('docs')) {
    return { href: `/platform-v7/deals/${args.dealId}/documents`, label: 'Открыть документы' };
  }
  if (reasons.includes('FGIS_GATE_FAIL') || reasons.includes('ESIA_LINK_MISSING') || reasons.includes('ESIA_REAUTH_REQUIRED') || reasons.includes('SYNC_CONFIRM_REQUIRED')) {
    return { href: '/platform-v7/connectors', label: 'Открыть подключение' };
  }
  if (args.releaseStopped || args.status === 'release_requested' || reasons.includes('BANK_REVIEW_PENDING') || reasons.includes('bank_confirm')) {
    return { href: '/platform-v7/bank/release-safety', label: 'Проверить деньги' };
  }
  return { href: `/platform-v7/deals/${args.dealId}`, label: 'Открыть сделку' };
}

export default function PlatformV7ControlTowerPage() {
  const today = new Date('2026-04-19T12:00:00Z');
  const deals = selectRuntimeDeals();
  const disputes = selectRuntimeDisputes();
  const activeDeals = deals.filter((d) => d.status !== 'closed');
  const integratedDeals = activeDeals.map((deal) => ({ deal, integration: selectDealIntegrationState(deal) }));
  const totalReserved = activeDeals.reduce((sum, d) => sum + d.reservedAmount, 0);
  const totalHold = activeDeals.reduce((sum, d) => sum + d.holdAmount, 0);
  const transportBlocked = countTransportBlockedPacks();
  const transportAwaiting = countTransportAwaitingSignatures();
  const transportCompleted = countTransportCompleted();
  const transportHotlist = getTransportHotlist().slice(0, 3);

  const queue = integratedDeals
    .map(({ deal, integration }) => {
      const canonicalDeal = canonicalDomainDeals.find((item) => item.id === deal.id);
      const releaseCheck = canonicalDeal ? evaluateReleaseGuard(canonicalDeal) : null;
      const releaseStopped = releaseCheck ? !releaseCheck.canRequestRelease : false;
      const releaseReason = releaseCheck && releaseCheck.blockers.length > 0 ? primaryMoneyStopReason(releaseCheck.blockers) : null;
      const amountAtRisk = Math.max(deal.holdAmount, integration.gateState === 'FAIL' || releaseStopped ? (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0)) : 0);
      const isDispute = Boolean(deal.dispute);
      const reason = releaseReason ?? (isDispute
        ? 'Открыт спор по сделке'
        : integration.reasonCodes.length
          ? describeReason(integration.reasonCodes[0])
          : deal.blockers.length
            ? describeReason(deal.blockers[0])
            : 'Нужно довести сделку до следующего шага');
      const owner = releaseStopped ? 'Банк / оператор' : integration.nextOwner ?? (isDispute ? 'Оператор' : '—');
      const primaryAction = resolvePrimaryAction({
        dealId: deal.id,
        status: deal.status,
        disputeId: deal.dispute?.id,
        reasonCodes: integration.reasonCodes,
        blockers: deal.blockers,
        releaseStopped,
      });
      const severity = integration.gateState === 'FAIL' || releaseStopped || deal.holdAmount > 0 ? 3 : integration.gateState === 'REVIEW' || deal.status === 'release_requested' ? 2 : 1;
      const slaState = deal.slaDeadline ? (new Date(deal.slaDeadline) < today ? 'Просрочено' : (new Date(deal.slaDeadline).getTime() - today.getTime() <= 24 * 60 * 60 * 1000 ? 'Менее 24 часов' : deal.slaDeadline)) : '—';
      return { deal, integration, amountAtRisk, reason, owner, primaryAction, severity, slaState, releaseStopped };
    })
    .sort((a, b) => b.severity - a.severity || b.amountAtRisk - a.amountAtRisk || b.deal.riskScore - a.deal.riskScore);

  const topBlocker = queue.find((item) => item.severity === 3) ?? queue[0];
  const urgentSla = queue.find((item) => String(item.slaState).includes('Просрочено') || String(item.slaState).includes('24')) ?? queue[0];
  const disputeBlocker = queue.find((item) => item.deal.dispute || item.deal.holdAmount > 0) ?? queue[0];
  const stoppedMoney = queue.reduce((sum, item) => sum + item.amountAtRisk, 0);

  const radarMoneyItems: RadarItemData[] = queue
    .filter((item) => item.releaseStopped || item.deal.holdAmount > 0)
    .slice(0, 3)
    .map((item) => ({
      id: item.deal.id,
      title: `${item.deal.id} · ${item.deal.grain}`,
      detail: item.reason.slice(0, 60),
      money: formatCompactMoney(item.amountAtRisk),
      status: (item.severity === 3 ? 'blocked' : item.severity === 2 ? 'waiting' : 'money') as RadarItemData['status'],
      href: item.primaryAction.href,
      actionLabel: item.primaryAction.label,
    }));

  const radarDocItems: RadarItemData[] = queue
    .filter((item) => item.integration.reasonCodes.includes('DOCS_MISSING') || item.deal.blockers.includes('docs'))
    .slice(0, 3)
    .map((item) => ({
      id: `doc-${item.deal.id}`,
      title: `${item.deal.id} · документы`,
      detail: 'Не хватает документов для передачи основания',
      status: 'blocked' as const,
      href: `/platform-v7/deals/${item.deal.id}/documents`,
      actionLabel: 'Открыть документы',
    }));

  const radarTripItems: RadarItemData[] = transportHotlist.map((item) => ({
    id: item.id,
    title: item.title,
    detail: item.note.slice(0, 60),
    status: (item.moneyImpactStatus === 'blocks_release' ? 'blocked' : 'waiting') as RadarItemData['status'],
    href: item.primaryHref,
    actionLabel: 'Открыть пакет',
  }));

  const radarDisputeItems: RadarItemData[] = disputes.slice(0, 3).map((d) => ({
    id: d.id,
    title: `Спор ${d.id}`,
    detail: 'Открыт · удержание активно',
    status: 'blocked' as const,
    href: `/platform-v7/disputes/${d.id}`,
    actionLabel: 'Открыть спор',
  }));

  const radarRiskItems: RadarItemData[] = queue
    .filter((item) => item.integration.gateState === 'FAIL')
    .slice(0, 3)
    .map((item) => ({
      id: `risk-${item.deal.id}`,
      title: `${item.deal.id} · подключение`,
      detail: describeReason(item.integration.reasonCodes[0] ?? 'unknown'),
      money: formatCompactMoney(item.amountAtRisk),
      status: 'blocked' as const,
      href: '/platform-v7/connectors',
      actionLabel: 'Открыть подключение',
    }));

  const radarZones: RadarZoneData[] = [
    { id: 'money',     label: 'Деньги',    items: radarMoneyItems,   allClearMessage: 'Деньги движутся' },
    { id: 'documents', label: 'Документы', items: radarDocItems,     allClearMessage: 'Документы закрыты' },
    { id: 'trips',     label: 'Рейсы',     items: radarTripItems,    allClearMessage: 'Рейсы в порядке' },
    { id: 'disputes',  label: 'Споры',     items: radarDisputeItems, allClearMessage: 'Споров нет' },
    { id: 'risks',     label: 'Риски',     items: radarRiskItems,    allClearMessage: 'Рисков нет' },
  ];

  return (
    <>
      <style>{`
        .ct-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
        .ct-priority{background:linear-gradient(135deg,#FFFFFF 0%,#F8FAFB 62%,#EEF6F3 100%);border:1px solid #D7DEE3;border-radius:26px;padding:20px;display:grid;gap:16px;box-shadow:0 18px 44px rgba(15,23,42,.07)}
        .ct-priority-main{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:16px;align-items:stretch}
        .ct-priority-panel{border:1px solid #E4E6EA;border-radius:22px;background:#fff;padding:16px;display:grid;gap:10px;box-shadow:0 10px 26px rgba(15,23,42,.045)}
        .ct-metric{background:linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%);border:1px solid #E4E6EA;border-radius:20px;padding:16px;display:block;text-decoration:none;color:inherit;box-shadow:0 12px 28px rgba(15,23,42,.05)}
        .ct-metric-title{font-size:11px;color:#6B778C;font-weight:850;text-transform:uppercase;letter-spacing:.07em}
        .ct-metric-value{margin-top:8px;font-size:28px;line-height:1.05;font-weight:950;color:#0F1419;letter-spacing:-.035em}
        .ct-metric-note{margin-top:9px;font-size:12px;color:#6B778C;line-height:1.5}
        .ct-queue{background:linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%);border:1px solid #E4E6EA;border-radius:24px;padding:16px;display:grid;gap:10px;box-shadow:0 14px 34px rgba(15,23,42,.055)}
        .ct-queue-item{border:1px solid #E4E6EA;border-radius:18px;padding:14px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;background:#fff;box-shadow:0 8px 20px rgba(15,23,42,.04)}
        .ct-queue-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        .ct-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .ct-title{font-size:19px;font-weight:900;color:#0F1419;letter-spacing:-.02em}
        .ct-sub{font-size:13px;color:#6B778C;line-height:1.5}
        .ct-badge{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:850;box-shadow:0 1px 0 rgba(15,23,42,.03)}
        .ct-two{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}
        @media (max-width:1100px){.ct-two,.ct-priority-main{grid-template-columns:1fr}}
        @media (max-width:768px){.ct-queue-item{grid-template-columns:1fr}.ct-queue-actions{justify-content:flex-start}.ct-metric-value{font-size:25px}.ct-priority{padding:14px;border-radius:22px}.ct-priority-panel{padding:13px;border-radius:18px}}
      `}</style>
      <P7Page
        title='Центр управления'
        subtitle='Операторский экран: деньги, главный блокер, ответственный и одно действие.'
        actions={(
          <P7Toolbar testId='control-tower-toolbar'>
            <Badge tone='red'>Деньги остановлены</Badge>
            <Badge tone='amber'>Есть ручная проверка</Badge>
            <Link href={topBlocker?.primaryAction.href ?? '/platform-v7/deals'} style={btn('primary')}>Открыть главный блокер</Link>
          </P7Toolbar>
        )}
        testId='platform-v7-control-tower-page'
      >
        <section className='ct-priority' aria-label='Главный приоритет оператора'>
          <div className='ct-priority-main'>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={micro}>главный приоритет</div>
                <h2 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(28px,5vw,46px)', lineHeight: 1.04, letterSpacing: '-0.045em', fontWeight: 950 }}>
                  Остановлено {formatCompactMoney(stoppedMoney)}
                </h2>
                <p style={{ margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.55 }}>
                  Сначала снимайте самый дорогой стоп-фактор. Остальные очереди уходят ниже, чтобы первый экран не превращался в админку.
                </p>
              </div>
              {topBlocker ? (
                <div className='ct-priority-panel'>
                  <div className='ct-row'>
                    <Badge tone='red'>#{topBlocker.deal.id}</Badge>
                    <Badge tone='blue'>{statusLabel(topBlocker.deal.status)}</Badge>
                  </div>
                  <div className='ct-title'>{topBlocker.deal.grain} · {formatCompactMoney(topBlocker.amountAtRisk)}</div>
                  <div className='ct-sub'>{topBlocker.reason}</div>
                  <div className='ct-row'>
                    <span style={fact}>Ответственный: <strong>{topBlocker.owner}</strong></span>
                    <span style={fact}>SLA: <strong>{topBlocker.slaState}</strong></span>
                  </div>
                  <div className='ct-row'>
                    <Link href={`/platform-v7/deals/${topBlocker.deal.id}`} style={btn()}>Открыть сделку</Link>
                    <Link href={topBlocker.primaryAction.href} style={btn('danger')}>{topBlocker.primaryAction.label}</Link>
                  </div>
                </div>
              ) : null}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <PriorityCard label='Самый срочный SLA' item={urgentSla} />
              <PriorityCard label='Спор / удержание' item={disputeBlocker} />
              <Metric title='Транспорт держит деньги' value={String(transportBlocked)} note={`${transportAwaiting} ждут подписи · ${transportCompleted} закрыты`} href='/platform-v7/control-tower/hotlist' tone={transportBlocked > 0 ? 'red' : 'green'} />
            </div>
          </div>
        </section>

        <P7Section title='Радар оператора' subtitle='Деньги · Документы · Рейсы · Споры · Риски. В каждой зоне — только критичные объекты.'>
          <OperatorRadarIsland zones={radarZones} mode='operator' />
        </P7Section>

        <P7Section title='Очередь исполнения' subtitle='Полный список ниже: деньги под риском, причина, владелец и одно безопасное действие.'>
          <section className='ct-queue'>
            {queue.slice(0, 8).map((item) => (
              <div key={item.deal.id} className='ct-queue-item'>
                <div style={{ display:'grid',gap:8 }}>
                  <div className='ct-row'>
                    <span style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:800, fontSize:13, color:'#0A7A5F' }}>{item.deal.id}</span>
                    <Badge tone={item.severity === 3 ? 'red' : item.severity === 2 ? 'amber' : 'blue'}>{statusLabel(item.deal.status)}</Badge>
                    <Badge tone={item.integration.gateState === 'FAIL' || item.releaseStopped ? 'red' : item.integration.gateState === 'REVIEW' ? 'amber' : 'green'}>{item.integration.gateState === 'FAIL' || item.releaseStopped ? 'Деньги остановлены' : item.integration.gateState === 'REVIEW' ? 'Ручная проверка' : 'Проверено'}</Badge>
                    <Badge tone={String(item.slaState).includes('Просрочено') ? 'red' : String(item.slaState).includes('24') ? 'amber' : 'blue'}>{item.slaState}</Badge>
                  </div>
                  <div style={{ fontSize:15, fontWeight:850, color:'#0F1419' }}>{item.deal.grain} · {item.deal.quantity} {item.deal.unit}</div>
                  <div style={{ fontSize:13, color:'#334155', lineHeight:1.5 }}>{item.reason}</div>
                  <div className='ct-row'>
                    <span style={{ fontSize:12, color:'#6B778C' }}>Под риском: <strong style={{ color:'#0F1419' }}>{formatCompactMoney(item.amountAtRisk)}</strong></span>
                    <span style={{ fontSize:12, color:'#6B778C' }}>Владелец: <strong style={{ color:'#0F1419' }}>{item.owner}</strong></span>
                  </div>
                </div>
                <div className='ct-queue-actions'>
                  <Link href={`/platform-v7/deals/${item.deal.id}`} style={btn()}>Открыть сделку</Link>
                  <Link href={item.primaryAction.href} style={btn(item.severity === 3 ? 'danger' : 'primary')}>{item.primaryAction.label}</Link>
                </div>
              </div>
            ))}
          </section>
        </P7Section>

        <P7Section title='Деньги по стадиям' subtitle='Резерв, удержание и блокеры, которые влияют на банковскую проверку.'>
          <section className='ct-two'>
            <section className='ct-queue'>
              <div className='ct-title'>Финансовая картина</div>
              <div style={{ display:'grid', gap:12 }}>
                <MoneyBar label='Резерв' value={totalReserved} max={totalReserved + totalHold + stoppedMoney} tone='blue' />
                <MoneyBar label='Удержание' value={totalHold} max={totalReserved + totalHold + stoppedMoney} tone='red' />
                <MoneyBar label='Остановлено блокерами' value={stoppedMoney} max={totalReserved + totalHold + stoppedMoney} tone='red' />
              </div>
            </section>

            <section className='ct-queue'>
              <div className='ct-title'>Транспорт и документы</div>
              <div style={{ display:'grid', gap:10 }}>
                {transportHotlist.map((item) => (
                  <Signal key={item.id} title={item.title} detail={item.note} href={item.primaryHref} />
                ))}
                <Signal title='Подключения' detail='ФГИС, банк, ЭДО и ЭПД требуют договоров и доступов для боевого обмена.' href='/platform-v7/connectors' />
              </div>
            </section>
          </section>
        </P7Section>
      </P7Page>
    </>
  );
}

function PriorityCard({ label, item }: { label: string; item?: ReturnType<typeof PlatformV7ControlTowerPage> extends never ? never : any }) {
  if (!item) return null;
  return (
    <div className='ct-priority-panel'>
      <div style={micro}>{label}</div>
      <div className='ct-title'>{item.deal.id} · {formatCompactMoney(item.amountAtRisk)}</div>
      <div className='ct-sub'>{item.reason}</div>
      <Link href={item.primaryAction.href} style={btn(item.severity === 3 ? 'danger' : 'primary')}>{item.primaryAction.label}</Link>
    </div>
  );
}

function Metric({ title, value, note, href, tone = 'default' }: { title: string; value: string; note: string; href: string; tone?: 'default' | 'red' | 'green' }) {
  const bg = tone === 'red' ? 'linear-gradient(180deg,#FEF2F2 0%,#FFFFFF 100%)' : tone === 'green' ? 'linear-gradient(180deg,#F0FDF4 0%,#FFFFFF 100%)' : 'linear-gradient(180deg,#FFFFFF 0%,#F8FAFB 100%)';
  const border = tone === 'red' ? '#FECACA' : tone === 'green' ? '#BBF7D0' : '#E4E6EA';
  return <Link href={href} className='ct-metric' style={{ background:bg, borderColor:border }}><div className='ct-metric-title'>{title}</div><div className='ct-metric-value'>{value}</div><div className='ct-metric-note'>{note}</div></Link>;
}

function Badge({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'blue'; children: React.ReactNode }) {
  const palette = tone === 'green' ? { bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.18)', color: '#15803D' } : tone === 'amber' ? { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' } : tone === 'blue' ? { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#1D4ED8' } : { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' };
  return <span className='ct-badge' style={{ background:palette.bg, border:`1px solid ${palette.border}`, color:palette.color }}>{children}</span>;
}

function MoneyBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'green' | 'red' | 'blue' }) {
  const width = max ? Math.max(6, Math.round((value / max) * 100)) : 0;
  const color = tone === 'green' ? '#16A34A' : tone === 'red' ? '#DC2626' : '#2563EB';
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, marginBottom:6 }}>
        <span style={{ fontSize:13, fontWeight:750, color:'#0F1419' }}>{label}</span>
        <span style={{ fontSize:12, color:'#6B778C' }}>{formatCompactMoney(value)}</span>
      </div>
      <div style={{ height:10, borderRadius:999, background:'#F1F5F9', overflow:'hidden', boxShadow:'inset 0 1px 2px rgba(15,23,42,.05)' }}>
        <div style={{ width:`${width}%`, height:'100%', background:color, borderRadius:999 }} />
      </div>
    </div>
  );
}

function Signal({ title, detail, href }: { title: string; detail: string; href: string }) {
  return <Link href={href} style={{ textDecoration:'none', borderRadius:16, padding:14, background:'#fff', border:'1px solid #E4E6EA', display:'grid', gap:6, boxShadow:'0 8px 20px rgba(15,23,42,.04)' }}><div style={{ fontSize:14, fontWeight:900, color:'#0F1419' }}>{title}</div><div style={{ fontSize:12, color:'#6B778C', lineHeight:1.45 }}>{detail}</div></Link>;
}

function btn(kind: 'default' | 'primary' | 'danger' = 'default') {
  if (kind === 'primary') return { textDecoration:'none', borderRadius:12, padding:'9px 12px', background:'#0A7A5F', border:'1px solid #0A7A5F', color:'#fff', fontWeight:800, fontSize:12, boxShadow:'0 10px 22px rgba(10,122,95,.18)' };
  if (kind === 'danger') return { textDecoration:'none', borderRadius:12, padding:'9px 12px', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.18)', color:'#B91C1C', fontWeight:800, fontSize:12 };
  return { textDecoration:'none', borderRadius:12, padding:'9px 12px', background:'#fff', border:'1px solid #E4E6EA', color:'#0F1419', fontWeight:800, fontSize:12, boxShadow:'0 8px 18px rgba(15,23,42,.04)' };
}

const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const fact = { fontSize: 12, color: '#6B778C' } as const;

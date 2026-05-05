import Link from 'next/link';
import { ManualActionReasonsStrip } from '@/components/platform-v7/ManualActionReasonsStrip';
import { P7Page } from '@/components/platform-v7/P7Page';
import { P7Section } from '@/components/platform-v7/P7Section';
import { P7Toolbar } from '@/components/platform-v7/P7Toolbar';
import { canonicalDomainDeals, selectRuntimeCallbacks, selectRuntimeDeals, selectRuntimeDisputes, selectDealIntegrationState } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { primaryMoneyStopReason } from '@/lib/platform-v7/domain/money-stop-labels';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';
import { DomainControlTowerSummary } from '@/components/v7r/DomainControlTowerSummary';
import { ExecutionSimulationActionPanel } from '@/components/v7r/ExecutionSimulationActionPanel';
import { SberKorusBadge } from '@/components/v7r/SberKorusBadge';
import { countTransportAwaitingSignatures, countTransportBlockedPacks, countTransportCompleted, getTransportHotlist } from '@/lib/v7r/transport-docs';

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
    case 'bank_confirm': return 'Банк ещё не подтвердил выпуск';
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
    return { href: '/platform-v7/connectors', label: 'Открыть интеграции' };
  }
  if (args.releaseStopped || args.status === 'release_requested' || reasons.includes('BANK_REVIEW_PENDING') || reasons.includes('bank_confirm')) {
    return { href: '/platform-v7/bank/release-safety', label: 'Проверить деньги' };
  }
  return { href: `/platform-v7/deals/${args.dealId}`, label: 'Открыть сделку' };
}

export default function PlatformV7ControlTowerPage() {
  const today = new Date('2026-04-19T12:00:00Z');
  const deals = selectRuntimeDeals();
  const callbacks = selectRuntimeCallbacks();
  const disputes = selectRuntimeDisputes();
  const activeDeals = deals.filter((d) => d.status !== 'closed');
  const integratedDeals = activeDeals.map((deal) => ({ deal, integration: selectDealIntegrationState(deal) }));
  const totalReserved = activeDeals.reduce((sum, d) => sum + d.reservedAmount, 0);
  const totalHold = activeDeals.reduce((sum, d) => sum + d.holdAmount, 0);
  const totalRelease = integratedDeals.reduce((sum, item) => {
    const canonicalDeal = canonicalDomainDeals.find((deal) => deal.id === item.deal.id);
    const releaseCheck = canonicalDeal ? evaluateReleaseGuard(canonicalDeal) : null;
    const canRequestRelease = releaseCheck ? releaseCheck.canRequestRelease : item.integration.gateState !== 'FAIL';
    const releaseAmount = item.deal.releaseAmount ?? Math.max(item.deal.reservedAmount - item.deal.holdAmount, 0);
    return sum + (canRequestRelease ? releaseAmount : 0);
  }, 0);
  const blockedByIntegration = integratedDeals.filter((item) => item.integration.gateState === 'FAIL');
  const reviewByIntegration = integratedDeals.filter((item) => item.integration.gateState === 'REVIEW');
  const integrationBlockedAmount = blockedByIntegration.reduce((sum, item) => sum + (item.deal.releaseAmount ?? Math.max(item.deal.reservedAmount - item.deal.holdAmount, 0)), 0);
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
    .sort((a, b) => b.severity - a.severity || b.amountAtRisk - a.amountAtRisk || b.deal.riskScore - a.deal.riskScore)
    .slice(0, 8);

  return (
    <>
      <style>{`
        .ct-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
        .ct-metric{background:#fff;border:1px solid #E4E6EA;border-radius:18px;padding:18px;display:block;text-decoration:none;color:inherit}
        .ct-metric-title{font-size:11px;color:#6B778C;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
        .ct-metric-value{margin-top:8px;font-size:28px;line-height:1.1;font-weight:900;color:#0F1419}
        .ct-metric-note{margin-top:8px;font-size:12px;color:#6B778C;line-height:1.45}
        .ct-queue{background:#fff;border:1px solid #E4E6EA;border-radius:18px;padding:18px;display:grid;gap:12px}
        .ct-queue-item{border:1px solid #E4E6EA;border-radius:16px;padding:16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center}
        .ct-queue-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        .ct-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .ct-title{font-size:18px;font-weight:800;color:#0F1419}
        .ct-sub{font-size:13px;color:#6B778C;line-height:1.5}
        .ct-badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800}
        .ct-two{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}
        @media (max-width:1100px){.ct-two{grid-template-columns:1fr}}
        @media (max-width:768px){.ct-queue-item{grid-template-columns:1fr}.ct-queue-actions{justify-content:flex-start}}
      `}</style>
      <P7Page
        title='Центр управления'
        subtitle='Операторский экран: деньги, причины остановки, транспортные документы, следующий владелец и одно правильное действие по каждой сделке.'
        actions={(
          <P7Toolbar testId='control-tower-toolbar'>
            <Badge tone='red'>Проблемы</Badge>
            <Badge tone='amber'>К выпуску</Badge>
            <Badge tone='blue'>Проверка</Badge>
            <Link href='/platform-v7/control-tower/grain' style={btn('primary')}>Зерновой контур</Link>
          </P7Toolbar>
        )}
        testId='platform-v7-control-tower-page'
      >
        <P7Section title='Деньги и риски' subtitle='KPI берутся из единого контура исполнения и ведут в соответствующие рабочие зоны.'>
          <DomainControlTowerSummary />
        </P7Section>

        <P7Section
          title='Зерновой контур исполнения'
          subtitle='Отдельный операторский вход в цепочку: партия, закупочный запрос, качество, вес, СДИЗ, документы, удержание, спор и основание выпуска денег через банк.'
          actions={<Link href='/platform-v7/control-tower/grain' style={btn('primary')}>Открыть контур</Link>}
        >
          <section className='ct-queue'>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
              <Metric title='Рабочие зоны' value='7' note='Партия, запрос, качество, вес, СДИЗ, деньги и сквозной сценарий.' href='/platform-v7/control-tower/grain' tone='green' />
              <Metric title='Денежный фокус' value='удержание / выпуск' note='Проверка оснований удержания и частичного выпуска через банк.' href='/platform-v7/deals/grain-release' tone='default' />
              <Metric title='Тестовая цепочка' value='3–5 мин' note='Сквозной сценарий без заявлений о боевых интеграциях.' href='/platform-v7/demo/grain-execution' tone='default' />
            </div>
          </section>
        </P7Section>

        <P7Section title='Тестовый контур исполнения' subtitle='Единый контур действий: состояние сделки, проверка условий, журнал, timeline и обратная связь без параллельной старой логики.'>
          <ExecutionSimulationActionPanel />
        </P7Section>

        <P7Section title='Ручные действия' subtitle='Любое ручное вмешательство должно иметь причину и запись в журнале.'>
          <ManualActionReasonsStrip />
        </P7Section>

        <P7Section title='Очередь проблем и действий' subtitle='Каждая строка — это деньги, причина, владелец и одно правильное действие.'>
          <section className='ct-queue'>
            {queue.map((item) => (
              <div key={item.deal.id} className='ct-queue-item'>
                <div style={{ display:'grid',gap:8 }}>
                  <div className='ct-row'>
                    <span style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:800, fontSize:13, color:'#0A7A5F' }}>{item.deal.id}</span>
                    <Badge tone={item.severity === 3 ? 'red' : item.severity === 2 ? 'amber' : 'blue'}>{statusLabel(item.deal.status)}</Badge>
                    <Badge tone={item.integration.gateState === 'FAIL' || item.releaseStopped ? 'red' : item.integration.gateState === 'REVIEW' ? 'amber' : 'green'}>{item.integration.gateState === 'FAIL' || item.releaseStopped ? 'Деньги остановлены' : item.integration.gateState === 'REVIEW' ? 'Проверка вручную' : 'Проверено'}</Badge>
                    <Badge tone={String(item.slaState).includes('Просрочено') ? 'red' : String(item.slaState).includes('24') ? 'amber' : 'blue'}>{item.slaState}</Badge>
                  </div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#0F1419' }}>{item.deal.grain} · {item.deal.quantity} {item.deal.unit}</div>
                  <div style={{ fontSize:13, color:'#334155' }}>{item.reason}</div>
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

        <P7Section
          title='Транспортный контур СберКорус'
          subtitle='Пока этот контур не закрыт, банк не должен считать выпуск денег чистым.'
          actions={<SberKorusBadge subtitle='Контроль перевозочных документов' compact />}
        >
          <section className='ct-queue'>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
              <Metric title='Красный стоп' value={String(transportBlocked)} note='Пакеты, которые прямо держат деньги.' href='/platform-v7/control-tower/hotlist' tone='red' />
              <Metric title='Ждём подписи' value={String(transportAwaiting)} note='Сделки, где не собрана полная цепочка подписей.' href='/platform-v7/control-tower/hotlist' tone='default' />
              <Metric title='Зелёный контур' value={String(transportCompleted)} note='Пакеты, которые больше не спорят с банковым выпуском.' href='/platform-v7/bank' tone='green' />
            </div>
            <div style={{ display:'grid', gap:10 }}>
              {transportHotlist.map((item) => (
                <div key={item.id} style={{ border:'1px solid #E4E6EA', borderRadius:16, padding:14, background:'#F8FAFB', display:'grid', gap:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:800, color:'#0F1419' }}>{item.title}</div>
                      <div style={{ marginTop:4, fontSize:12, color:'#6B778C' }}>{item.providerLabel}</div>
                    </div>
                    <Badge tone={item.moneyImpactStatus === 'blocks_release' ? 'red' : 'amber'}>{item.moneyImpactStatus === 'blocks_release' ? 'Блокирует выпуск' : 'Частично блокирует'}</Badge>
                  </div>
                  <div style={{ fontSize:12, color:'#334155', lineHeight:1.6 }}>{item.note}</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <Link href={item.primaryHref} style={btn()}>Открыть пакет</Link>
                    <Link href={item.simulationHref} style={btn('primary')}>Открыть тестовый сценарий</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </P7Section>

        <P7Section title='Финансовый контур и системные сигналы' subtitle='Резерв, удержание, выпуск денег и связанные рабочие зоны.'>
          <section className='ct-two'>
            <section className='ct-queue'>
              <div className='ct-title'>Деньги по стадиям</div>
              <div style={{ display:'grid', gap:12 }}>
                <MoneyBar label='Резерв' value={totalReserved} max={totalReserved + totalHold + totalRelease + integrationBlockedAmount} tone='blue' />
                <MoneyBar label='Удержание' value={totalHold} max={totalReserved + totalHold + totalRelease + integrationBlockedAmount} tone='red' />
                <MoneyBar label='К выпуску' value={totalRelease} max={totalReserved + totalHold + totalRelease + integrationBlockedAmount} tone='green' />
                <MoneyBar label='Заблокировано интеграцией' value={integrationBlockedAmount} max={totalReserved + totalHold + totalRelease + integrationBlockedAmount} tone='red' />
              </div>
            </section>

            <section className='ct-queue'>
              <div className='ct-title'>Сигналы системы</div>
              <div style={{ display:'grid', gap:10 }}>
                <Signal title='Банк' detail={`${callbacks.length} события уже в контуре.`} href='/platform-v7/bank' />
                <Signal title='Проверка выпуска денег' detail='Блокеры, удержания и кандидаты к выпуску.' href='/platform-v7/bank/release-safety' />
                <Signal title='Споры' detail={`${disputes.length} активных кейса под удержанием.`} href='/platform-v7/disputes' />
                <Signal title='Проверка' detail={`${reviewByIntegration.length} сделки ждут ручной проверки.`} href='/platform-v7/connectors' />
                <Signal title='СберКорус' detail={`${transportBlocked + transportAwaiting} транспортных кейсов требуют действий.`} href='/platform-v7/control-tower/hotlist' />
              </div>
            </section>
          </section>
        </P7Section>
      </P7Page>
    </>
  );
}

function Metric({ title, value, note, href, tone = 'default' }: { title: string; value: string; note: string; href: string; tone?: 'default' | 'red' | 'green' }) {
  const bg = tone === 'red' ? '#FEF2F2' : tone === 'green' ? '#F0FDF4' : '#fff';
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
        <span style={{ fontSize:13, fontWeight:700, color:'#0F1419' }}>{label}</span>
        <span style={{ fontSize:12, color:'#6B778C' }}>{formatCompactMoney(value)}</span>
      </div>
      <div style={{ height:10, borderRadius:999, background:'#F1F5F9', overflow:'hidden' }}>
        <div style={{ width:`${width}%`, height:'100%', background:color, borderRadius:999 }} />
      </div>
    </div>
  );
}

function Signal({ title, detail, href }: { title: string; detail: string; href: string }) {
  return <Link href={href} style={{ textDecoration:'none', borderRadius:14, padding:14, background:'#F8FAFB', border:'1px solid #E4E6EA', display:'grid', gap:6 }}><div style={{ fontSize:14, fontWeight:900, color:'#0F1419' }}>{title}</div><div style={{ fontSize:12, color:'#6B778C' }}>{detail}</div></Link>;
}

function btn(kind: 'default' | 'primary' | 'danger' = 'default') {
  if (kind === 'primary') return { textDecoration:'none', borderRadius:10, padding:'8px 12px', background:'#0A7A5F', border:'1px solid #0A7A5F', color:'#fff', fontWeight:700, fontSize:12 };
  if (kind === 'danger') return { textDecoration:'none', borderRadius:10, padding:'8px 12px', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.18)', color:'#B91C1C', fontWeight:700, fontSize:12 };
  return { textDecoration:'none', borderRadius:10, padding:'8px 12px', background:'#fff', border:'1px solid #E4E6EA', color:'#0F1419', fontWeight:700, fontSize:12 };
}

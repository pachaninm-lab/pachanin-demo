import Link from 'next/link';
import { CALLBACKS, DEALS, DISPUTES, getDealIntegrationState } from '@/lib/v7r/data';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';
import { ControlTowerOperatorPanel } from '@/components/v7r/ControlTowerOperatorPanel';
import { DomainControlTowerSummary } from '@/components/v7r/DomainControlTowerSummary';
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

function cleanStep(value: string | null) {
  if (!value) return null;
  return value
    .replace(/\brelease\b/g, 'выпуск денег')
    .replace(/\bcallback\b/g, 'событие банка')
    .replace(/\bsync\b/g, 'сверку')
    .replace(/\bGate\b/g, 'Проверка')
    .replace(/\bgate\b/g, 'проверка');
}

function resolvePrimaryAction(args: { dealId: string; status: string; disputeId?: string | null; reasonCodes: string[]; blockers: string[] }) {
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
  if (args.status === 'release_requested' || reasons.includes('BANK_REVIEW_PENDING') || reasons.includes('bank_confirm')) {
    return { href: '/platform-v7/bank', label: 'Открыть банк' };
  }
  return { href: `/platform-v7/deals/${args.dealId}`, label: 'Открыть сделку' };
}

export default function PlatformV7ControlTowerPage() {
  const today = new Date('2026-04-19T12:00:00Z');
  const activeDeals = DEALS.filter((d) => d.status !== 'closed');
  const integratedDeals = activeDeals.map((deal) => ({ deal, integration: getDealIntegrationState(deal.id, deal.lotId) }));
  const totalReserved = activeDeals.reduce((sum, d) => sum + d.reservedAmount, 0);
  const totalHold = activeDeals.reduce((sum, d) => sum + d.holdAmount, 0);
  const totalRelease = integratedDeals.reduce((sum, item) => sum + (item.integration.gateState === 'FAIL' ? 0 : (item.deal.releaseAmount ?? Math.max(item.deal.reservedAmount - item.deal.holdAmount, 0))), 0);
  const blockedByIntegration = integratedDeals.filter((item) => item.integration.gateState === 'FAIL');
  const reviewByIntegration = integratedDeals.filter((item) => item.integration.gateState === 'REVIEW');
  const integrationBlockedAmount = blockedByIntegration.reduce((sum, item) => sum + (item.deal.releaseAmount ?? Math.max(item.deal.reservedAmount - item.deal.holdAmount, 0)), 0);
  const transportBlocked = countTransportBlockedPacks();
  const transportAwaiting = countTransportAwaitingSignatures();
  const transportCompleted = countTransportCompleted();
  const transportHotlist = getTransportHotlist().slice(0, 3);

  const queue = integratedDeals
    .map(({ deal, integration }) => {
      const amountAtRisk = Math.max(deal.holdAmount, integration.gateState === 'FAIL' ? (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0)) : 0);
      const isDispute = Boolean(deal.dispute);
      const reason = isDispute
        ? 'Открыт спор по сделке'
        : integration.reasonCodes.length
          ? describeReason(integration.reasonCodes[0])
          : deal.blockers.length
            ? describeReason(deal.blockers[0])
            : 'Нужно довести сделку до следующего шага';
      const owner = integration.nextOwner ?? (isDispute ? 'Оператор' : '—');
      const primaryAction = resolvePrimaryAction({
        dealId: deal.id,
        status: deal.status,
        disputeId: deal.dispute?.id,
        reasonCodes: integration.reasonCodes,
        blockers: deal.blockers,
      });
      const severity = integration.gateState === 'FAIL' || deal.holdAmount > 0 ? 3 : integration.gateState === 'REVIEW' || deal.status === 'release_requested' ? 2 : 1;
      const slaState = deal.slaDeadline ? (new Date(deal.slaDeadline) < today ? 'Просрочено' : (new Date(deal.slaDeadline).getTime() - today.getTime() <= 24 * 60 * 60 * 1000 ? 'Менее 24 часов' : deal.slaDeadline)) : '—';
      return { deal, integration, amountAtRisk, reason, owner, primaryAction, severity, slaState };
    })
    .sort((a, b) => b.severity - a.severity || b.amountAtRisk - a.amountAtRisk || b.deal.riskScore - a.deal.riskScore)
    .slice(0, 8);

  const operatorItems = integratedDeals
    .filter((x) => x.integration.gateState !== 'PASS')
    .slice(0, 4)
    .map((x) => ({
      id: x.deal.id,
      title: `${x.deal.grain} · ${x.deal.quantity} ${x.deal.unit}`,
      gateState: x.integration.gateState,
      nextStep: cleanStep(x.integration.nextStep),
      nextOwner: x.integration.nextOwner,
      releasableAmount: x.deal.releaseAmount ?? Math.max(x.deal.reservedAmount - x.deal.holdAmount, 0),
      releaseEligible: x.deal.status === 'release_requested',
      reasonCodes: x.integration.reasonCodes,
    }));

  return (
    <>
      <style>{`
        .ct-page{display:grid;gap:18px;max-width:100%;overflow-x:hidden}
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
      <div className='ct-page'>
        <DomainControlTowerSummary />

        <section className='ct-queue'>
          <div style={{ display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center' }}>
            <div>
              <div className='ct-title'>Очередь проблем и действий</div>
              <div className='ct-sub'>Каждая строка — это деньги, причина, владелец и одно правильное действие.</div>
            </div>
            <div className='ct-row'>
              <Badge tone='red'>Проблемы</Badge>
              <Badge tone='amber'>К выпуску</Badge>
              <Badge tone='blue'>Проверка</Badge>
            </div>
          </div>

          {queue.map((item) => (
            <div key={item.deal.id} className='ct-queue-item'>
              <div style={{ display:'grid',gap:8 }}>
                <div className='ct-row'>
                  <span style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:800, fontSize:13, color:'#0A7A5F' }}>{item.deal.id}</span>
                  <Badge tone={item.severity === 3 ? 'red' : item.severity === 2 ? 'amber' : 'blue'}>{statusLabel(item.deal.status)}</Badge>
                  <Badge tone={item.integration.gateState === 'FAIL' ? 'red' : item.integration.gateState === 'REVIEW' ? 'amber' : 'green'}>{item.integration.gateState === 'FAIL' ? 'Проверка: стоп' : item.integration.gateState === 'REVIEW' ? 'Проверка вручную' : 'Проверено'}</Badge>
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

        <section className='ct-queue'>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', alignItems:'flex-start' }}>
            <div>
              <div className='ct-title'>Транспортный контур СберКорус</div>
              <div className='ct-sub'>Отдельная очередь по юридически значимым перевозочным документам. Пока этот контур не закрыт, банк не должен считать выпуск денег чистым.</div>
            </div>
            <SberKorusBadge subtitle='Контроль перевозочных документов' compact />
          </div>
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
                  <Link href={item.simulationHref} style={btn('primary')}>Симуляция</Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <ControlTowerOperatorPanel deals={operatorItems} />

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
              <Signal title='Банк' detail={`${CALLBACKS.length} события уже в контуре.`} href='/platform-v7/bank' />
              <Signal title='Споры' detail={`${DISPUTES.length} активных кейса под удержанием.`} href='/platform-v7/disputes' />
              <Signal title='Проверка' detail={`${reviewByIntegration.length} сделки ждут ручной проверки.`} href='/platform-v7/connectors' />
              <Signal title='СберКорус' detail={`${transportBlocked + transportAwaiting} транспортных кейсов требуют действий.`} href='/platform-v7/control-tower/hotlist' />
            </div>
          </section>
        </section>
      </div>
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

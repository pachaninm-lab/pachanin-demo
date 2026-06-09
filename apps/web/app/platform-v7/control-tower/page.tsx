import Link from 'next/link';
import { OperatorExecutionQueue } from '../../../components/platform-v7/OperatorExecutionQueue';
import { selectRuntimeDeals, selectRuntimeDisputes, selectDealIntegrationState } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { primaryMoneyStopReason } from '@/lib/platform-v7/domain/money-stop-labels';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';
import { canonicalDomainDeals } from '@/lib/domain/selectors';
import { countTransportBlockedPacks, countTransportAwaitingSignatures, countTransportCompleted, getTransportHotlist } from '@/lib/v7r/transport-docs';

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
  const stoppedMoney = queue.reduce((sum, item) => sum + item.amountAtRisk, 0);

  return (
    <>
      <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 26, padding: 20, display: 'grid', gap: 12 }}>
          <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>центр управления · пилотный контур · ручная проверка</div>
          <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(28px,5vw,46px)', lineHeight: 1.04, letterSpacing: '-0.045em', fontWeight: 950 }}>
            Остановлено {formatCompactMoney(stoppedMoney)}
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 14, lineHeight: 1.55 }}>
            Сначала снимайте самый дорогой стоп-фактор.
          </p>
          {topBlocker ? (
            <div style={{ border: '1px solid #E4E6EA', borderRadius: 22, background: '#fff', padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0A7A5F', fontFamily: 'JetBrains Mono, monospace' }}>{topBlocker.deal.id}</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: '#0F1419' }}>{topBlocker.deal.grain} · {formatCompactMoney(topBlocker.amountAtRisk)}</div>
              <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.5 }}>{topBlocker.reason}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/platform-v7/deals/${topBlocker.deal.id}`} style={btn()}>Открыть сделку</Link>
                <Link href={topBlocker.primaryAction.href} style={btn('danger')}>{topBlocker.primaryAction.label}</Link>
              </div>
            </div>
          ) : null}
        </section>

        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>очередь исполнения</div>
          {queue.slice(0, 8).map((item) => (
            <div key={item.deal.id} style={{ border: '1px solid #E4E6EA', borderRadius: 18, padding: 14, display: 'grid', gap: 8, background: '#fff' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 13, color: '#0A7A5F' }}>{item.deal.id}</span>
                <span style={{ fontSize: 12, color: '#6B778C' }}>{statusLabel(item.deal.status)}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 850, color: '#0F1419' }}>{item.deal.grain} · {item.deal.quantity} {item.deal.unit}</div>
              <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{item.reason}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={`/platform-v7/deals/${item.deal.id}`} style={btn()}>Открыть сделку</Link>
                <Link href={item.primaryAction.href} style={btn(item.severity === 3 ? 'danger' : 'primary')}>{item.primaryAction.label}</Link>
              </div>
            </div>
          ))}
        </section>

        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>транспорт и документы</div>
          {transportHotlist.map((item) => (
            <Link key={item.id} href={item.primaryHref} style={{ textDecoration: 'none', borderRadius: 16, padding: 14, background: '#fff', border: '1px solid #E4E6EA', display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.45 }}>{item.note}</div>
            </Link>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
            <div style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 10, color: '#64748B', fontWeight: 900, textTransform: 'uppercase' }}>заблокировано</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 950, color: transportBlocked > 0 ? '#B91C1C' : '#0F1419' }}>{transportBlocked}</div>
            </div>
            <div style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 10, color: '#64748B', fontWeight: 900, textTransform: 'uppercase' }}>ждут подписи</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 950, color: '#0F1419' }}>{transportAwaiting}</div>
            </div>
            <div style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 10, color: '#64748B', fontWeight: 900, textTransform: 'uppercase' }}>завершено</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 950, color: '#0F1419' }}>{transportCompleted}</div>
            </div>
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>финансовая картина</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <MoneyBar label='Резерв' value={totalReserved} max={totalReserved + totalHold + stoppedMoney} tone='blue' />
            <MoneyBar label='Удержание' value={totalHold} max={totalReserved + totalHold + stoppedMoney} tone='red' />
            <MoneyBar label='Остановлено блокерами' value={stoppedMoney} max={totalReserved + totalHold + stoppedMoney} tone='red' />
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>споры</div>
          {disputes.slice(0, 3).map((d) => (
            <Link key={d.id} href={`/platform-v7/disputes/${d.id}`} style={{ textDecoration: 'none', borderRadius: 16, padding: 14, background: '#fff', border: '1px solid #E4E6EA', display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>Спор {d.id}</div>
              <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.45 }}>Открыт · удержание активно</div>
            </Link>
          ))}
        </section>

        <OperatorExecutionQueue />
      </main>
    </>
  );
}

function MoneyBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'green' | 'red' | 'blue' }) {
  const width = max ? Math.max(6, Math.round((value / max) * 100)) : 0;
  const color = tone === 'green' ? '#16A34A' : tone === 'red' ? '#DC2626' : '#2563EB';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 750, color: '#0F1419' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#6B778C' }}>{formatCompactMoney(value)}</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: '#F1F5F9', overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function btn(kind: 'default' | 'primary' | 'danger' = 'default') {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '9px 12px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontWeight: 800, fontSize: 12 };
  if (kind === 'danger') return { textDecoration: 'none', borderRadius: 12, padding: '9px 12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontWeight: 800, fontSize: 12 };
  return { textDecoration: 'none', borderRadius: 12, padding: '9px 12px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontWeight: 800, fontSize: 12 };
}

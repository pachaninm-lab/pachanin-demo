import Link from 'next/link';
import { P7DealWorkspaceTabs } from '@/components/platform-v7/P7DealWorkspaceTabs';
import { canonicalDomainDeals, selectDealById, selectDisputesByDealId } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { moneyStopReasonText } from '@/lib/platform-v7/domain/money-stop-labels';
import { getDeal360Scenario, type Deal360State, type Deal360Cockpit } from '@/lib/platform-v7/deal360-source-of-truth';
import { DealSeal } from '@/components/platform-v7/DealSeal';
import { DealWorkspaceVisualLayer } from '@/components/platform-v7/visual/DealWorkspaceVisualLayer';
import { MobileDealActionLens } from '@/components/platform-v7/MobileDealActionLens';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#475569';
const green = '#0A7A5F';
const red = '#B91C1C';
const amber = '#B45309';
const redBg = 'rgba(220,38,38,0.08)';
const greenBg = 'rgba(10,122,95,0.08)';
const amberBg = 'rgba(180,83,9,0.08)';

function rub(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

export default function PlatformV7CleanDealPage({ params }: { params: { id: string } }) {
  const deal = selectDealById(params.id);

  if (!deal) {
    return (
      <main style={{ display: 'grid', gap: 16 }}>
        <section style={card()}>
          <p style={{ margin: 0, color: red, fontWeight: 900 }}>Сделка не найдена</p>
          <h1 style={{ margin: '6px 0 0', fontSize: 28, color: text }}>{params.id}</h1>
          <p style={{ color: muted }}>В доменном контуре нет такой сделки. Возврат к списку не меняет данные.</p>
          <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        </section>
      </main>
    );
  }

  const scenario = getDeal360Scenario(deal.id);
  const canonicalDeal = canonicalDomainDeals.find((item) => item.id === deal.id);
  const releaseCheck = canonicalDeal ? evaluateReleaseGuard(canonicalDeal) : null;
  const releaseAmountRaw = releaseCheck?.releaseAmount ?? deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
  const releaseAmount = releaseCheck && !releaseCheck.canRequestRelease ? 0 : releaseAmountRaw;
  const disputes = selectDisputesByDealId(deal.id);
  const releaseReasons = releaseCheck?.blockers ?? [];
  const hasBlockers = releaseReasons.length > 0 || deal.blockers.length > 0 || deal.holdAmount > 0 || disputes.length > 0 || !scenario.releaseAllowed;

  const primaryReason = releaseReasons.length > 0
    ? moneyStopReasonText(releaseReasons.slice(0, 1))
    : deal.blockers.length > 0
      ? deal.blockers[0]
      : scenario.cockpit.cannotHappenReason ?? 'требуется закрыть условия сделки';

  // ── Visual Intelligence Layer props ──
  const vilLockState = hasBlockers
    ? (deal.holdAmount > 0 ? 'hold' : disputes.length > 0 ? 'blocked-dispute' : 'blocked-docs')
    : (releaseAmount > 0 ? 'ready' : 'released');

  const vilUnlockSteps = releaseReasons.slice(0, 3).map((reason, index) => ({
    id: String(index),
    label: moneyStopReasonText([reason]).split('·')[0].trim(),
    status: (index === 0 ? 'current' : 'upcoming') as 'current' | 'upcoming',
  }));

  const vilCauseLines = releaseReasons.slice(0, 2).map((reason) => ({
    cause: { text: moneyStopReasonText([reason]).split('→')[0].trim(), tone: 'blocked' as const },
    relation: 'blocks' as const,
    effect: { text: 'выпуск денег', tone: 'money' as const },
    moneyAmount: rub(deal.holdAmount > 0 ? deal.holdAmount : releaseAmountRaw),
    moneyTone: (deal.holdAmount > 0 ? 'hold' : 'blocked') as 'hold' | 'blocked',
  }));

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <style>{`
        @media(max-width:767px){
          .p7-clean-desktop-layer{display:none!important}
          .p7-clean-mobile-details{display:block}
          .pc-v4-main{padding-top:calc(var(--pc-header-offset) + 8px)!important}
        }
        @media(min-width:768px){
          .p7-clean-mobile-details{display:none!important}
        }
      `}</style>

      <MobileDealActionLens
        dealId={deal.id}
        lotId={scenario.lotId}
        money={rub(deal.holdAmount > 0 ? deal.holdAmount : releaseAmountRaw)}
        blocker={primaryReason}
        owner={scenario.cockpit.nextActor}
        primaryAction={scenario.nextAction.split('.')[0].trim()}
        primaryHref={`/platform-v7/deals/${deal.id}/documents`}
        docs={`${scenario.documents.filter((d) => !d.blocksMoney).length}/${scenario.documents.length}`}
        trip={scenario.cockpit.tripStatus.label.split('·')[0].trim()}
        quality={scenario.cockpit.qualityStatus.label.split('·')[0].trim()}
        dispute={disputes.length > 0 ? `${disputes.length} активный` : 'нет'}
      />

      <div className='p7-clean-desktop-layer'>
        {/* ── Visual Intelligence Layer ── */}
        <DealWorkspaceVisualLayer
          dealId={deal.id}
          dealStatus={hasBlockers ? 'blocked' : 'moving'}
          totalMoney={rub(deal.reservedAmount)}
          lockState={vilLockState}
          lockReason={hasBlockers ? 'требует подтверждения банка' : undefined}
          causeLines={vilCauseLines}
          unlockSteps={vilUnlockSteps}
          proofItems={{
            gps: 'present',
            photo: 'present',
            weight: 'present',
            seal: 'pending',
            lab: hasBlockers ? 'pending' : 'present',
            act: deal.holdAmount > 0 ? 'disputed' : 'present',
          }}
          primaryAction={hasBlockers ? {
            label: scenario.nextAction.split('.')[0].trim(),
            tone: 'primary',
            consequence: 'Будет записано в журнал',
          } : null}
          hintProblem={hasBlockers ? `Деньги стоят${releaseReasons.length > 0 ? ' из-за ' + moneyStopReasonText(releaseReasons.slice(0, 1)) : ''}.` : undefined}
          hintAction={hasBlockers ? scenario.nextAction : undefined}
          docSummary={`${scenario.documents.filter((d) => !d.blocksMoney).length}/${scenario.documents.length} готовы · ${scenario.documents.filter((d) => d.blocksMoney).length} блокируют деньги`}
          tripSummary={scenario.cockpit.tripStatus.label}
          qualitySummary={scenario.cockpit.qualityStatus.label}
          disputeSummary={disputes.length > 0 ? `${disputes.length} открытых · удержание` : 'Нет активных споров'}
          execZones={{
            money:     { label: 'Деньги',    value: rub(deal.reservedAmount),      tone: hasBlockers ? 'blocked' : 'money',   href: '#deal-money' },
            documents: { label: 'Документы', value: `${scenario.documents.filter((d) => !d.blocksMoney).length}/${scenario.documents.length}`, tone: scenario.documents.some((d) => d.blocksMoney) ? 'blocked' : 'ok', href: '#deal-documents' },
            trip:      { label: 'Рейс',      value: scenario.cockpit.tripStatus.label.split('·')[0].trim(), tone: 'neutral' },
            quality:   { label: 'Качество',  value: scenario.cockpit.qualityStatus.label.split('·')[0].trim(), tone: deal.holdAmount > 0 ? 'warn' : 'neutral' },
            dispute:   { label: 'Спор',      value: disputes.length > 0 ? `${disputes.length} активных` : 'Нет', tone: disputes.length > 0 ? 'blocked' : 'ok' },
            blocker:   hasBlockers ? { text: moneyStopReasonText(releaseReasons.slice(0, 1)), moneyAmount: rub(releaseAmountRaw) } : null,
          }}
        />
      </div>

      <details className='p7-clean-mobile-details'>
        <summary style={{ listStyle: 'none', border: '1px solid #E4E6EA', borderRadius: 18, background: '#fff', padding: '15px 16px', color: text, fontSize: 14, fontWeight: 950, cursor: 'pointer' }}>Открыть полную карточку сделки ↓</summary>
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          <CompactMobileDealDetails scenario={scenario} deal={deal} releaseAmount={releaseAmount} disputesCount={disputes.length} hasBlockers={hasBlockers} />
        </div>
      </details>

      <div className='p7-clean-desktop-layer'>
        <section style={card()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Карточка сделки · контур исполнения</p>
              <h1 style={{ margin: '6px 0 0', fontSize: 28, color: text }}>{deal.id} · {scenario.lotId}</h1>
            </div>
            <span style={{ borderRadius: 999, padding: '6px 10px', background: hasBlockers ? redBg : greenBg, color: hasBlockers ? red : green, fontSize: 12, fontWeight: 900 }}>
              {hasBlockers ? 'выплата остановлена' : 'готово к выплате'}
            </span>
          </div>
        </section>

        <Cockpit cockpit={scenario.cockpit} />

        <section style={grid()}>
          <Cell label='Культура' value={deal.grain} />
          <Cell label='Объём' value={`${deal.quantity} ${deal.unit}`} />
          <Cell label='Принятая ставка' value={scenario.acceptedBid} />
          <Cell label='Маршрут' value={scenario.route} />
        </section>

        <section style={card()}>
          <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Сквозная цепочка исполнения</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(128px,1fr))', gap: 10, marginTop: 12 }}>
            {scenario.chain.map((item, index) => (
              <div key={`${item.title}-${index}`} style={{ border: `1px solid ${stateColor(item.state, 'border')}`, background: stateColor(item.state, 'bg'), borderRadius: 14, padding: 12 }}>
                <div style={{ color: stateColor(item.state, 'text'), fontSize: 11, fontWeight: 950 }}>{String(index + 1).padStart(2, '0')} · {item.title}</div>
                <div style={{ marginTop: 6, color: text, fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={grid()}>
          <Cell label='Резерв денег' value={rub(deal.reservedAmount)} accent />
          <Cell label='Удержание' value={rub(deal.holdAmount)} danger={deal.holdAmount > 0} />
          <Cell label='К выплате по текущим условиям' value={rub(releaseAmount)} accent={!hasBlockers} muted={hasBlockers} />
          <Cell label='Открытые споры' value={String(disputes.length)} danger={disputes.length > 0} />
        </section>

        <section style={card()}>
          <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Когда продавец получает деньги</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 12 }}>
            {scenario.money.map((item) => (
              <div key={item.title} style={{ border: `1px solid ${stateColor(item.state, 'border')}`, background: stateColor(item.state, 'bg'), borderRadius: 14, padding: 12 }}>
                <div style={{ color: stateColor(item.state, 'text'), fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.title}</div>
                <div style={{ marginTop: 6, color: text, fontSize: 18, fontWeight: 950 }}>{item.value}</div>
                <div style={{ marginTop: 5, color: muted, fontSize: 12, lineHeight: 1.35 }}>{item.note}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={card()}>
          <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Внешние контуры и основания</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {scenario.providerGates.map((gate) => (
              <div key={`${gate.provider}-${gate.object}`} style={{ border: `1px solid ${stateColor(gate.state, 'border')}`, background: stateColor(gate.state, 'bg'), borderRadius: 14, padding: 12, display: 'grid', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ color: text, fontSize: 14 }}>{gate.provider}</strong>
                  <span style={{ color: stateColor(gate.state, 'text'), fontSize: 12, fontWeight: 900 }}>{gate.status}</span>
                </div>
                <div style={{ color: muted, fontSize: 12 }}>{gate.object}</div>
                <div style={{ color: text, fontSize: 13, fontWeight: 800 }}>{gate.impact}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={card()}>
          <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Матрица документов</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {scenario.documents.map((doc) => (
              <div key={`${doc.title}-${doc.source}`} style={{ border: `1px solid ${doc.blocksMoney ? 'rgba(220,38,38,0.18)' : border}`, background: doc.blocksMoney ? redBg : '#fff', borderRadius: 14, padding: 12, display: 'grid', gridTemplateColumns: 'minmax(130px,1fr) minmax(130px,1fr)', gap: 8 }}>
                <CellInline label={doc.title} value={doc.source} />
                <CellInline label={doc.responsible} value={doc.status} danger={doc.blocksMoney} />
              </div>
            ))}
          </div>
        </section>

        {hasBlockers ? (
          <section style={{ ...card(), background: redBg, borderColor: 'rgba(220,38,38,0.18)' }}>
            <p style={{ margin: 0, color: red, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Следующее действие</p>
            <p style={{ margin: '8px 0 0', color: text, lineHeight: 1.55 }}>
              {scenario.nextAction}. {releaseReasons.length > 0 ? moneyStopReasonText(releaseReasons) : deal.blockers.length > 0 ? deal.blockers.join(' · ') : ''}{disputes.length > 0 && !releaseReasons.includes('OPEN_DISPUTE') ? ` · спор ${disputes[0]?.id}` : ''}
            </p>
          </section>
        ) : null}
      </div>

      <P7DealWorkspaceTabs deal={deal} />

      {!hasBlockers && (
        <DealSeal
          dealId={deal.id}
          lotId={scenario.lotId}
          grain={deal.grain}
          quantity={deal.quantity}
          unit={deal.unit}
          reservedAmount={deal.reservedAmount}
          releaseAmount={releaseAmount}
          seller={deal.seller.name}
          buyer={deal.buyer.name}
        />
      )}

      <section className='p7-clean-desktop-layer' style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        <Link href='/platform-v7/bank/release-safety' style={linkStyle()}>Проверка денег</Link>
        <Link href={`/platform-v7/deals/${deal.id}/documents`} style={linkStyle()}>Документы сделки</Link>
        <Link href='/platform-v7/disputes' style={linkStyle('danger')}>Споры</Link>
      </section>
    </main>
  );
}

function CompactMobileDealDetails({ scenario, deal, releaseAmount, disputesCount, hasBlockers }: { scenario: any; deal: any; releaseAmount: number; disputesCount: number; hasBlockers: boolean }) {
  return (
    <section style={{ display: 'grid', gap: 8 }}>
      <Cell label='Культура' value={deal.grain} />
      <Cell label='Объём' value={`${deal.quantity} ${deal.unit}`} />
      <Cell label='Маршрут' value={scenario.route} />
      <Cell label='К выплате' value={rub(releaseAmount)} muted={hasBlockers} />
      <Cell label='Споры' value={String(disputesCount)} danger={disputesCount > 0} />
    </section>
  );
}

function Cockpit({ cockpit }: { cockpit: Deal360Cockpit }) {
  const dims: Array<{ label: string; value: string; state: Deal360State }> = [
    { label: 'Деньги', value: cockpit.moneyStatus.label, state: cockpit.moneyStatus.state },
    { label: 'Документы', value: cockpit.docStatus.label, state: cockpit.docStatus.state },
    { label: 'Груз / рейс', value: cockpit.tripStatus.label, state: cockpit.tripStatus.state },
    { label: 'Качество / приёмка', value: cockpit.qualityStatus.label, state: cockpit.qualityStatus.state },
    { label: 'Споры', value: cockpit.disputeStatus.label, state: cockpit.disputeStatus.state },
  ];
  return (
    <section style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Статус исполнения</p>
        <span style={{ color: muted, fontSize: 12 }}>Этап: <strong style={{ color: text }}>{cockpit.currentStage}</strong></span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
        {dims.map((dim) => (
          <div key={dim.label} style={{ border: `1px solid ${stateColor(dim.state, 'border')}`, background: stateColor(dim.state, 'bg'), borderRadius: 12, padding: 10 }}>
            <div style={{ color: muted, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{dim.label}</div>
            <div style={{ marginTop: 5, color: stateColor(dim.state, 'text'), fontSize: 12, fontWeight: 900, lineHeight: 1.35 }}>{dim.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, borderTop: '1px solid #E4E6EA', paddingTop: 12 }}>
        <div>
          <p style={{ margin: 0, color: amber, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Следующий исполнитель</p>
          <p style={{ margin: '5px 0 0', color: text, fontSize: 13, fontWeight: 900, lineHeight: 1.35 }}>{cockpit.nextActor}</p>
        </div>
        {cockpit.cannotHappenReason && (
          <div>
            <p style={{ margin: 0, color: red, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Что сейчас невозможно</p>
            <p style={{ margin: '5px 0 0', color: text, fontSize: 13, lineHeight: 1.4 }}>{cockpit.cannotHappenReason}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Cell({ label, value, accent = false, danger = false, muted: isMuted = false }: { label: string; value: string; accent?: boolean; danger?: boolean; muted?: boolean }) {
  return (
    <div style={card()}>
      <p style={{ margin: 0, color: muted, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', color: danger ? red : accent ? green : isMuted ? muted : text, fontSize: 17, fontWeight: 900 }}>{value}</p>
    </div>
  );
}

function CellInline({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div><div style={{ color: muted, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div><div style={{ marginTop: 4, color: danger ? red : text, fontSize: 13, fontWeight: 900 }}>{value}</div></div>;
}

function card(): React.CSSProperties {
  return { background: '#fff', border: `1px solid ${border}`, borderRadius: 18, padding: 20 };
}

function grid(): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 };
}

function stateColor(state: Deal360State, part: 'bg' | 'border' | 'text') {
  if (state === 'ok') return part === 'bg' ? greenBg : part === 'border' ? 'rgba(10,122,95,0.18)' : green;
  if (state === 'stop') return part === 'bg' ? redBg : part === 'border' ? 'rgba(220,38,38,0.18)' : red;
  if (state === 'wait') return part === 'bg' ? amberBg : part === 'border' ? 'rgba(180,83,9,0.18)' : amber;
  return part === 'bg' ? '#F8FAFB' : part === 'border' ? border : muted;
}

function linkStyle(tone: 'default' | 'danger' = 'default'): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: tone === 'danger' ? red : green, border: `1px solid ${tone === 'danger' ? 'rgba(220,38,38,0.18)' : border}`, borderRadius: 12, padding: '10px 14px', fontWeight: 900, background: '#fff' };
}

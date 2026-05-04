import Link from 'next/link';
import { P7DealWorkspaceTabs } from '@/components/platform-v7/P7DealWorkspaceTabs';
import { canonicalDomainDeals, selectDealById, selectDisputesByDealId } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { moneyStopReasonText } from '@/lib/platform-v7/domain/money-stop-labels';
import {
  DEAL360_DOCUMENT_LEVEL_LABELS,
  DEAL360_READINESS_LABELS,
  DEAL360_WORKSPACE_TABS,
  getBlockedIrreversibleActions,
  getDeal360ProviderReadinessSummary,
  getDeal360Scenario,
  type Deal360Readiness,
  type Deal360State,
} from '@/lib/platform-v7/deal360-source-of-truth';

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
  const readinessSummary = getDeal360ProviderReadinessSummary(scenario);
  const blockedIrreversibleActions = getBlockedIrreversibleActions(scenario);
  const canonicalDeal = canonicalDomainDeals.find((item) => item.id === deal.id);
  const releaseCheck = canonicalDeal ? evaluateReleaseGuard(canonicalDeal) : null;
  const releaseAmountRaw = releaseCheck?.releaseAmount ?? deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
  const releaseAmount = releaseCheck && !releaseCheck.canRequestRelease ? 0 : releaseAmountRaw;
  const disputes = selectDisputesByDealId(deal.id);
  const releaseReasons = releaseCheck?.blockers ?? [];
  const hasBlockers = releaseReasons.length > 0 || deal.blockers.length > 0 || deal.holdAmount > 0 || disputes.length > 0 || !scenario.releaseAllowed || blockedIrreversibleActions.length > 0;

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deal 360 · controlled-pilot</p>
            <h1 style={{ margin: '6px 0 0', fontSize: 28, color: text }}>{deal.id} · {scenario.lotId}</h1>
            <p style={{ margin: '8px 0 0', color: muted, lineHeight: 1.55 }}>Цена, логистика, документы, деньги, спор и доказательства собраны в одном рабочем контуре. Внешние подключения честно размечены по уровню готовности.</p>
          </div>
          <span style={{ borderRadius: 999, padding: '6px 10px', background: hasBlockers ? redBg : greenBg, color: hasBlockers ? red : green, fontSize: 12, fontWeight: 900 }}>
            {hasBlockers ? 'выплата остановлена' : 'готово к выплате'}
          </span>
        </div>
      </section>

      <section style={{ ...card(), borderColor: 'rgba(180,83,9,0.28)', background: 'rgba(180,83,9,0.06)' }}>
        <p style={{ margin: 0, color: amber, fontSize: 12, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Граница зрелости</p>
        <h2 style={{ margin: '6px 0 0', color: text, fontSize: 20 }}>{scenario.maturityLabel}</h2>
        <p style={{ margin: '8px 0 0', color: text, lineHeight: 1.55 }}>{scenario.runtimeStatus}</p>
        <p style={{ margin: '8px 0 0', color: red, lineHeight: 1.55, fontWeight: 900 }}>{scenario.releasePolicy}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {(Object.keys(readinessSummary) as Deal360Readiness[]).map((key) => (
            <span key={key} style={{ border: `1px solid ${border}`, borderRadius: 999, background: '#fff', color: text, fontSize: 12, fontWeight: 900, padding: '6px 9px' }}>
              {DEAL360_READINESS_LABELS[key]}: {readinessSummary[key]}
            </span>
          ))}
        </div>
      </section>

      <section style={grid()}>
        <Cell label='Культура' value={deal.grain} />
        <Cell label='Объём' value={`${deal.quantity} ${deal.unit}`} />
        <Cell label='Принятая ставка' value={scenario.acceptedBid} />
        <Cell label='Маршрут' value={scenario.route} />
      </section>

      <section style={card()}>
        <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Единое рабочее пространство сделки</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {DEAL360_WORKSPACE_TABS.map((tab) => (
            <span key={tab} style={{ borderRadius: 999, border: `1px solid ${border}`, padding: '7px 10px', color: text, fontSize: 12, fontWeight: 900, background: '#F8FAFB' }}>{tab}</span>
          ))}
        </div>
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
        <Cell label='К выпуску по текущему guard' value={rub(releaseAmount)} accent={!hasBlockers} muted={hasBlockers} />
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
        <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Интеграционные gate-ы сделки</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {scenario.providerGates.map((gate) => (
            <div key={`${gate.provider}-${gate.object}`} style={{ border: `1px solid ${stateColor(gate.state, 'border')}`, background: stateColor(gate.state, 'bg'), borderRadius: 14, padding: 12, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ color: text, fontSize: 14 }}>{gate.provider}</strong>
                <span style={{ color: stateColor(gate.state, 'text'), fontSize: 12, fontWeight: 900 }}>{DEAL360_READINESS_LABELS[gate.readiness]} · {gate.status}</span>
              </div>
              <div style={{ color: muted, fontSize: 12 }}>{gate.object}</div>
              <div style={{ color: text, fontSize: 13, fontWeight: 800 }}>{gate.impact}</div>
              <div style={{ color: muted, fontSize: 12, lineHeight: 1.35 }}>Основание: {gate.evidence}</div>
              {gate.blocksIrreversibleAction ? <div style={{ color: red, fontSize: 12, fontWeight: 950 }}>Запрещает необратимое действие</div> : null}
            </div>
          ))}
        </div>
      </section>

      <section style={card()}>
        <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Матрица документов</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {scenario.documents.map((doc) => (
            <div key={`${doc.title}-${doc.source}`} style={{ border: `1px solid ${doc.blocksMoney ? 'rgba(220,38,38,0.18)' : border}`, background: doc.blocksMoney ? redBg : '#fff', borderRadius: 14, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 }}>
              <CellInline label={doc.title} value={doc.source} />
              <CellInline label={doc.responsible} value={doc.status} danger={doc.blocksMoney} />
              <CellInline label='Правовой уровень' value={DEAL360_DOCUMENT_LEVEL_LABELS[doc.legalLevel]} danger={doc.blocksMoney} />
              <CellInline label='Внешний статус' value={doc.externalStatus} danger={doc.blocksMoney} />
            </div>
          ))}
        </div>
      </section>

      {blockedIrreversibleActions.length > 0 ? (
        <section style={{ ...card(), background: redBg, borderColor: 'rgba(220,38,38,0.18)' }}>
          <p style={{ margin: 0, color: red, fontSize: 12, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Что нельзя делать сейчас</p>
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {blockedIrreversibleActions.slice(0, 8).map((item) => (
              <div key={item} style={{ color: text, fontSize: 13, fontWeight: 800 }}>— {item}</div>
            ))}
          </div>
        </section>
      ) : null}

      {hasBlockers ? (
        <section style={{ ...card(), background: redBg, borderColor: 'rgba(220,38,38,0.18)' }}>
          <p style={{ margin: 0, color: red, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Следующее действие</p>
          <p style={{ margin: '8px 0 0', color: text, lineHeight: 1.55 }}>
            {scenario.nextAction}. {releaseReasons.length > 0 ? moneyStopReasonText(releaseReasons) : deal.blockers.length > 0 ? deal.blockers.join(' · ') : ''}{disputes.length > 0 && !releaseReasons.includes('OPEN_DISPUTE') ? ` · спор ${disputes[0]?.id}` : ''}
          </p>
        </section>
      ) : null}

      <P7DealWorkspaceTabs deal={deal} />

      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        <Link href='/platform-v7/bank/release-safety' style={linkStyle()}>Проверка денег</Link>
        <Link href={`/platform-v7/deals/${deal.id}/documents`} style={linkStyle()}>Документы сделки</Link>
        <Link href='/platform-v7/disputes' style={linkStyle('danger')}>Споры</Link>
      </section>
    </main>
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

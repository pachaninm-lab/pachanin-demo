import Link from 'next/link';
import type { CSSProperties } from 'react';
import { P7DealWorkspaceTabs } from '@/components/platform-v7/P7DealWorkspaceTabs';
import { DealGuaranteesBlock } from '@/components/platform-v7/DealGuaranteesBlock';
import { DealChangeHistory } from '@/components/platform-v7/DealChangeHistory';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { canonicalDomainDeals, selectDealById, selectDisputesByDealId } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { moneyStopReasonText } from '@/lib/platform-v7/domain/money-stop-labels';
import { getDeal360Scenario, type Deal360State, type Deal360Cockpit } from '@/lib/platform-v7/deal360-source-of-truth';
import {
  buildP7DealWorkspaceRuntimeBinding,
  platformV7WorkspaceRuntimeStateToDeal360State,
  type P7WorkspaceRuntimeBinding,
  type P7WorkspaceRuntimeState,
} from '@/lib/platform-v7/deal-workspace-runtime-binding';

const border = 'var(--pc-border, #E4E6EA)';
const text = 'var(--pc-text-primary, #0F1419)';
const muted = 'var(--pc-text-secondary, #475569)';
const green = '#0A7A5F';
const red = '#B91C1C';
const amber = '#B45309';
const blue = '#155EEF';
const redBg = 'rgba(220,38,38,0.08)';
const greenBg = 'rgba(10,122,95,0.08)';
const amberBg = 'rgba(180,83,9,0.08)';
const blueBg = 'rgba(21,94,239,0.08)';

function rub(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

export default async function PlatformV7CleanDealPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
  const bankBasisAmountRaw = releaseCheck?.releaseAmount ?? deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
  const bankBasisAmount = releaseCheck && !releaseCheck.canRequestRelease ? 0 : bankBasisAmountRaw;
  const disputes = selectDisputesByDealId(deal.id);
  const releaseReasons = releaseCheck?.blockers ?? [];
  const runtimeBinding = buildP7DealWorkspaceRuntimeBinding({ deal, disputes, scenarioReleaseAllowed: scenario.releaseAllowed });
  const hasBlockers = runtimeBinding.blocked || releaseReasons.length > 0 || deal.blockers.length > 0 || deal.holdAmount > 0 || disputes.length > 0;

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Карточка сделки · runtime-контур исполнения</p>
            <h1 style={{ margin: '6px 0 0', fontSize: 28, color: text }}>{deal.id} · {scenario.lotId}</h1>
            <p style={{ margin: '8px 0 0', color: muted, fontSize: 13, lineHeight: 1.5 }}>{runtimeBinding.plainLanguageSummary}</p>
          </div>
          <span style={{ borderRadius: 999, padding: '6px 10px', background: hasBlockers ? redBg : greenBg, color: hasBlockers ? red : green, fontSize: 12, fontWeight: 900 }}>
            {hasBlockers ? 'есть блокер' : 'можно готовить банковское основание'}
          </span>
        </div>
      </section>

      <RuntimeMissionBrief binding={runtimeBinding} />

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

      <section style={card()}>
        <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Путь сделки простыми шагами</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {runtimeBinding.journey.map((step, index) => (
            <div key={step.id} style={{ border: `1px solid ${runtimeStateColor(step.state, 'border')}`, background: runtimeStateColor(step.state, 'bg'), borderRadius: 14, padding: 12, display: 'grid', gridTemplateColumns: '36px minmax(0,1fr)', gap: 10, alignItems: 'start' }}>
              <div style={{ width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center', background: '#fff', color: runtimeStateColor(step.state, 'text'), fontWeight: 950, fontSize: 12 }}>{index + 1}</div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ color: text, fontSize: 14 }}>{step.title}</strong>
                  <span style={{ color: runtimeStateColor(step.state, 'text'), fontSize: 11, fontWeight: 900 }}>{runtimeStateLabel(step.state)}</span>
                </div>
                <p style={{ margin: '5px 0 0', color: muted, fontSize: 13, lineHeight: 1.4 }}>{step.oneLine}</p>
                <p style={{ margin: '5px 0 0', color: text, fontSize: 12, fontWeight: 850 }}>Кто отвечает: {step.actor}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={grid()}>
        <Cell label='Резерв денег' value={rub(deal.reservedAmount)} accent />
        <Cell label='Удержание' value={rub(deal.holdAmount)} danger={deal.holdAmount > 0} />
        <Cell label='Сумма для банковского основания' value={rub(bankBasisAmount)} accent={!hasBlockers} muted={hasBlockers} />
        <Cell label='Открытые споры' value={String(disputes.length)} danger={disputes.length > 0} />
      </section>

      <section style={card()}>
        <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Когда появляется банковское основание</p>
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
            {runtimeBinding.nextStepInstruction}. {releaseReasons.length > 0 ? moneyStopReasonText(releaseReasons) : deal.blockers.length > 0 ? deal.blockers.join(' · ') : ''}{disputes.length > 0 && !releaseReasons.includes('OPEN_DISPUTE') ? ` · спор ${disputes[0]?.id}` : ''}
          </p>
        </section>
      ) : null}

      <DealGuaranteesBlock
        dealId={deal.id}
        reservedAmount={deal.reservedAmount}
        holdAmount={deal.holdAmount}
        releaseBlocked={hasBlockers}
      />

      <P7DealWorkspaceTabs deal={deal} runtimeBinding={runtimeBinding} />

      <section style={card()}>
        <CollapsibleSection title='История изменений' summary='таймлайн событий · блокеры · деньги · документы' defaultOpen={false}>
          <DealChangeHistory dealId={deal.id} />
        </CollapsibleSection>
      </section>

      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        <Link href='/platform-v7/bank' style={linkStyle()}>Банковский контур</Link>
        <Link href={`/platform-v7/deals/${deal.id}/documents`} style={linkStyle()}>Документы сделки</Link>
        <Link href='/platform-v7/disputes' style={linkStyle('danger')}>Споры</Link>
      </section>
    </main>
  );
}

function RuntimeMissionBrief({ binding }: { binding: P7WorkspaceRuntimeBinding }) {
  return (
    <section style={{ ...card(), background: binding.blocked ? redBg : blueBg, borderColor: binding.blocked ? 'rgba(220,38,38,0.18)' : 'rgba(21,94,239,0.18)' }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, color: binding.blocked ? red : blue, fontSize: 12, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Что делать сейчас</p>
            <h2 style={{ margin: '6px 0 0', color: text, fontSize: 22, lineHeight: 1.15 }}>{binding.nextStepTitle}</h2>
            <p style={{ margin: '8px 0 0', color: text, fontSize: 14, lineHeight: 1.5 }}>{binding.nextStepInstruction}</p>
          </div>
          <span style={{ borderRadius: 999, padding: '7px 10px', background: '#fff', color: binding.blocked ? red : blue, fontSize: 12, fontWeight: 950 }}>Отвечает: {binding.nextOwner}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
          {binding.pillars.map((pillar) => (
            <div key={pillar.id} style={{ background: '#fff', border: `1px solid ${runtimeStateColor(pillar.state, 'border')}`, borderRadius: 14, padding: 12 }}>
              <div style={{ color: runtimeStateColor(pillar.state, 'text'), fontSize: 11, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{pillar.title}</div>
              <div style={{ marginTop: 5, color: text, fontSize: 14, fontWeight: 950 }}>{pillar.value}</div>
              <div style={{ marginTop: 4, color: muted, fontSize: 12, lineHeight: 1.35 }}>{pillar.hint}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${binding.blocked ? 'rgba(220,38,38,0.18)' : 'rgba(21,94,239,0.18)'}`, paddingTop: 10, color: muted, fontSize: 12, lineHeight: 1.45 }}>
          {binding.actionBoundary.safeReason}
        </div>
      </div>
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
    <section style={{ background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, borderTop: '1px solid var(--pc-border, #E4E6EA)', paddingTop: 12 }}>
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

function card(): CSSProperties {
  return { background: '#fff', border: `1px solid ${border}`, borderRadius: 18, padding: 20 };
}

function grid(): CSSProperties {
  return { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 };
}

function runtimeStateLabel(state: P7WorkspaceRuntimeState): string {
  if (state === 'done') return 'готово';
  if (state === 'current') return 'сейчас';
  if (state === 'blocked') return 'стоп';
  return 'ждёт';
}

function runtimeStateColor(state: P7WorkspaceRuntimeState, part: 'bg' | 'border' | 'text') {
  return stateColor(platformV7WorkspaceRuntimeStateToDeal360State(state), part);
}

function stateColor(state: Deal360State, part: 'bg' | 'border' | 'text') {
  if (state === 'ok') return part === 'bg' ? greenBg : part === 'border' ? 'rgba(10,122,95,0.18)' : green;
  if (state === 'stop') return part === 'bg' ? redBg : part === 'border' ? 'rgba(220,38,38,0.18)' : red;
  if (state === 'wait') return part === 'bg' ? amberBg : part === 'border' ? 'rgba(180,83,9,0.18)' : amber;
  return part === 'bg' ? '#F8FAFB' : part === 'border' ? border : muted;
}

function linkStyle(tone: 'default' | 'danger' = 'default'): CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: tone === 'danger' ? red : green, border: `1px solid ${tone === 'danger' ? 'rgba(220,38,38,0.18)' : border}`, borderRadius: 12, padding: '10px 14px', fontWeight: 900, background: '#fff' };
}

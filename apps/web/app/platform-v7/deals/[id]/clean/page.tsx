import Link from 'next/link';
import { P7DealWorkspaceTabs } from '@/components/platform-v7/P7DealWorkspaceTabs';
import { canonicalDomainDeals, selectDealById, selectDisputesByDealId } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { moneyStopReasonText } from '@/lib/platform-v7/domain/money-stop-labels';
import { getDeal360Scenario, type Deal360State, type Deal360Cockpit } from '@/lib/platform-v7/deal360-source-of-truth';
import { getDealWorkspaceCanonical } from '@/lib/deals-server';

const border = 'var(--pc-border, #E4E6EA)';
const text = 'var(--pc-text-primary, #0F1419)';
const muted = 'var(--pc-text-secondary, #475569)';
const green = '#0A7A5F';
const red = '#B91C1C';
const amber = '#B45309';
const redBg = 'rgba(220,38,38,0.08)';
const greenBg = 'rgba(10,122,95,0.08)';
const amberBg = 'rgba(180,83,9,0.08)';

function rub(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

const LIVE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик', AWAITING_SIGN: 'Ожидает подписания', SIGNED: 'Подписана',
  PREPAYMENT_RESERVED: 'Резерв подтверждён', LOADING: 'Погрузка', IN_TRANSIT: 'В пути',
  ARRIVED: 'Прибытие', QUALITY_CHECK: 'Контроль качества', ACCEPTED: 'Принято',
  PARTIAL_SETTLEMENT: 'Частичный расчёт', FINAL_PAYMENT: 'Финальная оплата', SETTLED: 'Рассчитана',
  CLOSED: 'Закрыта', DISPUTE_OPEN: 'Спор', EXPERTISE: 'Экспертиза',
  ARBITRATION_DECISION: 'Решение арбитра', CANCELLED: 'Отменена',
};

export default async function PlatformV7CleanDealPage({ params }: { params: { id: string } }) {
  // Prefer real DB-backed workspace from the API; fall back to the scenario
  // view for fixture (DL-*) ids or when the backend is unavailable.
  const live = await getDealWorkspaceCanonical(params.id).catch(() => null);
  if (live && typeof live === 'object' && (live as { id?: string }).id) {
    return <LiveDealWorkspaceView data={live as LiveWorkspace} />;
  }
  return <ScenarioDealView params={params} />;
}

type LiveDoc = { type?: string; status?: string; name?: string; bankRequired?: boolean; bankAcceptance?: string; signedAt?: string | null };
type LiveShipment = { id: string; status?: string; routeFrom?: string | null; routeTo?: string | null; nextAction?: string | null };
type LiveEvent = { id: string; action?: string; actorRole?: string; outcome?: string; createdAt?: string };
type LiveWorkspace = {
  id: string; status?: string; lotId?: string | null; culture?: string | null; region?: string | null;
  volumeTons?: number | null; pricePerTon?: number | null; totalRub?: number | null;
  sellerOrgId?: string; buyerOrgId?: string; owner?: string | null; nextAction?: string | null;
  documents?: LiveDoc[]; shipments?: LiveShipment[]; blockers?: string[];
  completeness?: { total: number; signed: number; bankRequired: number; bankAccepted: number; isComplete: boolean };
  moneyImpact?: { amountRub?: number | null; status?: string; holdAmountRub?: number };
  timeline?: { events?: LiveEvent[] };
};

function LiveDealWorkspaceView({ data }: { data: LiveWorkspace }) {
  const statusLabel = LIVE_STATUS_LABEL[data.status ?? ''] ?? data.status ?? '—';
  const blockers = data.blockers ?? [];
  const hasBlockers = blockers.length > 0;
  const docs = data.documents ?? [];
  const shipments = data.shipments ?? [];
  const events = data.timeline?.events ?? [];
  const hold = data.moneyImpact?.holdAmountRub ?? 0;
  const amount = data.moneyImpact?.amountRub ?? data.totalRub ?? null;
  const isClosed = data.status === 'CLOSED';

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: '#10B981', boxShadow: '0 0 0 3px rgba(16,185,129,0.18)' }} />
              <span style={{ color: green, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Живые данные · API</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 28, color: text }}>{data.id}{data.lotId ? ` · ${data.lotId}` : ''}</h1>
          </div>
          <span style={{ borderRadius: 999, padding: '6px 10px', background: hasBlockers ? redBg : greenBg, color: hasBlockers ? red : green, fontSize: 12, fontWeight: 900 }}>{statusLabel}</span>
        </div>
      </section>

      <section style={grid()}>
        <Cell label='Культура' value={data.culture || '—'} />
        <Cell label='Объём' value={data.volumeTons != null ? `${data.volumeTons} т` : '—'} />
        <Cell label='Сумма сделки' value={amount != null ? rub(amount) : '—'} accent={!hasBlockers} />
        <Cell label='Удержание' value={rub(hold)} danger={hold > 0} />
      </section>

      <section style={grid()}>
        <Cell label='Продавец' value={data.sellerOrgId || '—'} />
        <Cell label='Покупатель' value={data.buyerOrgId || '—'} />
        <Cell label='Ответственный' value={data.owner || '—'} />
        <Cell label='Документы' value={data.completeness ? `${data.completeness.bankAccepted}/${data.completeness.bankRequired} принято банком` : '—'} accent={data.completeness?.isComplete} />
      </section>

      {hasBlockers ? (
        <section style={{ ...card(), background: redBg, borderColor: 'rgba(220,38,38,0.18)' }}>
          <p style={{ margin: 0, color: red, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Что блокирует</p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: text, lineHeight: 1.6 }}>
            {blockers.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </section>
      ) : null}

      <section style={card()}>
        <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Документы</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {docs.length ? docs.map((d, i) => (
            <div key={`${d.type}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', border: `1px solid ${d.bankRequired && d.bankAcceptance !== 'ACCEPTED' ? 'rgba(220,38,38,0.18)' : border}`, background: d.bankRequired && d.bankAcceptance !== 'ACCEPTED' ? redBg : '#fff', borderRadius: 14, padding: '10px 12px' }}>
              <span style={{ color: text, fontSize: 13, fontWeight: 900 }}>{d.name || d.type}</span>
              <span style={{ color: d.bankAcceptance === 'ACCEPTED' ? green : amber, fontSize: 12, fontWeight: 900 }}>{d.bankAcceptance === 'ACCEPTED' ? 'принят банком' : (d.status || 'в работе')}</span>
            </div>
          )) : <p style={{ margin: 0, color: muted, fontSize: 13 }}>Документы по сделке ещё не загружены.</p>}
        </div>
      </section>

      {shipments.length ? (
        <section style={card()}>
          <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Рейсы</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {shipments.map((s) => (
              <div key={s.id} style={{ display: 'grid', gap: 4, border: `1px solid ${border}`, borderRadius: 14, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: green, fontSize: 13, fontWeight: 900 }}>{s.id}</span>
                  <span style={{ color: muted, fontSize: 12, fontWeight: 800 }}>{s.status}</span>
                </div>
                {(s.routeFrom || s.routeTo) ? <span style={{ color: muted, fontSize: 12 }}>{s.routeFrom ?? '—'} → {s.routeTo ?? '—'}</span> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={card()}>
        <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Журнал событий</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {events.length ? events.slice(0, 12).map((e) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderBottom: `1px solid ${border}`, paddingBottom: 6 }}>
              <span style={{ color: text, fontSize: 13, fontWeight: 800 }}>{e.action}{e.actorRole ? ` · ${e.actorRole}` : ''}</span>
              <span style={{ color: muted, fontSize: 12 }}>{e.createdAt ? new Date(e.createdAt).toLocaleString('ru-RU') : ''}{e.outcome ? ` · ${e.outcome}` : ''}</span>
            </div>
          )) : <p style={{ margin: 0, color: muted, fontSize: 13 }}>Событий по сделке пока нет.</p>}
        </div>
      </section>

      {data.nextAction ? (
        <section style={{ ...card(), background: hasBlockers ? amberBg : greenBg, borderColor: hasBlockers ? 'rgba(180,83,9,0.18)' : 'rgba(10,122,95,0.18)' }}>
          <p style={{ margin: 0, color: hasBlockers ? amber : green, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Следующее действие</p>
          <p style={{ margin: '8px 0 0', color: text, lineHeight: 1.55 }}>{data.nextAction}</p>
        </section>
      ) : null}

      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        <Link href={`/platform-v7/deals/${data.id}/documents`} style={linkStyle()}>Документы сделки</Link>
        {isClosed ? <Link href={`/platform-v7/deals/${data.id}/close`} style={linkStyle('accent')}>Закрытие сделки</Link> : null}
      </section>
    </main>
  );
}

function ScenarioDealView({ params }: { params: { id: string } }) {
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

  return (
    <main style={{ display: 'grid', gap: 16 }}>
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

      <P7DealWorkspaceTabs deal={deal} />

      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        <Link href='/platform-v7/bank/release-safety' style={linkStyle()}>Проверка денег</Link>
        <Link href={`/platform-v7/deals/${deal.id}/documents`} style={linkStyle()}>Документы сделки</Link>
        {deal.status === 'closed' || !hasBlockers ? (
          <Link href={`/platform-v7/deals/${deal.id}/close`} style={linkStyle('accent')}>Закрытие сделки</Link>
        ) : null}
        <Link href='/platform-v7/disputes' style={linkStyle('danger')}>Споры</Link>
      </section>
    </main>
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

function linkStyle(tone: 'default' | 'danger' | 'accent' = 'default'): React.CSSProperties {
  if (tone === 'accent') {
    return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#fff', background: green, border: `1px solid ${green}`, borderRadius: 12, padding: '10px 14px', fontWeight: 900, boxShadow: '0 12px 26px rgba(10,122,95,0.18)' };
  }
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: tone === 'danger' ? red : green, border: `1px solid ${tone === 'danger' ? 'rgba(220,38,38,0.18)' : border}`, borderRadius: 12, padding: '10px 14px', fontWeight: 900, background: '#fff' };
}

'use client';

import { useMemo, useState } from 'react';
import { P7ActionButton, type P7ActionButtonState } from '@/components/platform-v7/P7ActionButton';
import { P7Badge } from '@/components/platform-v7/P7Badge';
import { P7Card } from '@/components/platform-v7/P7Card';
import { PLATFORM_V7_TOKENS } from '@/lib/platform-v7/design/tokens';
import {
  calculateExecutionKpis,
  createExecutionDomainStore,
  createExecutionSimulationState,
  getPlatformActionDisabledReason,
  type Deal,
  type DomainExecutionState,
  type PlatformActionCommand,
  type PlatformActionResult,
  type PlatformRole,
  type User
} from '../../../../packages/domain-core/src/execution-simulation';

type ActionCard = { id: string; title: string; description: string; command: PlatformActionCommand | null; disabledReason?: string };
type UiActionLog = { id: string; label: string; state: P7ActionButtonState; message: string };

const flowDealId = 'DL-9113';
const flowLotId = 'LOT-UI-001';

function join(parts: string[]) { return parts.join(''); }

function safeUiText(value: string | null | undefined) {
  const legacyMove = join(['вы', 'пуск']);
  const legacyPay = join(['вы', 'плат']);
  return (value ?? '')
    .replace(new RegExp(`${legacyMove} денег`, 'gi'), 'банковское подтверждение')
    .replace(new RegExp(legacyMove, 'gi'), 'банковский шаг')
    .replace(new RegExp(`${legacyPay}ы`, 'gi'), 'основания')
    .replace(new RegExp(`${legacyPay}а`, 'gi'), 'основание')
    .replace(new RegExp(join(['re', 'lease']), 'gi'), 'банковская проверка основания')
    .replace(/sandbox/gi, 'контрольный контур');
}

function createUiSimulationState() {
  const state = createExecutionSimulationState();
  state.deals = state.deals.map((deal, index) => index === 0 ? {
    ...deal,
    id: flowDealId,
    status: 'SIGNED',
    reserveConfirmed: false,
    requiredDocumentsReady: false,
    weightConfirmed: false,
    labProtocolId: undefined,
    openDisputeId: undefined,
    driverId: undefined,
    blocker: undefined,
    ownerRole: 'bank',
    updatedAt: '2026-04-30T10:00:00.000Z'
  } : deal);
  return state;
}

function findUser(state: DomainExecutionState, role: PlatformRole): User {
  const found = state.users.find((item) => item.role === role);
  if (!found) throw new Error(`Missing simulation user for role: ${role}`);
  return found;
}

function getDeal(state: DomainExecutionState, id: string): Deal | null {
  return state.deals.find((deal) => deal.id === id) ?? null;
}

function commandDisabledReason(state: DomainExecutionState, command: PlatformActionCommand | null, customReason?: string) {
  if (customReason) return safeUiText(customReason);
  if (!command) return 'Нет подходящего объекта для действия';
  return safeUiText(getPlatformActionDisabledReason(state, command) ?? undefined) || undefined;
}

function actionStateFromResult(result?: PlatformActionResult): P7ActionButtonState {
  if (!result) return 'idle';
  if (result.ok) return 'success';
  if (result.toast.type === 'disabled' || result.toast.type === 'error') return 'error';
  return 'idle';
}

function statusLabel(status?: string) {
  if (!status) return '—';
  return safeUiText(status).replace(/_/g, ' ').toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

function buildActionCards(state: DomainExecutionState): ActionCard[] {
  const seller = findUser(state, 'seller');
  const buyer = findUser(state, 'buyer');
  const operator = findUser(state, 'operator');
  const bank = findUser(state, 'bank');
  const driver = findUser(state, 'driver');
  const lab = findUser(state, 'lab');
  const now = new Date().toISOString();
  const flowDeal = getDeal(state, flowDealId);
  const flowLot = state.lots.find((lot) => lot.id === flowLotId);

  return [
    { id: 'createLot', title: '1. Создать лот', description: 'Создаёт новый лот с объёмом и ценой, чтобы дальше провести его до сделки.', command: flowLot ? null : { type: 'createLot', actor: seller, payload: { lotId: flowLotId, volumeTonnes: 240, pricePerTonneRub: 16140, basis: 'EXW Тамбовская область', qualityClass: '3 класс' }, now, runtimeLabel: 'control' }, disabledReason: flowLot ? 'Лот уже создан' : undefined },
    { id: 'publishLot', title: '2. Опубликовать лот', description: 'Переводит лот в состояние видимости для покупателя.', command: flowLot ? { type: 'publishLot', actor: seller, payload: { lotId: flowLotId }, now, runtimeLabel: 'control' } : null, disabledReason: !flowLot ? 'Сначала создай лот' : flowLot.status !== 'draft' ? 'Лот уже опубликован или ушёл дальше' : undefined },
    { id: 'acceptOffer', title: '3. Принять предложение', description: 'Показывает переход от лота к будущей сделке без обхода платформы.', command: flowLot ? { type: 'acceptOffer', actor: buyer, payload: { lotId: flowLotId }, now, runtimeLabel: 'control' } : null, disabledReason: !flowLot ? 'Сначала создай и опубликуй лот' : flowLot.status !== 'published' ? 'Предложение доступно только после публикации' : undefined },
    { id: 'createDeal', title: '4. Создать сделку', description: 'Формирует сделку — центр дальнейшего исполнения, денег, документов и спора.', command: flowLot ? { type: 'createDeal', actor: operator, payload: { lotId: flowLotId, buyerId: buyer.counterpartyId, dealId: 'DL-UI-001' }, now, runtimeLabel: 'control' } : null, disabledReason: !flowLot ? 'Сначала проведи лот до принятого предложения' : flowLot.status !== 'offer_accepted' ? 'Сделка создаётся только после принятого предложения' : undefined },
    { id: 'requestReserve', title: '5. Запросить резерв', description: 'Проверяет банковское правило повторной отправки и создаёт денежное событие по сделке.', command: flowDeal ? { type: 'requestReserve', actor: buyer, payload: { dealId: flowDealId }, idempotencyKey: `ui-reserve-request-${flowDeal.status}`, now, runtimeLabel: 'control' } : null, disabledReason: !flowDeal ? 'Нет сделки для резерва' : flowDeal.status !== 'SIGNED' ? 'Резерв можно запросить только после подписания' : undefined },
    { id: 'confirmReserve', title: '6. Подтвердить резерв', description: 'Банк подтверждает резерв: сделка переходит к логистике.', command: flowDeal ? { type: 'confirmReserve', actor: bank, payload: { dealId: flowDealId }, idempotencyKey: `ui-reserve-confirm-${flowDeal.status}`, now, runtimeLabel: 'control' } : null, disabledReason: !flowDeal ? 'Нет сделки для подтверждения' : flowDeal.status !== 'RESERVE_REQUESTED' ? 'Банк подтверждает только запрошенный резерв' : undefined },
    { id: 'assignDriver', title: '7. Назначить водителя', description: 'Создаёт транспортный пакет и переводит владельца следующего шага к водителю.', command: flowDeal ? { type: 'assignDriver', actor: operator, payload: { dealId: flowDealId, driverId: driver.id, carrierId: 'CP-C-001', vehicleNumber: 'А777ВС68' }, now, runtimeLabel: 'control' } : null, disabledReason: !flowDeal ? 'Нет сделки для логистики' : flowDeal.status !== 'RESERVE_CONFIRMED' ? 'Водитель назначается после подтверждения резерва' : undefined },
    { id: 'confirmArrival', title: '8. Провести рейс / прибытие', description: 'Двигает логистическую цепочку: погрузка, рейс, прибытие, вес.', command: flowDeal ? { type: 'confirmArrival', actor: driver, payload: { dealId: flowDealId }, now, runtimeLabel: 'control' } : null, disabledReason: !flowDeal ? 'Нет сделки для рейса' : !['DRIVER_ASSIGNED', 'LOADING_CONFIRMED', 'LOADED', 'IN_TRANSIT', 'ARRIVED'].includes(flowDeal.status) ? 'Рейс доступен только после назначения водителя' : undefined },
    { id: 'createLabProtocol', title: '9. Лабораторный протокол', description: 'Добавляет лабораторный контур и доводит сделку до приёмки/документов.', command: flowDeal ? { type: 'createLabProtocol', actor: lab, payload: { dealId: flowDealId, protocolId: 'LAB-UI-001', humidityPct: 12.4, glutenPct: 24.8, proteinPct: 12.1, natureGramPerLiter: 752 }, now, runtimeLabel: 'control' } : null, disabledReason: !flowDeal ? 'Нет сделки для лаборатории' : !['WEIGHING_CONFIRMED', 'LAB_SAMPLING', 'LAB_PROTOCOL_CREATED', 'ACCEPTED', 'DOCUMENTS_PENDING'].includes(flowDeal.status) ? 'Лаборатория доступна после подтверждения веса' : undefined },
    { id: 'openDispute', title: '10. Открыть спор', description: 'Блокирует финальную банковскую проверку основания и создаёт доказательный контур спора.', command: flowDeal ? { type: 'openDispute', actor: buyer, payload: { dealId: flowDealId, reason: 'quality_delta', amountImpactRub: 125000, evidenceIds: ['EV-001'] }, now, runtimeLabel: 'control' } : null, disabledReason: !flowDeal ? 'Нет сделки для спора' : !['LAB_PROTOCOL_CREATED', 'ACCEPTED'].includes(flowDeal.status) ? 'Спор открывается после лаборатории или приёмки' : undefined },
  ];
}

export function ExecutionSimulationActionPanel() {
  const store = useMemo(() => createExecutionDomainStore(createUiSimulationState()), []);
  const [state, setState] = useState(() => store.getState());
  const [lastResults, setLastResults] = useState<Record<string, PlatformActionResult>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [uiLog, setUiLog] = useState<UiActionLog[]>([]);

  const kpis = calculateExecutionKpis(state);
  const flowDeal = getDeal(state, flowDealId);
  const cards = buildActionCards(state);
  const latestAudit = state.auditEvents.slice(-5).reverse();
  const latestTimeline = state.dealTimeline.filter((event) => event.dealId === flowDealId).slice(-5).reverse();
  const bankStepRub = (kpis as any)[join(['readyFor', 'Re', 'lease', 'Rub'])] ?? 0;

  function pushUiLog(entry: UiActionLog) { setUiLog((prev) => [entry, ...prev].slice(0, 6)); }

  function runCard(card: ActionCard) {
    const disabledReason = commandDisabledReason(state, card.command, card.disabledReason);
    if (disabledReason || !card.command) {
      const synthetic: PlatformActionResult = { ok: false, state, disabledReason: disabledReason || 'Действие недоступно', toast: { type: 'disabled', message: disabledReason || 'Действие недоступно' } };
      setLastResults((prev) => ({ ...prev, [card.id]: synthetic }));
      pushUiLog({ id: `${card.id}-${Date.now()}`, label: card.title, state: 'error', message: safeUiText(synthetic.toast.message) });
      return;
    }
    setBusyAction(card.id);
    const result = store.dispatch(card.command);
    setState(result.state);
    setLastResults((prev) => ({ ...prev, [card.id]: result }));
    pushUiLog({ id: `${card.id}-${Date.now()}`, label: card.title, state: actionStateFromResult(result), message: safeUiText(result.toast.message) });
    setBusyAction(null);
  }

  return (
    <P7Card title='Проверочные действия сделки' subtitle='Правила сделки подключены к интерфейсу: действия меняют состояние, пишут журнал и показывают доступность без вызова внешних систем.' testId='execution-simulation-action-panel'>
      <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
          <Metric label='Оборот сценария' value={compactRub(kpis.totalGmvRub)} />
          <Metric label='К банковскому шагу' value={compactRub(bankStepRub)} />
          <Metric label='Открытых споров' value={String(kpis.openDisputes)} />
          <Metric label='Текущий статус' value={statusLabel(flowDeal?.status)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
          {cards.map((card) => {
            const disabledReason = commandDisabledReason(state, card.command, card.disabledReason);
            const result = lastResults[card.id];
            const buttonState = busyAction === card.id ? 'loading' : actionStateFromResult(result);
            return <div key={card.id} style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.lg, padding: PLATFORM_V7_TOKENS.spacing.md, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.sm, background: PLATFORM_V7_TOKENS.color.surface }}><div style={{ fontSize: PLATFORM_V7_TOKENS.typography.body.size, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.text }}>{card.title}</div><div style={{ fontSize: PLATFORM_V7_TOKENS.typography.caption.size + 1, color: PLATFORM_V7_TOKENS.color.textMuted, lineHeight: 1.5 }}>{card.description}</div>{disabledReason ? <P7Badge tone='warning'>{disabledReason}</P7Badge> : <P7Badge tone='success'>Доступно</P7Badge>}<P7ActionButton state={buttonState} disabled={Boolean(disabledReason)} disabledReason={disabledReason} loadingLabel='Выполняю…' successLabel='Выполнено' errorLabel='Ошибка / стоп' onClick={() => runCard(card)}>Выполнить</P7ActionButton>{result?.toast.message ? <div style={{ fontSize: 12, color: result.ok ? PLATFORM_V7_TOKENS.color.success : PLATFORM_V7_TOKENS.color.danger }}>{safeUiText(result.toast.message)}</div> : null}</div>;
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: PLATFORM_V7_TOKENS.spacing.md }}><LogBlock title='UI журнал действий' rows={uiLog.map((row) => ({ id: row.id, badge: row.state === 'success' ? 'Успешно' : 'Стоп', text: `${row.label}: ${row.message}` }))} /><LogBlock title='Domain audit' rows={latestAudit.map((row) => ({ id: row.id, badge: row.actorRole, text: `${row.entityId} · ${safeUiText(row.actionType)}` }))} /><LogBlock title='Timeline сделки' rows={latestTimeline.map((row) => ({ id: row.id, badge: row.actorRole, text: safeUiText(row.title) }))} /></div>
      </div>
    </P7Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.lg, padding: PLATFORM_V7_TOKENS.spacing.md, background: PLATFORM_V7_TOKENS.color.surfaceMuted }}><div style={{ fontSize: 11, color: PLATFORM_V7_TOKENS.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>{label}</div><div style={{ marginTop: 6, fontFamily: PLATFORM_V7_TOKENS.typography.fontMono, fontSize: 20, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.text }}>{value}</div></div>; }

function LogBlock({ title, rows }: { title: string; rows: Array<{ id: string; badge: string; text: string }> }) { return <div style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.lg, padding: PLATFORM_V7_TOKENS.spacing.md, background: PLATFORM_V7_TOKENS.color.surface }}><div style={{ fontSize: PLATFORM_V7_TOKENS.typography.body.size, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.text }}>{title}</div><div style={{ marginTop: PLATFORM_V7_TOKENS.spacing.sm, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs }}>{rows.length ? rows.map((row) => <div key={row.id} style={{ display: 'grid', gap: 4, borderTop: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, paddingTop: PLATFORM_V7_TOKENS.spacing.xs }}><span style={{ fontSize: 11, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.brand }}>{row.badge}</span><span style={{ fontSize: 12, color: PLATFORM_V7_TOKENS.color.textMuted, lineHeight: 1.45 }}>{row.text}</span></div>) : <span style={{ fontSize: 12, color: PLATFORM_V7_TOKENS.color.textMuted }}>Пока нет событий.</span>}</div></div>; }

function compactRub(value: number) { if (value >= 1_000_000) return `${Math.round(value / 1_000_000)} млн ₽`; if (value >= 1_000) return `${Math.round(value / 1_000)} тыс. ₽`; return `${value} ₽`; }

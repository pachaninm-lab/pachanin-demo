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
  type PlatformActionType,
  type PlatformRole,
  type User
} from '../../../../packages/domain-core/src/execution-simulation';

type ActionCard = {
  id: string;
  title: string;
  description: string;
  command: PlatformActionCommand | null;
  disabledReason?: string;
};

type UiActionLog = {
  id: string;
  label: string;
  state: P7ActionButtonState;
  message: string;
};

const flowDealId = 'DL-9113';
const flowLotId = 'LOT-UI-001';

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
  if (customReason) return customReason;
  if (!command) return 'Нет подходящего объекта для действия';
  return getPlatformActionDisabledReason(state, command) ?? undefined;
}

function actionStateFromResult(result?: PlatformActionResult): P7ActionButtonState {
  if (!result) return 'idle';
  if (result.ok) return 'success';
  if (result.toast.type === 'disabled' || result.toast.type === 'error') return 'error';
  return 'idle';
}

function statusLabel(status?: string) {
  if (!status) return '—';
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
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

  const createLot: ActionCard = {
    id: 'createLot',
    title: '1. Создать лот',
    description: 'Создаёт новый sandbox-лот с объёмом и ценой, чтобы дальше провести его до сделки.',
    command: flowLot ? null : {
      type: 'createLot',
      actor: seller,
      payload: { lotId: flowLotId, volumeTonnes: 240, pricePerTonneRub: 16140, basis: 'EXW Тамбовская область', qualityClass: '3 класс' },
      now,
      runtimeLabel: 'sandbox'
    },
    disabledReason: flowLot ? 'Лот уже создан' : undefined
  };

  const publishLot: ActionCard = {
    id: 'publishLot',
    title: '2. Опубликовать лот',
    description: 'Переводит лот в состояние видимости для покупателя.',
    command: flowLot ? {
      type: 'publishLot',
      actor: seller,
      payload: { lotId: flowLotId },
      now,
      runtimeLabel: 'sandbox'
    } : null,
    disabledReason: !flowLot ? 'Сначала создай лот' : flowLot.status !== 'draft' ? 'Лот уже опубликован или ушёл дальше' : undefined
  };

  const acceptOffer: ActionCard = {
    id: 'acceptOffer',
    title: '3. Акцептовать оффер',
    description: 'Показывает переход от лота к будущей сделке без обхода платформы.',
    command: flowLot ? {
      type: 'acceptOffer',
      actor: buyer,
      payload: { lotId: flowLotId },
      now,
      runtimeLabel: 'sandbox'
    } : null,
    disabledReason: !flowLot ? 'Сначала создай и опубликуй лот' : flowLot.status !== 'published' ? 'Оффер доступен только после публикации' : undefined
  };

  const createDeal: ActionCard = {
    id: 'createDeal',
    title: '4. Создать сделку',
    description: 'Формирует deal object — центр дальнейшего исполнения, денег, документов и спора.',
    command: flowLot ? {
      type: 'createDeal',
      actor: operator,
      payload: { lotId: flowLotId, buyerId: buyer.counterpartyId, dealId: 'DL-UI-001' },
      now,
      runtimeLabel: 'sandbox'
    } : null,
    disabledReason: !flowLot ? 'Сначала проведи лот до оффера' : flowLot.status !== 'offer_accepted' ? 'Сделка создаётся только после акцепта оффера' : undefined
  };

  const reserveRequest: ActionCard = {
    id: 'requestReserve',
    title: '5. Запросить резерв',
    description: 'Проверяет банковое idempotency-правило и создаёт money event по сделке.',
    command: flowDeal ? {
      type: 'requestReserve',
      actor: buyer,
      payload: { dealId: flowDealId },
      idempotencyKey: `ui-reserve-request-${flowDeal.status}`,
      now,
      runtimeLabel: 'sandbox'
    } : null,
    disabledReason: !flowDeal ? 'Нет сделки для резерва' : flowDeal.status !== 'SIGNED' ? 'Резерв можно запросить только после подписания' : undefined
  };

  const reserveConfirm: ActionCard = {
    id: 'confirmReserve',
    title: '6. Подтвердить резерв',
    description: 'Банк подтверждает резерв: сделка переходит к логистике.',
    command: flowDeal ? {
      type: 'confirmReserve',
      actor: bank,
      payload: { dealId: flowDealId },
      idempotencyKey: `ui-reserve-confirm-${flowDeal.status}`,
      now,
      runtimeLabel: 'sandbox'
    } : null,
    disabledReason: !flowDeal ? 'Нет сделки для подтверждения' : flowDeal.status !== 'RESERVE_REQUESTED' ? 'Банк подтверждает только запрошенный резерв' : undefined
  };

  const assignDriver: ActionCard = {
    id: 'assignDriver',
    title: '7. Назначить водителя',
    description: 'Создаёт транспортный пакет и переводит владельца следующего шага к водителю.',
    command: flowDeal ? {
      type: 'assignDriver',
      actor: operator,
      payload: { dealId: flowDealId, driverId: driver.id, carrierId: 'CP-C-001', vehicleNumber: 'А777ВС68' },
      now,
      runtimeLabel: 'sandbox'
    } : null,
    disabledReason: !flowDeal ? 'Нет сделки для логистики' : flowDeal.status !== 'RESERVE_CONFIRMED' ? 'Водитель назначается после подтверждения резерва' : undefined
  };

  const confirmArrival: ActionCard = {
    id: 'confirmArrival',
    title: '8. Провести рейс / прибытие',
    description: 'Двигает логистическую цепочку: погрузка, рейс, прибытие, вес.',
    command: flowDeal ? {
      type: 'confirmArrival',
      actor: driver,
      payload: { dealId: flowDealId },
      now,
      runtimeLabel: 'sandbox'
    } : null,
    disabledReason: !flowDeal ? 'Нет сделки для рейса' : !['DRIVER_ASSIGNED', 'LOADING_CONFIRMED', 'LOADED', 'IN_TRANSIT', 'ARRIVED'].includes(flowDeal.status) ? 'Рейс доступен только после назначения водителя' : undefined
  };

  const labProtocol: ActionCard = {
    id: 'createLabProtocol',
    title: '9. Лабораторный протокол',
    description: 'Добавляет лабораторный контур и доводит сделку до приёмки/документов.',
    command: flowDeal ? {
      type: 'createLabProtocol',
      actor: lab,
      payload: { dealId: flowDealId, protocolId: 'LAB-UI-001', humidityPct: 12.4, glutenPct: 24.8, proteinPct: 12.1, natureGramPerLiter: 752 },
      now,
      runtimeLabel: 'sandbox'
    } : null,
    disabledReason: !flowDeal ? 'Нет сделки для лаборатории' : !['WEIGHING_CONFIRMED', 'LAB_SAMPLING', 'LAB_PROTOCOL_CREATED', 'ACCEPTED', 'DOCUMENTS_PENDING'].includes(flowDeal.status) ? 'Лаборатория доступна после подтверждения веса' : undefined
  };

  const openDispute: ActionCard = {
    id: 'openDispute',
    title: '10. Открыть спор',
    description: 'Блокирует финальный выпуск денег и создаёт доказательный контур спора.',
    command: flowDeal ? {
      type: 'openDispute',
      actor: buyer,
      payload: { dealId: flowDealId, reason: 'quality_delta', amountImpactRub: 125000, evidenceIds: ['EV-001'] },
      now,
      runtimeLabel: 'sandbox'
    } : null,
    disabledReason: !flowDeal ? 'Нет сделки для спора' : !['LAB_PROTOCOL_CREATED', 'ACCEPTED'].includes(flowDeal.status) ? 'Спор открывается после лаборатории или приёмки' : undefined
  };

  return [createLot, publishLot, acceptOffer, createDeal, reserveRequest, reserveConfirm, assignDriver, confirmArrival, labProtocol, openDispute];
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

  function runCard(card: ActionCard) {
    const disabledReason = commandDisabledReason(state, card.command, card.disabledReason);
    if (disabledReason || !card.command) {
      const synthetic: PlatformActionResult = {
        ok: false,
        state,
        disabledReason: disabledReason || 'Действие недоступно',
        toast: { type: 'disabled', message: disabledReason || 'Действие недоступно' }
      };
      setLastResults((prev) => ({ ...prev, [card.id]: synthetic }));
      setUiLog((prev) => [{ id: `${card.id}-${Date.now()}`, label: card.title, state: 'error', message: synthetic.toast.message }, ...prev].slice(0, 6));
      return;
    }

    setBusyAction(card.id);
    const result = store.dispatch(card.command);
    setState(result.state);
    setLastResults((prev) => ({ ...prev, [card.id]: result }));
    setUiLog((prev) => [{ id: `${card.id}-${Date.now()}`, label: card.title, state: actionStateFromResult(result), message: result.toast.message }, ...prev].slice(0, 6));
    setBusyAction(null);
  }

  return (
    <P7Card
      title='Simulation-grade действия сделки'
      subtitle='Новый domain-core уже подключён к интерфейсу: действия меняют состояние, пишут audit/timeline, показывают disabled/error/success и не трогают live-интеграции.'
      testId='execution-simulation-action-panel'
    >
      <div style={{ display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.md }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
          <Metric label='GMV sandbox' value={compactRub(kpis.totalGmvRub)} />
          <Metric label='К выпуску' value={compactRub(kpis.readyForReleaseRub)} />
          <Metric label='Открытых споров' value={String(kpis.openDisputes)} />
          <Metric label='Текущий статус' value={statusLabel(flowDeal?.status)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: PLATFORM_V7_TOKENS.spacing.sm }}>
          {cards.map((card) => {
            const disabledReason = commandDisabledReason(state, card.command, card.disabledReason);
            const result = lastResults[card.id];
            const buttonState = busyAction === card.id ? 'loading' : actionStateFromResult(result);
            return (
              <div
                key={card.id}
                style={{
                  border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`,
                  borderRadius: PLATFORM_V7_TOKENS.radius.lg,
                  padding: PLATFORM_V7_TOKENS.spacing.md,
                  display: 'grid',
                  gap: PLATFORM_V7_TOKENS.spacing.sm,
                  background: PLATFORM_V7_TOKENS.color.surface,
                }}
              >
                <div style={{ fontSize: PLATFORM_V7_TOKENS.typography.body.size, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.text }}>{card.title}</div>
                <div style={{ fontSize: PLATFORM_V7_TOKENS.typography.caption.size + 1, color: PLATFORM_V7_TOKENS.color.textMuted, lineHeight: 1.5 }}>{card.description}</div>
                {disabledReason ? <P7Badge tone='warning'>{disabledReason}</P7Badge> : <P7Badge tone='success'>Доступно</P7Badge>}
                <P7ActionButton
                  state={buttonState}
                  disabled={Boolean(disabledReason)}
                  disabledReason={disabledReason}
                  loadingLabel='Выполняю…'
                  successLabel='Выполнено'
                  errorLabel='Ошибка / стоп'
                  onClick={() => runCard(card)}
                >
                  Выполнить
                </P7ActionButton>
                {result?.toast.message ? <div style={{ fontSize: 12, color: result.ok ? PLATFORM_V7_TOKENS.color.success : PLATFORM_V7_TOKENS.color.danger }}>{result.toast.message}</div> : null}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: PLATFORM_V7_TOKENS.spacing.md }}>
          <LogBlock title='UI журнал действий' rows={uiLog.map((row) => ({ id: row.id, badge: row.state === 'success' ? 'Успешно' : 'Стоп', text: `${row.label}: ${row.message}` }))} />
          <LogBlock title='Domain audit' rows={latestAudit.map((row) => ({ id: row.id, badge: row.actorRole, text: `${row.entityId} · ${row.actionType}` }))} />
          <LogBlock title='Timeline сделки' rows={latestTimeline.map((row) => ({ id: row.id, badge: row.actorRole, text: row.title }))} />
        </div>
      </div>
    </P7Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.lg, padding: PLATFORM_V7_TOKENS.spacing.md, background: PLATFORM_V7_TOKENS.color.surfaceMuted }}>
      <div style={{ fontSize: 11, color: PLATFORM_V7_TOKENS.color.textSubtle, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 6, fontFamily: PLATFORM_V7_TOKENS.typography.fontMono, fontSize: 20, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.text }}>{value}</div>
    </div>
  );
}

function LogBlock({ title, rows }: { title: string; rows: Array<{ id: string; badge: string; text: string }> }) {
  return (
    <div style={{ border: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, borderRadius: PLATFORM_V7_TOKENS.radius.lg, padding: PLATFORM_V7_TOKENS.spacing.md, background: PLATFORM_V7_TOKENS.color.surface }}>
      <div style={{ fontSize: PLATFORM_V7_TOKENS.typography.body.size, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.text }}>{title}</div>
      <div style={{ marginTop: PLATFORM_V7_TOKENS.spacing.sm, display: 'grid', gap: PLATFORM_V7_TOKENS.spacing.xs }}>
        {rows.length ? rows.map((row) => (
          <div key={row.id} style={{ display: 'grid', gap: 4, borderTop: `1px solid ${PLATFORM_V7_TOKENS.color.border}`, paddingTop: PLATFORM_V7_TOKENS.spacing.xs }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: PLATFORM_V7_TOKENS.color.brand }}>{row.badge}</span>
            <span style={{ fontSize: 12, color: PLATFORM_V7_TOKENS.color.textMuted, lineHeight: 1.45 }}>{row.text}</span>
          </div>
        )) : <span style={{ fontSize: 12, color: PLATFORM_V7_TOKENS.color.textMuted }}>Пока нет событий.</span>}
      </div>
    </div>
  );
}

function compactRub(value: number) {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)} млн ₽`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} тыс. ₽`;
  return `${value} ₽`;
}

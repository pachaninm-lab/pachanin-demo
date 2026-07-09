import type { DomainDeal, DomainDispute, DomainDealStatus } from '@/lib/domain/types';
import type { Deal360State } from './deal360-source-of-truth';

export type P7WorkspaceRuntimeState = 'done' | 'current' | 'wait' | 'blocked';
export type P7WorkspaceRuntimePillarId = 'deal' | 'money' | 'documents' | 'logistics' | 'quality' | 'dispute' | 'audit';
export type P7WorkspaceRuntimeStepId = 'price' | 'reserve' | 'logistics' | 'acceptance' | 'lab' | 'documents' | 'bank_basis' | 'close';

export interface P7WorkspaceRuntimePillar {
  readonly id: P7WorkspaceRuntimePillarId;
  readonly title: string;
  readonly value: string;
  readonly hint: string;
  readonly state: P7WorkspaceRuntimeState;
}

export interface P7WorkspaceRuntimeStep {
  readonly id: P7WorkspaceRuntimeStepId;
  readonly title: string;
  readonly oneLine: string;
  readonly state: P7WorkspaceRuntimeState;
  readonly actor: string;
}

export interface P7WorkspaceRuntimeActionBoundary {
  readonly label: string;
  readonly primaryAction: string;
  readonly safeReason: string;
  readonly blocked: boolean;
  readonly blockedReason: string | null;
}

export interface P7WorkspaceRuntimeBinding {
  readonly dealId: string;
  readonly statusLabel: string;
  readonly maturity: 'manual-runtime' | 'platform-temporarily-without-external-integrations';
  readonly plainLanguageSummary: string;
  readonly nextStepTitle: string;
  readonly nextStepInstruction: string;
  readonly nextOwner: string;
  readonly blocked: boolean;
  readonly blockedReason: string | null;
  readonly bankBasisAmount: number;
  readonly pillars: readonly P7WorkspaceRuntimePillar[];
  readonly journey: readonly P7WorkspaceRuntimeStep[];
  readonly actionBoundary: P7WorkspaceRuntimeActionBoundary;
  readonly auditTrailNote: string;
}

const STATUS_LABELS: Record<DomainDealStatus, string> = {
  draft: 'Черновик сделки',
  contract_signed: 'Договор подписан',
  payment_reserved: 'Деньги зарезервированы',
  loading_scheduled: 'Погрузка назначена',
  loading_started: 'Погрузка идёт',
  loading_done: 'Погрузка завершена',
  in_transit: 'Груз в пути',
  arrived: 'Машина прибыла',
  unloading_started: 'Разгрузка идёт',
  unloading_done: 'Разгрузка завершена',
  quality_check: 'Качество проверяется',
  quality_approved: 'Качество подтверждено',
  quality_disputed: 'Есть спор по качеству',
  docs_complete: 'Документы собраны',
  release_requested: 'Банковское основание запрошено',
  release_approved: 'Банковское основание подтверждено',
  closed: 'Сделка закрыта',
};

const ORDER: DomainDealStatus[] = [
  'draft',
  'contract_signed',
  'payment_reserved',
  'loading_scheduled',
  'loading_started',
  'loading_done',
  'in_transit',
  'arrived',
  'unloading_started',
  'unloading_done',
  'quality_check',
  'quality_approved',
  'docs_complete',
  'release_requested',
  'release_approved',
  'closed',
];

const LOGISTICS_READY = new Set<DomainDealStatus>(['arrived', 'unloading_started', 'unloading_done', 'quality_check', 'quality_approved', 'quality_disputed', 'docs_complete', 'release_requested', 'release_approved', 'closed']);
const ACCEPTANCE_READY = new Set<DomainDealStatus>(['unloading_done', 'quality_check', 'quality_approved', 'quality_disputed', 'docs_complete', 'release_requested', 'release_approved', 'closed']);
const QUALITY_READY = new Set<DomainDealStatus>(['quality_approved', 'docs_complete', 'release_requested', 'release_approved', 'closed']);
const DOCS_READY = new Set<DomainDealStatus>(['docs_complete', 'release_requested', 'release_approved', 'closed']);
const BANK_BASIS_READY = new Set<DomainDealStatus>(['release_requested', 'release_approved', 'closed']);
const CLOSED = new Set<DomainDealStatus>(['closed']);

function rub(value: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

function indexOfStatus(status: DomainDealStatus): number {
  return Math.max(ORDER.indexOf(status), 0);
}

function stateByReady(ready: boolean, current: boolean, blocked: boolean): P7WorkspaceRuntimeState {
  if (blocked) return 'blocked';
  if (ready) return 'done';
  if (current) return 'current';
  return 'wait';
}

function blockerText(deal: DomainDeal, disputes: readonly DomainDispute[]): string | null {
  if (disputes.some((dispute) => dispute.status === 'open')) return 'Есть открытый спор. Сначала нужно решение по спору и доказательства.';
  if (deal.holdAmount > 0) return `Есть удержание ${rub(deal.holdAmount)}. Деньги нельзя считать свободными.`;
  if (deal.blockers.length > 0) return `Есть блокеры: ${deal.blockers.join(' · ')}.`;
  return null;
}

function nextStep(deal: DomainDeal, blockedReason: string | null): Pick<P7WorkspaceRuntimeBinding, 'nextStepTitle' | 'nextStepInstruction' | 'nextOwner'> {
  if (blockedReason) {
    return {
      nextStepTitle: 'Сначала убрать красный блокер',
      nextStepInstruction: blockedReason,
      nextOwner: 'Оператор сделки',
    };
  }

  if (deal.status === 'draft') return { nextStepTitle: 'Подтвердить условия', nextStepInstruction: 'Проверь цену, объём, продавца и покупателя. После этого можно создавать исполнимую сделку.', nextOwner: 'Продавец и покупатель' };
  if (deal.status === 'contract_signed') return { nextStepTitle: 'Подтвердить резерв денег', nextStepInstruction: 'Пока нет резерва, сделку нельзя вести к отгрузке и банковскому основанию.', nextOwner: 'Банк / оператор' };
  if (deal.status === 'payment_reserved') return { nextStepTitle: 'Назначить рейс', nextStepInstruction: 'Нужны машина, водитель, маршрут и контроль документов перевозки.', nextOwner: 'Логистика' };
  if (!LOGISTICS_READY.has(deal.status)) return { nextStepTitle: 'Довести груз до приёмки', nextStepInstruction: 'Следи за рейсом: погрузка, путь, прибытие и разгрузка должны быть подтверждены событиями.', nextOwner: 'Логистика / водитель' };
  if (!QUALITY_READY.has(deal.status)) return { nextStepTitle: 'Подтвердить качество', nextStepInstruction: 'Нужен лабораторный результат или решение по расхождению качества.', nextOwner: 'Лаборатория / элеватор' };
  if (!DOCS_READY.has(deal.status)) return { nextStepTitle: 'Собрать документы', nextStepInstruction: 'Договор, СДИЗ, приёмка, лаборатория и транспортные документы должны быть в контуре сделки.', nextOwner: 'Оператор документов' };
  if (!BANK_BASIS_READY.has(deal.status)) return { nextStepTitle: 'Передать основание в банк', nextStepInstruction: 'Платформа готовит основание. Движение денег остаётся внешним банковским событием.', nextOwner: 'Оператор / банк' };
  if (!CLOSED.has(deal.status)) return { nextStepTitle: 'Закрыть сделку', nextStepInstruction: 'Проверь документы, деньги, спор и audit trail. После этого сделку можно закрывать.', nextOwner: 'Оператор сделки' };
  return { nextStepTitle: 'Сделка закрыта', nextStepInstruction: 'Контур исполнения завершён. Дальше доступен аудит, доказательства и аналитика.', nextOwner: 'Система / аудит' };
}

function stepState(deal: DomainDeal, stepIndex: number, blocked: boolean): P7WorkspaceRuntimeState {
  const currentIndex = indexOfStatus(deal.status);
  if (blocked && stepIndex >= currentIndex) return 'blocked';
  if (currentIndex > stepIndex) return 'done';
  if (currentIndex === stepIndex) return 'current';
  return 'wait';
}

function toDeal360State(state: P7WorkspaceRuntimeState): Deal360State {
  if (state === 'done') return 'ok';
  if (state === 'blocked') return 'stop';
  if (state === 'current') return 'wait';
  return 'muted';
}

export function platformV7WorkspaceRuntimeStateToDeal360State(state: P7WorkspaceRuntimeState): Deal360State {
  return toDeal360State(state);
}

export function buildP7DealWorkspaceRuntimeBinding(input: {
  readonly deal: DomainDeal;
  readonly disputes: readonly DomainDispute[];
  readonly scenarioReleaseAllowed: boolean;
}): P7WorkspaceRuntimeBinding {
  const { deal, disputes } = input;
  const bankBasisAmount = Math.max(deal.releaseAmount ?? deal.reservedAmount - deal.holdAmount, 0);
  const blockedReason = blockerText(deal, disputes);
  const blocked = Boolean(blockedReason) || !input.scenarioReleaseAllowed;
  const next = nextStep(deal, blockedReason);
  const docsReady = DOCS_READY.has(deal.status) && !deal.blockers.includes('docs');
  const logisticsReady = LOGISTICS_READY.has(deal.status) && !deal.blockers.includes('transport');
  const qualityReady = QUALITY_READY.has(deal.status) && !deal.blockers.includes('quality');
  const bankBasisReady = BANK_BASIS_READY.has(deal.status) && bankBasisAmount > 0 && !blocked;

  return {
    dealId: deal.id,
    statusLabel: STATUS_LABELS[deal.status],
    maturity: deal.sourceOfTruth === 'MANUAL' ? 'manual-runtime' : 'platform-temporarily-without-external-integrations',
    plainLanguageSummary: 'Это рабочее место сделки: оно показывает, что уже сделано, что мешает двигаться дальше и кто должен нажать следующий безопасный шаг.',
    nextStepTitle: next.nextStepTitle,
    nextStepInstruction: next.nextStepInstruction,
    nextOwner: next.nextOwner,
    blocked,
    blockedReason: blockedReason ?? (!input.scenarioReleaseAllowed ? 'Контур сценария не разрешает банковское основание до закрытия всех условий сделки.' : null),
    bankBasisAmount,
    pillars: [
      { id: 'deal', title: 'Сделка', value: STATUS_LABELS[deal.status], hint: 'Главный объект: всё привязано к этой сделке.', state: 'current' },
      { id: 'money', title: 'Деньги', value: rub(deal.reservedAmount), hint: bankBasisReady ? 'Есть основание для банковского события.' : 'Деньги нельзя двигать без полного основания.', state: bankBasisReady ? 'done' : blocked ? 'blocked' : 'wait' },
      { id: 'documents', title: 'Документы', value: docsReady ? 'Собраны' : 'Нужно проверить', hint: 'Документы должны подтверждать поставку и качество.', state: docsReady ? 'done' : blocked && deal.blockers.includes('docs') ? 'blocked' : 'wait' },
      { id: 'logistics', title: 'Логистика', value: logisticsReady ? 'Рейс закрыт' : 'Рейс в работе', hint: 'Погрузка, путь и приёмка должны быть подтверждены.', state: logisticsReady ? 'done' : blocked && deal.blockers.includes('transport') ? 'blocked' : 'current' },
      { id: 'quality', title: 'Качество', value: qualityReady ? 'Подтверждено' : 'Нужен результат', hint: 'Лаборатория и приёмка снижают риск спора.', state: qualityReady ? 'done' : blocked && deal.blockers.includes('quality') ? 'blocked' : 'wait' },
      { id: 'dispute', title: 'Спор', value: disputes.some((dispute) => dispute.status === 'open') ? 'Открыт' : 'Нет открытого', hint: 'Открытый спор блокирует банковское основание.', state: disputes.some((dispute) => dispute.status === 'open') ? 'blocked' : 'done' },
      { id: 'audit', title: 'Аудит', value: 'События пишутся', hint: 'Каждое критическое действие должно иметь trace и idempotency.', state: 'done' },
    ],
    journey: [
      { id: 'price', title: 'Цена и лот', oneLine: 'Стороны понимают, что продаётся и по какой цене.', state: stepState(deal, 0, false), actor: 'Продавец / покупатель' },
      { id: 'reserve', title: 'Резерв денег', oneLine: 'Банк или оператор подтверждает резерв как основание сделки.', state: stateByReady(deal.reservedAmount > 0, deal.status === 'contract_signed', false), actor: 'Банк / оператор' },
      { id: 'logistics', title: 'Рейс', oneLine: 'Машина, водитель и маршрут связаны со сделкой.', state: logisticsReady ? 'done' : 'current', actor: 'Логистика / водитель' },
      { id: 'acceptance', title: 'Приёмка', oneLine: 'Элеватор подтверждает вес и факт приёмки.', state: ACCEPTANCE_READY.has(deal.status) ? 'done' : 'wait', actor: 'Элеватор' },
      { id: 'lab', title: 'Лаборатория', oneLine: 'Качество подтверждено или вынесено в спор.', state: qualityReady ? 'done' : 'wait', actor: 'Лаборатория' },
      { id: 'documents', title: 'Документы', oneLine: 'Пакет документов закрывает юридическое основание.', state: docsReady ? 'done' : 'wait', actor: 'Оператор документов' },
      { id: 'bank_basis', title: 'Банковское основание', oneLine: 'Платформа готовит основание; банк подтверждает внешнее событие.', state: bankBasisReady ? 'done' : blocked ? 'blocked' : 'wait', actor: 'Банк / оператор' },
      { id: 'close', title: 'Закрытие', oneLine: 'Сделка закрыта, история и доказательства сохранены.', state: deal.status === 'closed' ? 'done' : 'wait', actor: 'Система / аудит' },
    ],
    actionBoundary: {
      label: 'Безопасное действие',
      primaryAction: next.nextStepTitle,
      safeReason: 'Кнопка должна вести через action boundary, RBAC, идемпотентность и audit trail. UI не меняет деньги напрямую.',
      blocked,
      blockedReason: blockedReason ?? null,
    },
    auditTrailNote: 'VP-3 связывает экран сделки с runtime-моделью: UI → action boundary → application service → state machine → audit/event log → обновлённый UI.',
  };
}

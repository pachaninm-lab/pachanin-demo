'use client';

import { PremiumDealShell } from '@/components/platform-v7/premium/ExecutionUi';
import { PLATFORM_V7_EXECUTION_SOURCE, expectedDealAmountRub } from '@/lib/platform-v7/deal-execution-source-of-truth';
import type { DealRole, DealStepStatus, DealTone, DealViewModel } from '@/lib/platform-v7/premium/types';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const { deal, readiness, money, logistics, documents, dispute, audit } = PLATFORM_V7_EXECUTION_SOURCE;
const roles: DealRole[] = ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'arbiter', 'compliance', 'operator', 'executive'];

function normalizeRole(role: PlatformRole): DealRole {
  if (role === 'arbitrator') return 'arbiter';
  return role;
}

function denormalizeRole(role: DealRole): PlatformRole {
  if (role === 'arbiter') return 'arbitrator';
  return role;
}

function statusToStep(status: 'готово' | 'проверить' | 'стоп'): DealStepStatus {
  if (status === 'готово') return 'done';
  if (status === 'стоп') return 'blocked';
  return 'review';
}

function statusToTone(status: 'готово' | 'проверить' | 'стоп'): DealTone {
  if (status === 'готово') return 'success';
  if (status === 'стоп') return 'danger';
  return 'warning';
}

const readinessRows = [
  { id: 'fgis', label: 'ФГИС: сверка партии', gate: readiness.fgis, responsible: 'Продавец', block: 'допуск партии' },
  { id: 'quality', label: 'Качество и лаборатория', gate: readiness.quality, responsible: 'Лаборатория', block: 'приёмку и цену' },
  { id: 'logistics', label: 'Логистика и рейс', gate: readiness.logistics, responsible: 'Логистика', block: 'вывоз и срок' },
  { id: 'documents', label: 'Документы и СДИЗ', gate: readiness.documents, responsible: 'Продавец', block: 'отгрузку и основание выплаты' },
  { id: 'bank', label: 'Резерв и банк', gate: readiness.bank, responsible: 'Покупатель · банк', block: 'проверку выплаты' },
  { id: 'dispute', label: 'Спор и удержание', gate: readiness.dispute, responsible: 'Оператор', block: 'выпуск денег банком' },
  { id: 'antiBypass', label: 'Контакты и обход', gate: readiness.antiBypass, responsible: 'Платформа', block: 'удержание сделки в контуре' },
] as const;

const blockers = readinessRows
  .filter((row) => row.gate.status !== 'готово' && row.gate.blocker)
  .map((row) => ({
    id: row.id,
    title: row.gate.blocker,
    reason: row.gate.note,
    impact: row.block,
    responsible: row.responsible,
    nextAction: row.id === 'fgis' ? 'Запросить сверку ФГИС' : row.id === 'bank' ? 'Передать основание банку' : 'Закрыть условие',
    tone: statusToTone(row.gate.status),
  }));

const firstBlocker = blockers[0];
const disputedRub = dispute.status === 'готово' ? 0 : money.holdRub;
const heldRub = dispute.status === 'готово' ? money.holdRub : 0;
const awaitingDocsRub = Math.max(0, money.reservedRub - money.releaseCandidateRub - heldRub - disputedRub);

const premiumDeal: DealViewModel = {
  id: deal.id,
  title: `${deal.crop} · ${deal.lotId}`,
  stageLabel: deal.status,
  currentState: firstBlocker
    ? `${blockers.length} условий требуют проверки: ${firstBlocker.title}`
    : 'Условия сделки закрыты; можно передать пакет на банковскую проверку.',
  basisLabel: deal.basis,
  money: {
    totalRub: expectedDealAmountRub(),
    reservedRub: money.reservedRub,
    readyToReleaseRub: money.releaseCandidateRub,
    heldRub,
    awaitingDocsRub,
    disputedRub,
    releasedRub: 0,
  },
  blockers,
  nextAction: firstBlocker
    ? {
      label: firstBlocker.nextAction,
      reason: firstBlocker.reason,
      disabledReason: `Сначала: ${firstBlocker.title}`,
      responsible: firstBlocker.responsible,
    }
    : {
      label: 'Передать основание банку',
      reason: 'Условия сделки закрыты. Можно передать пакет на банковскую проверку выплаты.',
      responsible: 'Оператор · банк',
    },
  execution: readinessRows.map((row) => ({
    id: row.id,
    label: row.label,
    status: statusToStep(row.gate.status),
    responsible: row.responsible,
    blocks: row.gate.blocker || undefined,
    moneyImpactRub: row.id === 'bank' || row.id === 'documents' ? money.reservedRub : undefined,
    nextAction: row.id === 'fgis' && row.gate.blocker ? 'Запросить сверку ФГИС' : row.gate.blocker ? 'Закрыть условие' : undefined,
  })),
  documents: [
    {
      id: 'contract',
      title: 'Договор сделки',
      status: documents.contractStatus === 'черновик' ? 'review' : 'ready',
      responsible: 'Продавец · покупатель',
      blocks: 'юридическое основание сделки',
      source: 'ЭДО',
      actionLabel: 'Проверить договор',
      reason: documents.contractStatus,
    },
    {
      id: 'sdiz',
      title: 'СДИЗ',
      status: documents.sdizStatus === 'не оформлен' ? 'blocked' : 'ready',
      responsible: 'Продавец',
      blocks: 'отгрузку и основание выплаты',
      source: 'ФГИС Зерно',
      actionLabel: 'Оформить СДИЗ',
      reason: documents.sdizStatus,
    },
    {
      id: 'transport',
      title: 'Транспортный пакет',
      status: documents.transportPackStatus === 'не готов' ? 'blocked' : 'ready',
      responsible: 'Логистика',
      blocks: 'рейс и приёмку',
      source: 'перевозка',
      actionLabel: 'Собрать документы рейса',
      reason: documents.transportPackStatus,
    },
    {
      id: 'kep',
      title: 'КЭП и подписи',
      status: documents.kepStatus === 'не подписан' ? 'review' : 'ready',
      responsible: 'Продавец',
      blocks: 'подписание пакета',
      source: 'КЭП',
      actionLabel: 'Подписать пакет',
      reason: documents.kepStatus,
    },
  ],
  evidence: [
    { id: 'trip-route', title: 'Маршрут рейса', type: 'гео', source: logistics.vehicleMasked, time: logistics.eta, role: 'Логистика', relatedTrip: logistics.tripId, status: statusToStep(logistics.gateStatus) },
    { id: 'seal-photo', title: 'Фото пломбы', type: 'фото', source: logistics.driverAlias, time: 'при погрузке', role: 'Водитель', relatedTrip: logistics.tripId, status: 'pending' },
    { id: 'acceptance-weight', title: 'Вес при приёмке', type: 'вес', source: 'Элеватор', time: 'при прибытии', role: 'Элеватор', relatedTrip: logistics.tripId, moneyImpactRub: money.reservedRub, status: 'pending' },
  ],
  risks: readinessRows
    .filter((row) => row.gate.status !== 'готово')
    .map((row) => ({ id: row.id, label: row.label, detail: row.gate.note, tone: statusToTone(row.gate.status) })),
  timeline: audit.map((event, index) => ({ id: `${event.time}-${index}`, time: event.time, title: event.action, actor: event.actor, impact: event.note })),
  driverTask: {
    id: 'driver-current-trip',
    tripId: logistics.tripId,
    routeLabel: `${logistics.pickupPoint} → ${logistics.deliveryPoint}`,
    nextAction: 'Подтвердить прибытие',
    secondaryActions: [
      { id: 'photo', label: 'Добавить фото' },
      { id: 'seal', label: 'Пломба' },
      { id: 'weight', label: 'Вес' },
      { id: 'problem', label: 'Проблема' },
    ],
    offlineQueueCount: 0,
    etaLabel: logistics.eta,
  },
};

export function PlatformCommandCenterHub() {
  const { role, setRole } = usePlatformV7RStore();

  return (
    <PremiumDealShell
      deal={premiumDeal}
      initialRole={normalizeRole(role)}
      roles={roles}
      theme="light"
      onRoleChange={(nextRole) => setRole(denormalizeRole(nextRole))}
    />
  );
}

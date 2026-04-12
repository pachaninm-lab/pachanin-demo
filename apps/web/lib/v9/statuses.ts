/**
 * 17-status deal model → 5-phase mapping
 * TODO: согласовать маппинг с Максимом до начала недели 3
 *
 * §6.2 ТЗ v9.1
 */

export type DealStatus =
  | 'draft'
  | 'contract_signed'
  | 'payment_reserved'
  | 'loading_scheduled'
  | 'loading_started'
  | 'loading_done'
  | 'in_transit'
  | 'arrived'
  | 'unloading_started'
  | 'unloading_done'
  | 'quality_check'
  | 'quality_approved'
  | 'quality_disputed'
  | 'docs_complete'
  | 'release_requested'
  | 'release_approved'
  | 'closed';

export type Phase = 'contract' | 'logistics' | 'acceptance' | 'documents' | 'settlement';

export type PhaseInfo = {
  id: Phase;
  label: string;
  steps: DealStatus[];
};

/**
 * Mapping 17 statuses → 5 phases
 * STUB — requires sign-off from Максим before sprint 2
 */
export const phases: PhaseInfo[] = [
  {
    id: 'contract',
    label: 'Контракт',
    steps: ['draft', 'contract_signed', 'payment_reserved'],
  },
  {
    id: 'logistics',
    label: 'Логистика',
    steps: ['loading_scheduled', 'loading_started', 'loading_done', 'in_transit'],
  },
  {
    id: 'acceptance',
    label: 'Приёмка',
    steps: ['arrived', 'unloading_started', 'unloading_done', 'quality_check', 'quality_approved', 'quality_disputed'],
  },
  {
    id: 'documents',
    label: 'Документы',
    steps: ['docs_complete'],
  },
  {
    id: 'settlement',
    label: 'Расчёт',
    steps: ['release_requested', 'release_approved', 'closed'],
  },
];

export const statusLabels: Record<DealStatus, string> = {
  draft: 'Черновик',
  contract_signed: 'Контракт подписан',
  payment_reserved: 'Резерв подтверждён',
  loading_scheduled: 'Погрузка запланирована',
  loading_started: 'Погрузка начата',
  loading_done: 'Погрузка завершена',
  in_transit: 'В пути',
  arrived: 'Прибыл',
  unloading_started: 'Разгрузка начата',
  unloading_done: 'Разгрузка завершена',
  quality_check: 'Проверка качества',
  quality_approved: 'Качество одобрено',
  quality_disputed: 'Спор по качеству',
  docs_complete: 'Документы готовы',
  release_requested: 'Запрос на выпуск',
  release_approved: 'Выпуск одобрен',
  closed: 'Закрыта',
};

export type StepState = 'pending' | 'active' | 'done' | 'blocked';

export function getPhaseForStatus(status: DealStatus): Phase | null {
  for (const phase of phases) {
    if (phase.steps.includes(status)) return phase.id;
  }
  return null;
}

export function getPhaseState(phase: PhaseInfo, currentStatus: DealStatus): StepState {
  const currentIdx = phases.findIndex(p => p.id === phase.id);
  const activePhase = getPhaseForStatus(currentStatus);
  const activeIdx = phases.findIndex(p => p.id === activePhase);

  if (currentStatus === 'quality_disputed' && phase.id === 'acceptance') return 'blocked';
  if (currentIdx < activeIdx) return 'done';
  if (currentIdx === activeIdx) return 'active';
  return 'pending';
}

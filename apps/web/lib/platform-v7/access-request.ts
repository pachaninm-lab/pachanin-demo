// PR-9 Product entry — модель жизненного цикла запроса доступа организации/роли.
// Без внешнего провайдера identity: статусы и следующее действие production-shaped,
// чтобы подключение ЕСИА/СберБизнес ID добавило только источник события, не меняя
// контракт экранов. В пилоте доступ открыт (controlled-pilot) — экран это честно
// показывает, без слов demo/mock/sandbox/test mode.

export type PlatformV7AccessRequestStatus =
  | 'draft'
  | 'submitted'
  | 'pending_approval'
  | 'manual_review'
  | 'approved'
  | 'rejected';

export type PlatformV7AccessRequest = {
  readonly id: string;
  readonly organizationName: string;
  readonly requestedRole: string;
  readonly status: PlatformV7AccessRequestStatus;
  readonly submittedAt?: string;
  readonly reviewerNote?: string;
};

export type PlatformV7AccessTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

const STATUS_LABEL: Record<PlatformV7AccessRequestStatus, string> = {
  draft: 'Черновик заявки',
  submitted: 'Заявка отправлена',
  pending_approval: 'Ожидает подтверждения',
  manual_review: 'Ручная проверка',
  approved: 'Доступ открыт',
  rejected: 'Отклонено',
};

const STATUS_TONE: Record<PlatformV7AccessRequestStatus, PlatformV7AccessTone> = {
  draft: 'neutral',
  submitted: 'info',
  pending_approval: 'warning',
  manual_review: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const STATUS_NEXT_ACTION: Record<PlatformV7AccessRequestStatus, string> = {
  draft: 'Заполнить организацию и роль и отправить заявку.',
  submitted: 'Заявка получена — ждите распределения на проверку.',
  pending_approval: 'Оператор подтверждает организацию и роль.',
  manual_review: 'Комплаенс проверяет полномочия и реквизиты; при вопросах запросит документы.',
  approved: 'Войдите в кабинет своей роли.',
  rejected: 'Исправьте указанные замечания и отправьте заявку повторно.',
};

export function platformV7AccessRequestLabel(status: PlatformV7AccessRequestStatus): string {
  return STATUS_LABEL[status];
}
export function platformV7AccessRequestTone(status: PlatformV7AccessRequestStatus): PlatformV7AccessTone {
  return STATUS_TONE[status];
}
export function platformV7AccessRequestNextAction(status: PlatformV7AccessRequestStatus): string {
  return STATUS_NEXT_ACTION[status];
}
export function platformV7AccessRequestCanEnter(status: PlatformV7AccessRequestStatus): boolean {
  return status === 'approved';
}

export type PlatformV7AccessStatusView = {
  readonly request: PlatformV7AccessRequest;
  readonly label: string;
  readonly tone: PlatformV7AccessTone;
  readonly nextAction: string;
  readonly canEnter: boolean;
  readonly lifecycle: readonly { readonly status: PlatformV7AccessRequestStatus; readonly label: string; readonly reached: boolean }[];
  readonly pilotNote: string;
};

const LIFECYCLE_ORDER: readonly PlatformV7AccessRequestStatus[] = [
  'submitted',
  'pending_approval',
  'manual_review',
  'approved',
];

export function platformV7BuildAccessStatusView(request: PlatformV7AccessRequest): PlatformV7AccessStatusView {
  const reachedIndex = LIFECYCLE_ORDER.indexOf(request.status === 'rejected' ? 'manual_review' : request.status);
  return {
    request,
    label: platformV7AccessRequestLabel(request.status),
    tone: platformV7AccessRequestTone(request.status),
    nextAction: platformV7AccessRequestNextAction(request.status),
    canEnter: platformV7AccessRequestCanEnter(request.status),
    lifecycle: LIFECYCLE_ORDER.map((status, index) => ({
      status,
      label: platformV7AccessRequestLabel(status),
      reached: reachedIndex >= 0 && index <= reachedIndex,
    })),
    pilotNote: 'Контролируемый пилот: вход открыт во все кабинеты. Боевой гейтинг доступа включается после подключения провайдера идентификации (ЕСИА/СберБизнес ID).',
  };
}

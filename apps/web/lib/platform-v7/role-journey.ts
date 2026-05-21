export type PlatformV7JourneyRole = 'seller' | 'buyer' | 'logistics' | 'driver' | 'elevator' | 'lab' | 'surveyor' | 'bank' | 'compliance' | 'arbitrator' | 'operator' | 'executive';

export interface PlatformV7JourneyStep {
  readonly stepId: string;
  readonly title: string;
  readonly blocker?: string;
  readonly primaryAction: string;
  readonly allowedRole: PlatformV7JourneyRole;
  readonly resource: 'batch' | 'lot' | 'rfq' | 'offer' | 'deal' | 'trip' | 'money' | 'document' | 'quality' | 'dispute' | 'aggregate';
  readonly mutatesDeal: boolean;
}

export const PLATFORM_V7_ROLE_JOURNEYS: Record<PlatformV7JourneyRole, readonly PlatformV7JourneyStep[]> = {
  seller: [
    { stepId: 'seller_batch', title: 'Партия', primaryAction: 'Создать или проверить партию', allowedRole: 'seller', resource: 'batch', mutatesDeal: true },
    { stepId: 'seller_lot', title: 'Лот', primaryAction: 'Выставить лот', allowedRole: 'seller', resource: 'lot', mutatesDeal: true },
    { stepId: 'seller_money', title: 'Деньги', blocker: 'Ожидается банковский резерв', primaryAction: 'Проверить статус резерва', allowedRole: 'seller', resource: 'money', mutatesDeal: false },
  ],
  buyer: [
    { stepId: 'buyer_rfq', title: 'RFQ', primaryAction: 'Создать запрос', allowedRole: 'buyer', resource: 'rfq', mutatesDeal: true },
    { stepId: 'buyer_offer', title: 'Оффер', primaryAction: 'Выбрать предложение', allowedRole: 'buyer', resource: 'offer', mutatesDeal: true },
    { stepId: 'buyer_reserve', title: 'Резерв', blocker: 'Резерв требует подтверждения банка', primaryAction: 'Запросить резерв', allowedRole: 'buyer', resource: 'money', mutatesDeal: true },
  ],
  logistics: [
    { stepId: 'logistics_order', title: 'Рейс', primaryAction: 'Назначить перевозку', allowedRole: 'logistics', resource: 'trip', mutatesDeal: true },
    { stepId: 'logistics_eta', title: 'ETA', primaryAction: 'Обновить ETA', allowedRole: 'logistics', resource: 'trip', mutatesDeal: true },
  ],
  driver: [
    { stepId: 'driver_trip', title: 'Мой рейс', primaryAction: 'Подтвердить следующее действие', allowedRole: 'driver', resource: 'trip', mutatesDeal: true },
    { stepId: 'driver_proof', title: 'Фото и пломба', primaryAction: 'Загрузить полевое доказательство', allowedRole: 'driver', resource: 'trip', mutatesDeal: true },
  ],
  elevator: [
    { stepId: 'elevator_weight', title: 'Вес', primaryAction: 'Зафиксировать вес', allowedRole: 'elevator', resource: 'trip', mutatesDeal: true },
    { stepId: 'elevator_acceptance', title: 'Приёмка', primaryAction: 'Подтвердить приёмку', allowedRole: 'elevator', resource: 'document', mutatesDeal: true },
  ],
  lab: [
    { stepId: 'lab_sample', title: 'Проба', primaryAction: 'Принять образец', allowedRole: 'lab', resource: 'quality', mutatesDeal: true },
    { stepId: 'lab_protocol', title: 'Протокол', primaryAction: 'Приложить протокол', allowedRole: 'lab', resource: 'document', mutatesDeal: true },
  ],
  surveyor: [
    { stepId: 'surveyor_inspection', title: 'Осмотр', primaryAction: 'Зафиксировать заключение', allowedRole: 'surveyor', resource: 'document', mutatesDeal: true },
  ],
  bank: [
    { stepId: 'bank_reserve', title: 'Резерв', primaryAction: 'Подтвердить резерв', allowedRole: 'bank', resource: 'money', mutatesDeal: true },
    { stepId: 'bank_release', title: 'Выпуск', blocker: 'Нужно основание и документы', primaryAction: 'Проверить основание', allowedRole: 'bank', resource: 'money', mutatesDeal: true },
  ],
  compliance: [
    { stepId: 'compliance_check', title: 'Риск', primaryAction: 'Проверить стороны', allowedRole: 'compliance', resource: 'deal', mutatesDeal: true },
  ],
  arbitrator: [
    { stepId: 'arbitrator_case', title: 'Спор', primaryAction: 'Вынести решение', allowedRole: 'arbitrator', resource: 'dispute', mutatesDeal: true },
  ],
  operator: [
    { stepId: 'operator_chain', title: 'Цепочка', primaryAction: 'Снять блокер', allowedRole: 'operator', resource: 'deal', mutatesDeal: true },
  ],
  executive: [
    { stepId: 'executive_aggregate', title: 'Агрегаты', primaryAction: 'Смотреть сводку', allowedRole: 'executive', resource: 'aggregate', mutatesDeal: false },
  ],
};

export function platformV7JourneyForRole(role: PlatformV7JourneyRole): readonly PlatformV7JourneyStep[] {
  return PLATFORM_V7_ROLE_JOURNEYS[role];
}

export function platformV7NextJourneyStep(role: PlatformV7JourneyRole, completedStepIds: readonly string[]): PlatformV7JourneyStep | null {
  return PLATFORM_V7_ROLE_JOURNEYS[role].find((step) => !completedStepIds.includes(step.stepId)) ?? null;
}

export function platformV7RoleCanMutateFromJourney(role: PlatformV7JourneyRole): boolean {
  if (role === 'executive') return false;
  return PLATFORM_V7_ROLE_JOURNEYS[role].some((step) => step.mutatesDeal);
}

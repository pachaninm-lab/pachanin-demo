export type EvidenceReadinessState = 'ready' | 'partial' | 'blocked' | 'pending';

export type EvidenceReadinessContext = 'disputes' | 'bank' | 'elevator';

export interface EvidenceReadinessRow {
  readonly item: string;
  readonly pilotState: EvidenceReadinessState;
  readonly responsible: string;
  readonly nextStep: string;
  readonly stopReason?: string;
}

export const EVIDENCE_READINESS_STATE_LABEL: Record<EvidenceReadinessState, string> = {
  ready: 'Готов к проверке',
  partial: 'Частично готов',
  blocked: 'Заблокирован',
  pending: 'Ожидает подтверждения',
};

export const EVIDENCE_READINESS_CONTEXT_LABEL: Record<EvidenceReadinessContext, string> = {
  disputes: 'споры',
  bank: 'банк',
  elevator: 'элеватор',
};

export const EVIDENCE_READINESS_ROWS: Record<EvidenceReadinessContext, readonly EvidenceReadinessRow[]> = {
  disputes: [
    {
      item: 'Весовая ведомость',
      pilotState: 'partial',
      responsible: 'элеватор / оператор',
      nextStep: 'закрыть акт расхождения DSP-9102-WEIGHT',
      stopReason: 'удержание не закрывается — акт расхождения не подписан',
    },
    {
      item: 'Протокол качества',
      pilotState: 'blocked',
      responsible: 'лаборатория',
      nextStep: 'получить пилотный протокол качества по DL-9106',
      stopReason: 'выплата остановлена — протокол качества ещё не получен',
    },
    {
      item: 'Фото приёмки',
      pilotState: 'ready',
      responsible: 'полевой контур',
      nextStep: 'передано в доказательный пакет',
    },
    {
      item: 'Акт расхождения',
      pilotState: 'blocked',
      responsible: 'элеватор',
      nextStep: 'подписать акт расхождения',
      stopReason: 'спор DSP-9102-WEIGHT не закрывается без подписанного акта',
    },
  ],
  bank: [
    {
      item: 'Резерв сделки (эскроу)',
      pilotState: 'ready',
      responsible: 'банк / Сбер · Безопасные сделки',
      nextStep: 'резерв зафиксирован в пилотном контуре — ожидает закрытия условий',
    },
    {
      item: 'СДИЗ',
      pilotState: 'partial',
      responsible: 'продавец / ФГИС «Зерно»',
      nextStep: 'закрыть СДИЗ в ФГИС «Зерно»',
      stopReason: 'банковское событие не инициируется без закрытого СДИЗ',
    },
    {
      item: 'ЭТрН',
      pilotState: 'blocked',
      responsible: 'логистика',
      nextStep: 'закрыть рейс и транспортный пакет',
      stopReason: 'доказательный пакет неполный — транспортный документ не закрыт',
    },
    {
      item: 'Акт приёмки',
      pilotState: 'blocked',
      responsible: 'элеватор',
      nextStep: 'подтвердить вес и приёмку',
      stopReason: 'денежное исполнение не передаётся без акта приёмки',
    },
    {
      item: 'Пилотный протокол качества',
      pilotState: 'blocked',
      responsible: 'лаборатория',
      nextStep: 'загрузить лабораторный протокол качества',
      stopReason: 'спорная сумма по DL-9106 не разрешается без протокола качества',
    },
  ],
  elevator: [
    {
      item: 'Акт приёмки',
      pilotState: 'partial',
      responsible: 'элеватор / покупатель',
      nextStep: 'зафиксировать вес и подписать акт приёмки',
      stopReason: 'акт не подписан — отклонение по весу -1,2 т требует основания',
    },
    {
      item: 'Акт расхождения',
      pilotState: 'blocked',
      responsible: 'элеватор',
      nextStep: 'оформить акт расхождения по отклонению -1,2 т',
      stopReason: 'удержание не разрешается без закрытого акта расхождения',
    },
    {
      item: 'Протокол качества',
      pilotState: 'pending',
      responsible: 'лаборатория',
      nextStep: 'передать пробу и ожидать пилотный протокол качества',
      stopReason: 'сорная примесь 2,4% превышает допуск — требуется протокол лаборатории',
    },
    {
      item: 'Данные рейса (GPS / ЭТрН)',
      pilotState: 'ready',
      responsible: 'логистика',
      nextStep: 'рейс TRIP-SIM-001 зафиксирован в пилотном контуре',
    },
  ],
};

export function canContextProceed(context: EvidenceReadinessContext): boolean {
  return EVIDENCE_READINESS_ROWS[context].every((row) => row.pilotState === 'ready');
}

export function getContextBlockers(context: EvidenceReadinessContext): readonly EvidenceReadinessRow[] {
  return EVIDENCE_READINESS_ROWS[context].filter((row) => row.pilotState !== 'ready');
}

export function getContextBlockerCount(context: EvidenceReadinessContext): number {
  return EVIDENCE_READINESS_ROWS[context].filter((row) => row.pilotState !== 'ready').length;
}

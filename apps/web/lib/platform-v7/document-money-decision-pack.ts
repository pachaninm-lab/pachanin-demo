export type DecisionPackContext =
  | 'dl9106_payout_review'
  | 'dl9102_dispute_hold'
  | 'seller_document_handoff'
  | 'buyer_reserve_request'
  | 'bank_release_review';

export type DecisionPackPilotState = 'blocked' | 'partial' | 'waiting' | 'allowed' | 'manual_review';
export type DecisionPackMoneyImpact = 'blocks_release' | 'affects_hold' | 'informs_reserve' | 'requires_bank_review' | 'none';

export interface DecisionPackRow {
  readonly rowId: string;
  readonly requiredDocumentEvidence: string;
  readonly responsibleRole: string;
  readonly currentPilotState: DecisionPackPilotState;
  readonly currentPilotStateLabel: string;
  readonly moneyImpact: DecisionPackMoneyImpact;
  readonly moneyImpactLabel: string;
  readonly operationalReason: string;
  readonly blocker: string | null;
  readonly safeNextAction: string;
  readonly pilotNote: string;
}

const NOTE = 'контролируемый пилот · ручная проверка · решение требует внешнего подтверждения';

export const DECISION_PACK_DATA: Record<DecisionPackContext, readonly DecisionPackRow[]> = {
  dl9106_payout_review: [
    {
      rowId: 'dl9106-sdiz',
      requiredDocumentEvidence: 'СДИЗ',
      responsibleRole: 'продавец',
      currentPilotState: 'blocked',
      currentPilotStateLabel: 'остановлено · СДИЗ не закрыт',
      moneyImpact: 'blocks_release',
      moneyImpactLabel: 'блокирует банковскую проверку выплаты до закрытия документа',
      operationalReason: 'СДИЗ связывает зерновую партию с документальной цепочкой сделки',
      blocker: 'ЭТрН не подписана получателем',
      safeNextAction: 'получить подпись ЭТрН и передать СДИЗ на ручную проверку',
      pilotNote: NOTE,
    },
    {
      rowId: 'dl9106-quality',
      requiredDocumentEvidence: 'пилотный протокол качества',
      responsibleRole: 'лаборатория',
      currentPilotState: 'waiting',
      currentPilotStateLabel: 'ожидание · протокол не получен',
      moneyImpact: 'blocks_release',
      moneyImpactLabel: 'останавливает проверку выплаты до подтверждения качества',
      operationalReason: 'качество нужно для сопоставления товара с условиями сделки',
      blocker: 'протокол качества ожидается',
      safeNextAction: 'получить протокол и передать его в доказательный пакет',
      pilotNote: NOTE,
    },
  ],
  dl9102_dispute_hold: [
    {
      rowId: 'dl9102-act',
      requiredDocumentEvidence: 'акт расхождения по весу',
      responsibleRole: 'элеватор',
      currentPilotState: 'blocked',
      currentPilotStateLabel: 'остановлено · акт не закрыт',
      moneyImpact: 'affects_hold',
      moneyImpactLabel: 'удержание 624 тыс. ₽ остаётся на ручной проверке',
      operationalReason: 'акт расхождения фиксирует причину и сумму удержания',
      blocker: 'акт не подписан ответственными сторонами',
      safeNextAction: 'подписать акт расхождения и передать спор оператору',
      pilotNote: NOTE,
    },
    {
      rowId: 'dl9102-decision',
      requiredDocumentEvidence: 'решение оператора по спору',
      responsibleRole: 'оператор',
      currentPilotState: 'waiting',
      currentPilotStateLabel: 'ожидание · решение не вынесено',
      moneyImpact: 'affects_hold',
      moneyImpactLabel: 'определяет итоговую сумму удержания',
      operationalReason: 'решение оператора связывает доказательства со следующим банковским шагом',
      blocker: null,
      safeNextAction: 'подготовить решение после полного доказательного пакета',
      pilotNote: NOTE,
    },
  ],
  seller_document_handoff: [
    {
      rowId: 'seller-sdiz',
      requiredDocumentEvidence: 'СДИЗ продавца',
      responsibleRole: 'продавец',
      currentPilotState: 'blocked',
      currentPilotStateLabel: 'остановлено · ждёт ЭТрН',
      moneyImpact: 'informs_reserve',
      moneyImpactLabel: 'не перемещает деньги, но влияет на готовность проверки выплаты',
      operationalReason: 'продавец передаёт документы только после полной транспортной цепочки',
      blocker: 'ЭТрН не закрыта получателем',
      safeNextAction: 'закрыть ЭТрН, затем передать СДИЗ в ручную проверку',
      pilotNote: NOTE,
    },
  ],
  buyer_reserve_request: [
    {
      rowId: 'buyer-reserve',
      requiredDocumentEvidence: 'запрос банковской проверки резерва',
      responsibleRole: 'покупатель',
      currentPilotState: 'allowed',
      currentPilotStateLabel: 'разрешено · можно инициировать запрос',
      moneyImpact: 'informs_reserve',
      moneyImpactLabel: 'создаёт основание для проверки резерва, но не перемещает деньги',
      operationalReason: 'запрос связывает намерение покупателя с условиями сделки',
      blocker: null,
      safeNextAction: 'отправить запрос на ручную банковскую проверку и ожидать событие банка',
      pilotNote: NOTE,
    },
  ],
  bank_release_review: [
    {
      rowId: 'bank-docs',
      requiredDocumentEvidence: 'СДИЗ + ЭТрН',
      responsibleRole: 'продавец / логистика',
      currentPilotState: 'blocked',
      currentPilotStateLabel: 'остановлено · документы не закрыты',
      moneyImpact: 'requires_bank_review',
      moneyImpactLabel: 'банк не должен продолжать проверку выплаты без закрытых документов',
      operationalReason: 'документы подтверждают товар и доставку как основание сделки',
      blocker: 'ЭТрН не подписана, СДИЗ не закрыт',
      safeNextAction: 'ждать закрытия документов и держать выплату на ручной проверке',
      pilotNote: NOTE,
    },
    {
      rowId: 'bank-quality',
      requiredDocumentEvidence: 'акт приёмки + протокол качества',
      responsibleRole: 'элеватор / лаборатория',
      currentPilotState: 'blocked',
      currentPilotStateLabel: 'остановлено · качество не закрыто',
      moneyImpact: 'requires_bank_review',
      moneyImpactLabel: 'банк не может проверить итоговую сумму без качества и приёмки',
      operationalReason: 'качество и приёмка определяют соответствие товара условиям сделки',
      blocker: 'пилотный протокол качества ожидается',
      safeNextAction: 'получить качество и акт приёмки, затем выполнить ручную банковскую проверку',
      pilotNote: NOTE,
    },
  ],
};

export const DECISION_PACK_CONTEXTS: readonly DecisionPackContext[] = [
  'dl9106_payout_review',
  'dl9102_dispute_hold',
  'seller_document_handoff',
  'buyer_reserve_request',
  'bank_release_review',
];

export const DECISION_PACK_CONTEXT_LABEL: Record<DecisionPackContext, string> = {
  dl9106_payout_review: 'DL-9106 · проверка выплаты',
  dl9102_dispute_hold: 'DL-9102 · спор и удержание',
  seller_document_handoff: 'продавец · передача документов',
  buyer_reserve_request: 'покупатель · запрос резерва',
  bank_release_review: 'банк · условия выплаты',
};

export function getDecisionPackRows(context: DecisionPackContext): readonly DecisionPackRow[] {
  return DECISION_PACK_DATA[context];
}

export function getBlockedRows(context: DecisionPackContext): readonly DecisionPackRow[] {
  return DECISION_PACK_DATA[context].filter((row) => row.currentPilotState === 'blocked');
}

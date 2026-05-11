/**
 * Document-money-legal decision pack data — platform-v7.
 *
 * Controlled-pilot / pre-runtime. No backend, DB, or real integration.
 * No legal finality. No bank approval. No live payout.
 * Every entry explains WHY a deal can or cannot proceed with a specific
 * document/evidence/legal/payment condition.
 */

export type DecisionPackContext =
  | 'dl9106_payout_review'
  | 'dl9102_dispute_hold'
  | 'seller_document_handoff'
  | 'buyer_reserve_request'
  | 'bank_release_review';

export type DecisionPackPilotState =
  | 'blocked'
  | 'partial'
  | 'waiting'
  | 'allowed'
  | 'manual_review';

export type DecisionPackMoneyImpact =
  | 'blocks_release'
  | 'affects_hold'
  | 'informs_reserve'
  | 'requires_bank_review'
  | 'none';

export interface DecisionPackRow {
  readonly rowId: string;
  readonly requiredDocumentEvidence: string;
  readonly responsibleRole: string;
  readonly currentPilotState: DecisionPackPilotState;
  readonly currentPilotStateLabel: string;
  readonly moneyImpact: DecisionPackMoneyImpact;
  readonly moneyImpactLabel: string;
  readonly legalOperationalReason: string;
  readonly blocker: string | null;
  readonly safeNextAction: string;
  readonly pilotNote: string;
}

const DL9106_PAYOUT_ROWS: readonly DecisionPackRow[] = [
  {
    rowId: 'dl9106-sdiz',
    requiredDocumentEvidence: 'СДИЗ — сопроводительный документ на зерно',
    responsibleRole: 'продавец',
    currentPilotState: 'blocked',
    currentPilotStateLabel: 'заблокировано · не отправлен',
    moneyImpact: 'blocks_release',
    moneyImpactLabel: 'блокирует проверку выплаты — без СДИЗ банковская проверка не продолжается',
    legalOperationalReason: 'СДИЗ является операционным основанием для подтверждения зерновой сделки в ФГИС «Зерно»; его отсутствие — документальный блокер выплаты',
    blocker: 'ЭТрН не подписан получателем — СДИЗ не может быть отправлен в ФГИС «Зерно»',
    safeNextAction: 'ожидать подписи ЭТрН получателем, затем инициировать отправку СДИЗ — не менять финансовый статус до регистрации в ФГИС',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
  {
    rowId: 'dl9106-etrn',
    requiredDocumentEvidence: 'ЭТрН — электронная транспортная накладная',
    responsibleRole: 'водитель / логистика',
    currentPilotState: 'blocked',
    currentPilotStateLabel: 'заблокировано · не подписан получателем',
    moneyImpact: 'blocks_release',
    moneyImpactLabel: 'блокирует проверку выплаты — ЭТрН подтверждает факт доставки груза',
    legalOperationalReason: 'ЭТрН является операционным документом доставки; без подписи грузополучателя факт физической передачи груза не подтверждён — выплата не обоснована',
    blocker: 'рейс TRIP-SIM-001 не закрыт — водитель не получил подпись получателя',
    safeNextAction: 'закрыть рейс и получить подпись получателя в ФГИС «Зерно», затем синхронизировать ЭТрН со сделкой',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
  {
    rowId: 'dl9106-acceptance-act',
    requiredDocumentEvidence: 'Акт приёмки — фиксирует физический факт приёмки на элеваторе',
    responsibleRole: 'элеватор',
    currentPilotState: 'partial',
    currentPilotStateLabel: 'частично готово · акт расхождения не закрыт',
    moneyImpact: 'affects_hold',
    moneyImpactLabel: 'влияет на удержание — расхождение по весу создаёт основание для удержания части суммы',
    legalOperationalReason: 'акт расхождения по весу (-1,2 т) является операционным основанием для удержания спорной части; без закрытия акта итоговая сумма выплаты не определена',
    blocker: 'акт расхождения DSP-9102-WEIGHT не закрыт — спорная сумма 624 тыс. ₽ остаётся под удержанием',
    safeNextAction: 'закрыть акт расхождения с суммой и основанием; передать в контур оператора для ручного подтверждения',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
  {
    rowId: 'dl9106-quality-protocol',
    requiredDocumentEvidence: 'Протокол качества — результат лабораторного анализа партии',
    responsibleRole: 'лаборатория',
    currentPilotState: 'waiting',
    currentPilotStateLabel: 'ожидание · анализ в процессе',
    moneyImpact: 'blocks_release',
    moneyImpactLabel: 'блокирует выплату при несоответствии — протокол является условием для банковской проверки условий сделки',
    legalOperationalReason: 'протокол качества является операционным основанием для подтверждения соответствия товара условиям договора; его отсутствие делает банковскую проверку выплаты неполной',
    blocker: 'пилотный протокол DSP-9106-QUALITY ожидается — сорная примесь 2,4% выше допуска 2%',
    safeNextAction: 'ожидать протокол качества от лаборатории; при несоответствии — открыть спор по качеству с суммой и основанием',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
];

const DL9102_DISPUTE_ROWS: readonly DecisionPackRow[] = [
  {
    rowId: 'dl9102-deviation-act',
    requiredDocumentEvidence: 'Акт расхождения по весу — DSP-9102-WEIGHT',
    responsibleRole: 'элеватор',
    currentPilotState: 'blocked',
    currentPilotStateLabel: 'заблокировано · акт не закрыт',
    moneyImpact: 'affects_hold',
    moneyImpactLabel: 'держит 624 тыс. ₽ под удержанием — спор не закрывается без акта расхождения',
    legalOperationalReason: 'акт расхождения является операционным доказательством отклонения веса; без него удержание не имеет документального основания и не может быть снято',
    blocker: 'акт расхождения не подписан — данные об отклонении веса не зафиксированы документально',
    safeNextAction: 'составить и подписать акт расхождения с отклонением, суммой и ответственными; передать в контур спора',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
  {
    rowId: 'dl9102-evidence-pack',
    requiredDocumentEvidence: 'Доказательный пакет — весовая ведомость, фото, журнал рейса',
    responsibleRole: 'оператор',
    currentPilotState: 'partial',
    currentPilotStateLabel: 'частично готово · журнал рейса ожидается',
    moneyImpact: 'affects_hold',
    moneyImpactLabel: 'влияет на размер удержания — неполный доказательный пакет затрудняет определение спорной суммы',
    legalOperationalReason: 'доказательный пакет является операционной базой для решения по спору; неполный пакет увеличивает риск ошибочного решения по удержанию',
    blocker: 'журнал рейса TRIP-SIM-001 ожидается от логистики',
    safeNextAction: 'запросить журнал рейса у водителя / логистики; не выносить решение по удержанию до получения полного пакета',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
  {
    rowId: 'dl9102-operator-decision',
    requiredDocumentEvidence: 'Решение оператора по спору — с суммой и основанием',
    responsibleRole: 'оператор',
    currentPilotState: 'waiting',
    currentPilotStateLabel: 'ожидание · решение не вынесено',
    moneyImpact: 'affects_hold',
    moneyImpactLabel: 'определяет итоговую сумму удержания — без решения удержание остаётся активным',
    legalOperationalReason: 'решение оператора является операционным основанием для снятия или подтверждения удержания; без явного решения финансовый статус сделки неопределён',
    blocker: null,
    safeNextAction: 'вынести решение оператора после получения полного доказательного пакета; передать в контур банка для ручного подтверждения изменения удержания',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
];

const SELLER_HANDOFF_ROWS: readonly DecisionPackRow[] = [
  {
    rowId: 'seller-sdiz-handoff',
    requiredDocumentEvidence: 'СДИЗ — должен быть подписан и отправлен в ФГИС «Зерно»',
    responsibleRole: 'продавец',
    currentPilotState: 'blocked',
    currentPilotStateLabel: 'заблокировано · ЭТрН не подписан получателем',
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'информирует о готовности к передаче на проверку выплаты — не перемещает деньги',
    legalOperationalReason: 'СДИЗ не может быть отправлен без подписанного ЭТрН; документальная цепочка должна быть полной до инициирования банковской проверки',
    blocker: 'ЭТрН не подписан получателем — СДИЗ заблокирован',
    safeNextAction: 'ожидать подписи ЭТрН получателем, затем подготовить СДИЗ к отправке через идемпотентный черновик',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
  {
    rowId: 'seller-etrn-handoff',
    requiredDocumentEvidence: 'ЭТрН — подпись получателя фиксирует факт доставки груза',
    responsibleRole: 'продавец / водитель',
    currentPilotState: 'blocked',
    currentPilotStateLabel: 'заблокировано · подпись получателя отсутствует',
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'информирует о факте доставки — без ЭТрН доставка операционно не подтверждена',
    legalOperationalReason: 'подпись получателя на ЭТрН является операционным подтверждением факта физической передачи груза; без неё продавец не может инициировать передачу на банковскую проверку',
    blocker: 'водитель не получил подпись получателя в системе ФГИС «Зерно»',
    safeNextAction: 'передать водителю задачу на получение подписи получателя; контролировать статус через журнал рейса',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
  {
    rowId: 'seller-acceptance-act-handoff',
    requiredDocumentEvidence: 'Акт приёмки — закрывает физический факт приёмки на элеваторе',
    responsibleRole: 'элеватор',
    currentPilotState: 'partial',
    currentPilotStateLabel: 'частично готово · акт расхождения не закрыт',
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'влияет на итоговую сумму к резервированию — отклонение веса меняет расчёт',
    legalOperationalReason: 'акт приёмки с расхождением указывает на то, что итоговая сумма выплаты зависит от закрытия спора; продавец не может запросить полную сумму до закрытия акта',
    blocker: 'акт расхождения по весу не закрыт — итоговая масса приёмки не зафиксирована',
    safeNextAction: 'ожидать закрытия акта расхождения от элеватора; не инициировать финальную передачу на выплату до закрытия',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
];

const BUYER_RESERVE_ROWS: readonly DecisionPackRow[] = [
  {
    rowId: 'buyer-reserve-request',
    requiredDocumentEvidence: 'Запрос банковского подтверждения резерва — инициируется покупателем',
    responsibleRole: 'покупатель',
    currentPilotState: 'allowed',
    currentPilotStateLabel: 'разрешено · запрос можно инициировать',
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'инициирует запрос банку о готовности к резерву — не перемещает деньги',
    legalOperationalReason: 'запрос резерва является первым операционным шагом для фиксации намерения покупателя; без него сделка не переходит к следующему этапу',
    blocker: null,
    safeNextAction: 'инициировать запрос банку через идемпотентный черновик; ждать ответа банка — не менять финансовый статус без подтверждения',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
  {
    rowId: 'buyer-deal-conditions',
    requiredDocumentEvidence: 'Условия сделки — цена, объём, базис, документы согласованы',
    responsibleRole: 'покупатель + продавец',
    currentPilotState: 'allowed',
    currentPilotStateLabel: 'разрешено · условия согласованы',
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'является основанием для запроса резерва — без согласованных условий резерв не имеет basis',
    legalOperationalReason: 'согласованные условия сделки являются операционным основанием для резервирования средств банком; без них банк не может подтвердить резерв',
    blocker: null,
    safeNextAction: 'убедиться, что все условия зафиксированы в пилотном контуре сделки перед отправкой запроса банку',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
  {
    rowId: 'buyer-bank-confirmation',
    requiredDocumentEvidence: 'Банковское подтверждение резерва — ответ банка на запрос покупателя',
    responsibleRole: 'банк',
    currentPilotState: 'waiting',
    currentPilotStateLabel: 'ожидание · ответ банка не получен',
    moneyImpact: 'informs_reserve',
    moneyImpactLabel: 'фиксирует готовность банка к резерву — не является перемещением денег',
    legalOperationalReason: 'банковское подтверждение является операционным условием перехода сделки к логистике; без него статус резерва неопределён',
    blocker: 'ожидание ответа банка — финансовый статус не меняется без явного подтверждения',
    safeNextAction: 'ожидать ответа банка; при отсутствии ответа в SLA — эскалировать в контур оператора',
    pilotNote: 'контролируемый пилот · document/evidence basis · требует ручной проверки',
  },
];

const BANK_RELEASE_ROWS: readonly DecisionPackRow[] = [
  {
    rowId: 'bank-sdiz-etrn',
    requiredDocumentEvidence: 'СДИЗ + ЭТрН — транспортно-зерновые документы',
    responsibleRole: 'продавец',
    currentPilotState: 'blocked',
    currentPilotStateLabel: 'заблокировано · документы не закрыты',
    moneyImpact: 'requires_bank_review',
    moneyImpactLabel: 'банк не может начать проверку условий выплаты без закрытых документов',
    legalOperationalReason: 'СДИЗ и ЭТрН являются операционными условиями для передачи дела на банковскую проверку выплаты; их отсутствие делает инициирование банковского события невозможным',
    blocker: 'ЭТрН не подписан получателем — СДИЗ заблокирован — банковская проверка не может быть начата',
    safeNextAction: 'ждать закрытия СДИЗ и ЭТрН продавцом; не инициировать банковское событие без полного комплекта документов',
    pilotNote: 'контролируемый пилот · external confirmation boundary · требует ручной проверки',
  },
  {
    rowId: 'bank-acceptance-quality',
    requiredDocumentEvidence: 'Акт приёмки + протокол качества — доказательная база приёмки',
    responsibleRole: 'элеватор + лаборатория',
    currentPilotState: 'blocked',
    currentPilotStateLabel: 'заблокировано · протокол качества отсутствует',
    moneyImpact: 'requires_bank_review',
    moneyImpactLabel: 'банк не может подтвердить соответствие товара условиям договора без протокола качества',
    legalOperationalReason: 'протокол качества является операционным условием для проверки банком соответствия товара договорным условиям; без протокола банк не может определить итоговую сумму выплаты',
    blocker: 'протокол качества DSP-9106-QUALITY ожидается от лаборатории',
    safeNextAction: 'ожидать протокол качества; не инициировать банковскую проверку без подтверждённого качества',
    pilotNote: 'контролируемый пилот · external confirmation boundary · требует ручной проверки',
  },
  {
    rowId: 'bank-dispute-decision',
    requiredDocumentEvidence: 'Решение по спору — закрытие или подтверждение удержания',
    responsibleRole: 'оператор',
    currentPilotState: 'waiting',
    currentPilotStateLabel: 'ожидание · решение оператора не вынесено',
    moneyImpact: 'requires_bank_review',
    moneyImpactLabel: 'определяет итоговую сумму к проверке — удержание 624 тыс. ₽ не снято',
    legalOperationalReason: 'спорная сумма должна быть определена до банковской проверки выплаты; без решения оператора банк не может определить размер удержания',
    blocker: 'решение по спору DSP-9102-WEIGHT не вынесено',
    safeNextAction: 'ожидать решения оператора; банк фиксирует текущее состояние как черновик — не инициирует транзакцию до явного решения',
    pilotNote: 'контролируемый пилот · external confirmation boundary · требует ручной проверки',
  },
  {
    rowId: 'bank-review-check',
    requiredDocumentEvidence: 'Предпросмотр условий выплаты — банк фиксирует статус всех условий',
    responsibleRole: 'банк',
    currentPilotState: 'manual_review',
    currentPilotStateLabel: 'ручная проверка · все условия должны быть закрыты',
    moneyImpact: 'requires_bank_review',
    moneyImpactLabel: 'итоговая проверка условий выплаты — не является самой выплатой',
    legalOperationalReason: 'банковская проверка условий является предпоследним операционным шагом; реальная выплата требует отдельного банковского события вне этой платформы',
    blocker: null,
    safeNextAction: 'банк фиксирует предпросмотр всех условий; реальное банковское событие инициируется только после закрытия всех блокеров и ручного подтверждения',
    pilotNote: 'контролируемый пилот · external confirmation boundary · требует ручной проверки · требует банковской/интеграционной проверки перед исполнением',
  },
];

export const DECISION_PACK_DATA: Record<DecisionPackContext, readonly DecisionPackRow[]> = {
  dl9106_payout_review: DL9106_PAYOUT_ROWS,
  dl9102_dispute_hold: DL9102_DISPUTE_ROWS,
  seller_document_handoff: SELLER_HANDOFF_ROWS,
  buyer_reserve_request: BUYER_RESERVE_ROWS,
  bank_release_review: BANK_RELEASE_ROWS,
};

export function getDecisionPackRows(context: DecisionPackContext): readonly DecisionPackRow[] {
  return DECISION_PACK_DATA[context];
}

export function getDecisionPackRowById(
  context: DecisionPackContext,
  rowId: string,
): DecisionPackRow | undefined {
  return DECISION_PACK_DATA[context].find((r) => r.rowId === rowId);
}

export function getBlockedRows(context: DecisionPackContext): readonly DecisionPackRow[] {
  return DECISION_PACK_DATA[context].filter((r) => r.currentPilotState === 'blocked');
}

export const DECISION_PACK_CONTEXTS: readonly DecisionPackContext[] = [
  'dl9106_payout_review',
  'dl9102_dispute_hold',
  'seller_document_handoff',
  'buyer_reserve_request',
  'bank_release_review',
];

export const DECISION_PACK_CONTEXT_LABEL: Record<DecisionPackContext, string> = {
  dl9106_payout_review: 'DL-9106 · предпросмотр выплаты',
  dl9102_dispute_hold: 'DL-9102 · спор / частичное удержание',
  seller_document_handoff: 'продавец · передача документов',
  buyer_reserve_request: 'покупатель · запрос резерва',
  bank_release_review: 'банк · проверка условий выплаты',
};

export const FORBIDDEN_DECISION_WORDING = [
  'production-ready',
  'fully live',
  'fully integrated',
  'live callback',
  'legally approved',
  'legal finality',
  'bank confirmed',
  'money transferred',
  'payout completed',
  'platform releases money by itself',
  'platform guarantees payment',
  'dispute legally resolved',
  'bypass impossible',
  'no risks',
] as const;

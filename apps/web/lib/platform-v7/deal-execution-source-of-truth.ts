export type GateStatus = 'готово' | 'проверить' | 'стоп';

export interface ReadinessGate {
  status: GateStatus;
  blocker: string;
  note: string;
}

export interface ExecutionDeal {
  id: string;
  lotId: string;
  fgisPartyId: string;
  crop: string;
  volumeTons: number;
  priceRubPerTon: number;
  seller: string;
  buyerAlias: string;
  buyerDisclosure: string;
  basis: string;
  status: string;
  maturity: string;
}

export interface ExecutionMoney {
  reservedRub: number;
  holdRub: number;
  releaseCandidateRub: number;
  buyerMoneyStatus: string;
  bankDecision: string;
}

export interface ExecutionLogistics {
  orderId: string;
  carrier: string;
  driverAlias: string;
  vehicleMasked: string;
  pickupPoint: string;
  deliveryPoint: string;
  eta: string;
  currentLeg: string;
  incidentStatus: string;
  gateStatus: GateStatus;
}

export interface ExecutionDocuments {
  contractStatus: string;
  sdizStatus: string;
  transportPackStatus: string;
  edoStatus: string;
  kepStatus: string;
  missingDocuments: string[];
}

export interface ExecutionDispute {
  status: GateStatus;
  holdReason: string;
  evidenceCount: number;
  arbitratorNeeded: boolean;
}

export interface AuditEvent {
  time: string;
  actor: string;
  action: string;
  note: string;
  status: string;
}

export const PLATFORM_V7_EXECUTION_SOURCE: {
  deal: ExecutionDeal;
  readiness: {
    fgis: ReadinessGate;
    quality: ReadinessGate;
    logistics: ReadinessGate;
    documents: ReadinessGate;
    bank: ReadinessGate;
    dispute: ReadinessGate;
    antiBypass: ReadinessGate;
  };
  money: ExecutionMoney;
  logistics: ExecutionLogistics;
  documents: ExecutionDocuments;
  dispute: ExecutionDispute;
  audit: AuditEvent[];
} = {
  deal: {
    id: 'DL-9102',
    lotId: 'Лот ТМБ-2403',
    fgisPartyId: 'ФГИС-68-2403-001',
    crop: 'Пшеница 4 класса',
    volumeTons: 600,
    priceRubPerTon: 16080,
    seller: 'КФХ «Северное поле»',
    buyerAlias: 'Покупатель 1',
    buyerDisclosure: 'раскрыт только внутри черновика сделки',
    basis: 'самовывоз с элеватора',
    status: 'черновик сделки',
    maturity: 'песочница',
  },
  readiness: {
    fgis: { status: 'готово', blocker: '', note: 'Партия ФГИС-68-2403-001 подтверждена, остаток достаточен' },
    quality: { status: 'проверить', blocker: 'лаборатория нужна на приёмке', note: 'Показатели заполнены, лабораторная приёмка ещё не пройдена' },
    logistics: { status: 'проверить', blocker: 'слот вывоза не подтверждён', note: 'Перевозчик назначен, слот погрузки требует подтверждения' },
    documents: { status: 'проверить', blocker: 'СДИЗ не оформлен', note: 'Договор черновик, СДИЗ и транспортный пакет ещё не готовы' },
    bank: { status: 'проверить', blocker: 'резерв денег не подтверждён', note: 'Покупатель готов к резерву, банк ещё не принял решение' },
    dispute: { status: 'готово', blocker: '', note: 'Нет активных удержаний и споров' },
    antiBypass: { status: 'готово', blocker: '', note: 'Контакты сторон не раскрыты вне черновика сделки' },
  },
  money: {
    reservedRub: 9_648_000,
    holdRub: 0,
    releaseCandidateRub: 0,
    buyerMoneyStatus: 'готов к резерву',
    bankDecision: 'проверить',
  },
  logistics: {
    orderId: 'LO-4421',
    carrier: 'ТК «Южные маршруты»',
    driverAlias: 'Водитель А',
    vehicleMasked: 'Р***ТУ',
    pickupPoint: 'Тамбовская область · элеватор',
    deliveryPoint: 'Назначение покупателя',
    eta: '7–14 дней с момента допуска',
    currentLeg: 'ожидает погрузки',
    incidentStatus: 'нет инцидентов',
    gateStatus: 'проверить',
  },
  documents: {
    contractStatus: 'черновик',
    sdizStatus: 'не оформлен',
    transportPackStatus: 'не готов',
    edoStatus: 'не запущен',
    kepStatus: 'не подписан',
    missingDocuments: ['СДИЗ', 'транспортный пакет', 'КЭП продавца'],
  },
  dispute: {
    status: 'готово',
    holdReason: '',
    evidenceCount: 0,
    arbitratorNeeded: false,
  },
  audit: [
    { time: '09:50', actor: 'Платформа', action: 'Создан черновик сделки', note: 'Условия из принятой ставки Покупателя 1', status: 'зафиксировано' },
    { time: '09:52', actor: 'Оператор', action: 'Запущена проверка готовности', note: 'ФГИС, документы, логистика, банк, спор', status: 'зафиксировано' },
    { time: '10:05', actor: 'ФГИС', action: 'Партия подтверждена', note: 'ФГИС-68-2403-001 — остаток достаточен', status: 'готово' },
    { time: '10:12', actor: 'Банк', action: 'Запрос резерва денег', note: 'Покупатель 1 готов к резерву, решение банка ожидается', status: 'проверить' },
    { time: '10:15', actor: 'Логистика', action: 'Перевозчик назначен', note: 'ТК «Южные маршруты», слот погрузки ожидается', status: 'проверить' },
  ],
};

const READINESS_GATE_KEYS = ['fgis', 'quality', 'logistics', 'documents', 'bank', 'dispute', 'antiBypass'] as const;
type ReadinessKey = typeof READINESS_GATE_KEYS[number];

export function formatRub(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

export function formatTons(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} т`;
}

export function executionReadinessScore(): number {
  const gates = READINESS_GATE_KEYS.map((key: ReadinessKey) => PLATFORM_V7_EXECUTION_SOURCE.readiness[key]);
  const ready = gates.filter((g) => g.status === 'готово').length;
  return Math.round((ready / gates.length) * 100);
}

export function executionBlockers(): string[] {
  const gates = READINESS_GATE_KEYS.map((key: ReadinessKey) => PLATFORM_V7_EXECUTION_SOURCE.readiness[key]);
  return gates.filter((g) => g.status !== 'готово' && g.blocker !== '').map((g) => g.blocker);
}

export function canRequestMoneyRelease(): boolean {
  const { readiness, money } = PLATFORM_V7_EXECUTION_SOURCE;
  return (
    readiness.bank.status === 'готово' &&
    readiness.documents.status === 'готово' &&
    readiness.logistics.status === 'готово' &&
    readiness.dispute.status === 'готово' &&
    money.holdRub === 0
  );
}

export function expectedDealAmountRub(): number {
  const { deal } = PLATFORM_V7_EXECUTION_SOURCE;
  return deal.volumeTons * deal.priceRubPerTon;
}

export function executionSummary() {
  const { deal, money } = PLATFORM_V7_EXECUTION_SOURCE;
  return {
    dealId: deal.id,
    lotId: deal.lotId,
    fgisPartyId: deal.fgisPartyId,
    readinessScore: executionReadinessScore(),
    blockers: executionBlockers(),
    blockersCount: executionBlockers().length,
    canRelease: canRequestMoneyRelease(),
    reservedRub: money.reservedRub,
    holdRub: money.holdRub,
    releaseCandidateRub: money.releaseCandidateRub,
    maturity: deal.maturity,
  };
}

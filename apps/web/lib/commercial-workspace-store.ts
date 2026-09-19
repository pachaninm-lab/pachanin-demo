type CompanyProfile = {
  id: string;
  name: string;
  segment: string;
  region: string;
  verification: string;
  financeReadiness: string;
  paymentDiscipline: string;
  value: string;
  focus: string[];
  lastSignal: string;
};

type CompanyLead = {
  id: string;
  companyId?: string;
  companyName: string;
  status: string;
  entryPoint: string;
  owner?: string;
  nextAction?: string;
};

type MarketRow = {
  id: string;
  buyerName: string;
  culture: string;
  region: string;
  basis: string;
  grossPrice: number;
  netbackRubPerTon: number;
  logisticsRubPerTon: number;
  queueRiskRubPerTon: number;
  qualityAdjustmentRubPerTon: number;
  trust: number;
  paymentSpeed: string;
  etaHours: number;
  linkedLotId?: string | null;
  linkedDealId?: string | null;
  financeAvailable?: string;
  buyerId?: string;
  companyId?: string;
  grade?: string;
  distanceKm?: number;
  paymentMode?: string;
  deliveryWindow?: string;
  strengths?: string[];
  watchouts?: string[];
};

type KnowledgeArticle = {
  id: string;
  title: string;
  summary: string;
  role: string;
  calculators: string[];
  linkedModules: Array<{ href: string; label: string }>;
};

const WORKSPACE = {
  companyProfiles: [
    { id: 'co-1', name: 'ООО Агроцентр', segment: 'buyer', region: 'Тамбовская область', verification: 'GREEN', financeReadiness: 'READY', paymentDiscipline: 'stable', value: 'Fast buyer with bank-ready flow', focus: ['пшеница', 'подсолнечник'], lastSignal: 'Готов к RFQ' },
    { id: 'co-2', name: 'КФХ Алексеев', segment: 'farmer', region: 'Тамбовская область', verification: 'VERIFIED', financeReadiness: 'READY', paymentDiscipline: 'good', value: 'Seller with clean evidence trail', focus: ['пшеница', 'ячмень'], lastSignal: 'Нужен buyer shortlist' },
  ] as CompanyProfile[],
  companyLeads: [
    { id: 'lead-1', companyId: 'co-1', companyName: 'ООО Агроцентр', status: 'QUALIFIED', entryPoint: 'RFQ', owner: 'trading', nextAction: 'Open purchase request' },
  ] as CompanyLead[],
  marketRows: [
    { id: 'mr-1', buyerName: 'ООО Агроцентр', buyerId: 'co-1', companyId: 'co-1', culture: 'Пшеница 3 класс', grade: '3 класс', region: 'Тамбовская область', basis: 'EXW', grossPrice: 16500, netbackRubPerTon: 15320, logisticsRubPerTon: 900, queueRiskRubPerTon: 180, qualityAdjustmentRubPerTon: 100, trust: 92, paymentSpeed: 'T+1', paymentMode: 'reserve / release', deliveryWindow: '10–12 апреля', distanceKm: 146, etaHours: 8, linkedDealId: 'DEAL-001', financeAvailable: 'да', strengths: ['быстрые деньги', 'сильный trust'], watchouts: ['очередь в пик отгрузки'] },
    { id: 'mr-2', buyerName: 'Buyer South', buyerId: 'co-3', companyId: 'co-3', culture: 'Подсолнечник', grade: 'масличный', region: 'Воронежская область', basis: 'CPT', grossPrice: 32000, netbackRubPerTon: 30150, logisticsRubPerTon: 1300, queueRiskRubPerTon: 250, qualityAdjustmentRubPerTon: 300, trust: 84, paymentSpeed: 'T+2', paymentMode: 'deferred', deliveryWindow: '15–17 апреля', distanceKm: 284, etaHours: 14, linkedDealId: 'DEAL-002', financeAvailable: 'нет', strengths: ['сильный gross'], watchouts: ['дорогое плечо', 'ниже скорость денег'] },
  ] as MarketRow[],
  marketAlerts: [
    { id: 'ma-1', title: 'Пшеница укрепляется', detail: 'Netback по ЦФО лучше gross-лидера после логистики.', tone: 'green' as const },
    { id: 'ma-2', title: 'Подсолнечник под давлением плеча', detail: 'Высокая логистика режет итоговую цену.', tone: 'amber' as const },
  ],
  knowledgeArticles: [
    { id: 'KB-NETBACK', title: 'Как принимать решение по netback', summary: 'Не смотреть только на gross price, а считать чистую цену после логистики и риска.', role: 'farmer', calculators: ['netback'], linkedModules: [{ href: '/calculator', label: 'Калькулятор' }, { href: '/market-center', label: 'Ценовой центр' }] },
    { id: 'KB-COMPANY-ENTRY', title: 'Как переводить компанию из каталога в сделку', summary: 'RFQ, price request, KYB и dispatch должны стартовать прямо из карточки компании.', role: 'operator', calculators: ['trust'], linkedModules: [{ href: '/companies', label: 'Каталог компаний' }, { href: '/purchase-requests', label: 'RFQ' }] },
  ] as KnowledgeArticle[],
  transportRuns: [
    { id: 'run-1', etaHours: 6 },
    { id: 'run-2', etaHours: 14 },
  ],
  queueSlots: [
    { id: 'slot-1', vehicle: 'А123ВС', slot: '08:00', status: 'ETA_RISK', linkedDealId: 'DEAL-001', etaLabel: 'через 35 мин' },
    { id: 'slot-2', vehicle: 'М456ОР', slot: '09:00', status: 'UNLOADING', linkedDealId: 'DEAL-002', etaLabel: 'на территории' },
  ],
  slotEvents: [
    { id: 'se-1', slotId: 'slot-1', title: 'ETA slipped' },
    { id: 'se-2', slotId: 'slot-2', title: 'Unloading started' },
  ],
  financeApplications: [
    { id: 'fa-1', dealId: 'DEAL-001', companyId: 'co-2', companyName: 'КФХ Алексеев', amount: 2400000, status: 'REVIEW', requestedAt: '2026-04-01', targetDate: '2026-04-08', collateral: 'товар в пути', disbursementMode: 'reserve / release', nextAction: 'Проверить docs и reserve gate', owner: 'finance', blocker: 'reserve ждёт документов', readiness: ['docs', 'queue', 'lab'], timeline: [{ step: 'Request', detail: 'Заявка зарегистрирована', status: 'DONE' }, { step: 'Review', detail: 'Идёт проверка пакета', status: 'ACTIVE' }] },
    { id: 'fa-2', dealId: 'DEAL-002', companyId: 'co-1', companyName: 'ООО Агроцентр', amount: 1800000, status: 'ON_HOLD', requestedAt: '2026-04-02', targetDate: '2026-04-10', collateral: 'договор + поставка', disbursementMode: 'partial + final', nextAction: 'Разрешить dispute hold', owner: 'finance', blocker: 'спор держит final release', readiness: ['docs'], timeline: [{ step: 'Request', detail: 'Заявка создана', status: 'DONE' }, { step: 'Hold', detail: 'Спор держит выплату', status: 'HOLD' }] },
  ],
  paymentWaterfalls: [
    { id: 'wf-1', applicationId: 'fa-1', dealId: 'DEAL-001', steps: [{ step: 'Reserve', amount: 1200000, status: 'DONE' }, { step: 'Partial', amount: 1200000, status: 'ACTIVE' }, { step: 'Final', amount: 0, status: 'PENDING' }] },
    { id: 'wf-2', applicationId: 'fa-2', dealId: 'DEAL-002', steps: [{ step: 'Reserve', amount: 900000, status: 'DONE' }, { step: 'Partial', amount: 900000, status: 'HOLD' }, { step: 'Final', amount: 0, status: 'HOLD' }] },
  ],
  deals: [
    { id: 'DEAL-001', status: 'QUALITY_CHECK', nextAction: 'Close quality rail' },
    { id: 'DEAL-002', status: 'PAYMENT_HOLD', nextAction: 'Resolve dispute' },
  ],
};

export type QueueSlotStatus = 'OPEN' | 'ASSIGNED' | 'CLOSED' | 'ESCALATED';

export type CommercialWorkspaceState = Awaited<ReturnType<typeof readCommercialWorkspace>>;

export async function readCommercialWorkspace() {
  const companies = WORKSPACE.companyProfiles.map((item, index) => ({
    id: item.id,
    name: item.name,
    role: item.segment,
    region: item.region,
    trust: item.verification === 'GREEN' ? 92 : 78,
    kybStatus: item.verification,
    paymentDiscipline: item.paymentDiscipline,
    logisticsReliability: index === 0 ? 'stable' : 'growing',
    disputeScore: index === 0 ? 'low' : 'medium',
    nextAction: index === 0 ? 'Открыть RFQ и buyer flow' : 'Открыть buyer shortlist и dispatch',
    blocker: index === 0 ? 'нужно перевести интерес в RFQ' : 'нет активного buyer route',
    owner: 'operator',
    flags: item.focus,
    activeModules: [
      { href: '/purchase-requests', label: 'RFQ' },
      { href: '/finance', label: 'Финансы' },
      { href: '/dispatch', label: 'Dispatch' },
    ],
  }));

  return {
    ...WORKSPACE,
    companies,
    // Additional workspace properties accessed by various pages
    inventoryBatches: [
      { id: 'BATCH-001', dealId: 'DEAL-001', linkedDealId: 'DEAL-001', culture: 'wheat', volumeTon: 500, tons: 500, status: 'IN_STORAGE', elevatorId: 'elev-1', titleStatus: 'GREEN', receivedAt: '2026-04-02T08:00:00Z', storageSite: 'Элеватор Тамбов-Юг', qualityStatus: 'GREEN', weightStatus: 'CONFIRMED', grade: '3 класс', flags: [], blockers: [], nextRails: [{ href: '/settlement/DEAL-001', label: 'Открыть settlement', meta: 'готов' }] },
      { id: 'BATCH-002', dealId: 'DEAL-002', linkedDealId: 'DEAL-002', culture: 'corn', volumeTon: 750, tons: 750, status: 'PENDING', elevatorId: 'elev-2', titleStatus: 'AMBER', receivedAt: '2026-04-03T10:00:00Z', storageSite: 'Элеватор Краснодар-1', qualityStatus: 'AMBER', weightStatus: 'PENDING', grade: 'Продовольственная', flags: ['quality-pending'], blockers: ['quality pending'], nextRails: [{ href: '/lab/LAB-002', label: 'Открыть лабораторию', meta: 'retest' }] },
    ],
    railwayRoutes: [
      { id: 'RAIL-001', dealId: 'DEAL-001', linkedDealId: 'DEAL-001', wagons: 10, status: 'LOADED', origin: 'Тамбов', destination: 'СПб порт', originStation: 'Тамбов-Товарный', destinationStation: 'СПб-Товарный', etaDate: '2026-04-10', etaDays: 4, operator: 'РЖД', nextAction: 'Отследить прибытие в пункт назначения', watchouts: [], distanceKm: 1250, nextRails: [{ href: '/receiving/DEAL-001', label: 'Приёмка', meta: 'прибытие' }] },
      { id: 'RAIL-002', dealId: 'DEAL-002', linkedDealId: 'DEAL-002', wagons: 15, status: 'PLANNED', origin: 'Краснодар', destination: 'Новороссийск', originStation: 'Краснодар-Сортировочный', destinationStation: 'Новороссийск-Порт', etaDate: '2026-04-12', etaDays: 6, operator: 'РЖД', nextAction: 'Подтвердить подачу вагонов', watchouts: ['Нет подтверждения вагонов'], distanceKm: 380, nextRails: [{ href: '/dispatch/DEAL-002', label: 'Диспетч', meta: 'планирование' }] },
    ],
    suspicions: [
      { id: 'SUSP-001', score: 72, summary: 'Нетипичный объём первой сделки', priority: 'HIGH', origin: 'deal-monitor', owner: 'operator', status: 'OPEN', nextAction: 'Верифицировать компанию', reasons: ['Объём >3σ от среднего', 'Регистрация <30 дней'], linkedRails: ['companies', 'documents', 'payments'], watchouts: ['Не верифицирован KYB'], companyId: null },
    ],
    connectors: [
      { id: 'conn-edo', name: 'ЭДО', status: 'CONNECTED', note: 'Обмен документами активен', latency: '2m', quality: 'stable', category: 'DOCUMENTS', provider: 'СБИС', lastSyncAt: '2026-04-06T11:00:00Z', warningCount: 0, blocker: '', system: 'СБИС ЭДО', callbackHealth: 'GREEN', owner: 'operator', latencyLabel: '~2 мин', nextAction: 'Мониторинг в фоне', backlog: 0, affectedRails: ['documents', 'contracts'] },
      { id: 'conn-bank', name: 'Банк', status: 'SANDBOX', note: 'Банковские коллбэки симулируются', latency: '4m', quality: 'manual fallback', category: 'PAYMENTS', provider: 'СберБизнес', lastSyncAt: '2026-04-06T10:00:00Z', warningCount: 1, blocker: 'callback pending', system: 'СберБизнес API', callbackHealth: 'AMBER', owner: 'accounting', latencyLabel: '~4 мин', nextAction: 'Проверить callback журнал', backlog: 1, affectedRails: ['payments', 'settlement'] },
      { id: 'conn-goslog', name: 'ГосЛог', status: 'PLANNED', note: 'Реестр перевозчиков — live не подключён', latency: 'n/a', quality: 'manual', category: 'LOGISTICS', provider: 'Минтранс', lastSyncAt: '', warningCount: 0, blocker: 'нет договора', system: 'ГосЛог API', callbackHealth: 'RED', owner: 'operator', latencyLabel: 'n/a', nextAction: 'Подписать договор с Минтрансом', backlog: 0, affectedRails: ['logistics', 'dispatch'] },
    ],
    knowledgeEntries: [
      { id: 'KB-NETBACK', title: 'Как принимать решение по gross vs netback', category: 'pricing', tags: ['netback', 'gross', 'logistics'], summary: 'Gross — входной сигнал. Netback — чистые деньги после логистики, очереди и качества. Решай только по netback.', body: 'Gross price — это то, что написано в оффере. Netback — это то, что остаётся после вычета логистики, риска очереди, quality adjustments и схемы оплаты. Только netback — истина.', updatedAt: '2026-04-01T00:00:00Z', author: 'system', owner: 'trading desk', linkedRails: [{ href: '/market-center', label: 'Ценовой центр', meta: 'netback' }, { href: '/calculator', label: 'Калькулятор', meta: 'формула' }], points: ['Всегда считай netback, не gross', 'Вычти логистику и очередь', 'Учти quality adjustment'], nextAction: 'Открыть ценовой центр и проверить netback', primaryHref: '/market-center', blockers: [] },
      { id: 'KB-QUALITY', title: 'Протокол качества: от пробы до истины', category: 'quality', tags: ['lab', 'protein', 'moisture', 'dispute'], summary: 'Каждая проба — потенциальный триггер dispute или корректировки цены. Закрывай lab rail сразу.', body: 'После отбора проб результаты должны быть зафиксированы в лабораторном протоколе. Отклонение по protein ≥ 0.5% или moisture ≥ 1% — автоматический trigger для пересчёта цены.', updatedAt: '2026-04-02T00:00:00Z', author: 'system', owner: 'lab', linkedRails: [{ href: '/lab', label: 'Лаборатория', meta: 'протокол' }, { href: '/disputes', label: 'Споры', meta: 'претензии' }], points: ['Protein ≥ 0.5% → перерасчёт цены', 'Moisture ≥ 1% → dispute trigger', 'Закрой lab rail до settlement'], nextAction: 'Открыть лабораторный rail', primaryHref: '/lab', blockers: [] },
      { id: 'KB-PAYMENT', title: 'Как работает release платежа', category: 'finance', tags: ['payment', 'release', 'hold', 'bank'], summary: 'Платёж не уходит пока не закрыты: lab truth, docs package, no open disputes.', body: 'Release gate — это набор условий, при которых банк разблокирует платёж. По умолчанию: lab COMPLETED + все доки в GREEN + нет open disputes.', updatedAt: '2026-04-03T00:00:00Z', author: 'system', owner: 'accounting', linkedRails: [{ href: '/payments', label: 'Платежи', meta: 'release' }, { href: '/documents', label: 'Документы', meta: 'пакет' }], points: ['Lab COMPLETED перед release', 'Все документы GREEN', 'Нет open disputes'], nextAction: 'Проверить release gate', primaryHref: '/payments', blockers: [] },
    ],
    chatThreads: [
      { id: 'THREAD-001', title: 'Операционный чат DEAL-001', scope: 'deal', linkedId: 'DEAL-001', participants: ['operator@demo.ru', 'buyer@demo.ru'], lastMessage: 'Протокол качества прикреплён', lastMessageAt: '2026-04-05T10:00:00Z', updatedAt: '2026-04-05T10:00:00Z', primaryHref: '/deals/DEAL-001', counterparty: 'buyer@demo.ru', topic: 'Качество и документы', owner: 'operator@demo.ru', nextAction: 'Проверить документы и закрыть quality rail', status: 'ACTIVE', blockers: [], messages: [{ id: 'm1', author: 'operator@demo.ru', text: 'Протокол качества прикреплён', at: '2026-04-05T10:00:00Z' }], linkedRails: [{ href: '/deals/DEAL-001', label: 'Сделка DEAL-001', meta: 'QUALITY_CHECK' }, { href: '/documents', label: 'Документы', meta: '2 шт.' }] },
      { id: 'THREAD-002', title: 'Финансовый чат PAY-002', scope: 'finance', linkedId: 'PAY-002', participants: ['accounting@demo.ru', 'operator@demo.ru'], lastMessage: 'Ожидаем снятия hold', lastMessageAt: '2026-04-04T14:00:00Z', updatedAt: '2026-04-04T14:00:00Z', primaryHref: '/payments/PAY-002', counterparty: 'accounting@demo.ru', topic: 'Hold / release платежа', owner: 'accounting@demo.ru', nextAction: 'Снять hold после разрешения спора', status: 'HOLD', blockers: ['dispute open'], messages: [{ id: 'm2', author: 'accounting@demo.ru', text: 'Ожидаем снятия hold', at: '2026-04-04T14:00:00Z' }], linkedRails: [{ href: '/payments/PAY-002', label: 'Платёж PAY-002', meta: 'HOLD' }, { href: '/disputes/DIS-001', label: 'Спор DIS-001', meta: 'OPEN' }] },
    ],
  };
}

export function buildMarketInsight(rows: MarketRow[]) {
  const sorted = [...rows].sort((a, b) => b.netbackRubPerTon - a.netbackRubPerTon);
  const fastest = [...rows].sort((a, b) => a.etaHours - b.etaHours)[0] || null;
  return {
    best: sorted[0] || null,
    fastest,
  };
}

export function buildSurveyView(_state: any) {
  return {
    required: 1,
    disputeReady: 1,
    tasks: [
      { id: 'sv-task-1', providerName: 'ООО АгроИнспект', surveyType: 'QUALITY', status: 'ASSIGNED', reason: 'Нужен независимый quality trail', required: true, slaHours: 6, owner: 'operator', reportAttached: false, linkedDisputeId: 'DIS-001', disputeReady: true, title: 'Quality survey', linkedObjectId: 'DEAL-001', linkedDealId: 'DEAL-001' },
    ],
  };
}

export function buildInsuranceView(_state: any) {
  return {
    cases: [
      { id: 'ins-1', status: 'INCIDENT_OPEN', linkedDealId: 'DEAL-001', type: 'CARGO', policyNumber: 'POL-001', insurer: 'АгроСтрах', amountRub: 4200000, blocker: '' },
    ],
  };
}

export function buildFinanceView(state: any, applicationId?: string) {
  // When called without applicationId return list view
  if (!applicationId) {
    const applications = state?.financeApplications || [];
    return {
      applications,
      products: applications.map((a: any) => ({ id: a.id, title: a.disbursementMode, type: 'trade finance', targetRole: 'finance / operator', decisionTime: 'T+1', advanceRate: a.disbursementMode, pricing: 'dynamic', trigger: a.dealId })),
      waterfalls: [] as any[],
    };
  }
  const application = (state?.financeApplications || []).find((item: any) => item.id === applicationId) || null;
  if (!application) {
    return { application: null, product: null, plan: null };
  }

  const product = {
    title: application.disbursementMode === 'reserve / release' ? 'Reserve / release finance rail' : 'Partial + final release rail',
    type: 'trade finance',
    targetRole: 'finance / operator',
    decisionTime: application.status === 'REVIEW' ? 'T+1' : 'manual',
    advanceRate: application.disbursementMode,
    pricing: application.status === 'ON_HOLD' ? 'hold pending dispute' : 'dynamic by rail state',
    trigger: application.dealId,
  };

  const plan = {
    items: [
      { title: 'Reserve', amountRub: Math.round(Number(application.amount || 0) * 0.2), status: 'pending' },
      { title: 'Partial', amountRub: Math.round(Number(application.amount || 0) * 0.5), status: application.status === 'ON_HOLD' ? 'hold' : 'pending' },
      { title: 'Final', amountRub: Math.round(Number(application.amount || 0) * 0.3), status: application.status === 'ON_HOLD' ? 'hold' : 'pending' },
    ]
  };

  return { application, product, plan };
}

// Stub views used by multiple pages
export function buildDispatchView(_state?: any) {
  return {
    routes: [
      { id: 'ROUTE-001', driverName: 'Иванов А.П.', truckNumber: 'А123ВС77', status: 'IN_TRANSIT', origin: 'Тамбов', destination: 'Липецк', dealId: 'DEAL-001', originLabel: 'Тамбов (элеватор Юг)', destinationLabel: 'Липецк (элеватор Север)', etaLabel: '2026-04-06 16:00', weightStatus: 'CONFIRMED' },
      { id: 'ROUTE-002', driverName: 'Петров В.С.', truckNumber: 'В456ЕК61', status: 'AT_DESTINATION', origin: 'Краснодар', destination: 'Ростов-на-Дону', dealId: 'DEAL-002', originLabel: 'Краснодар (порт)', destinationLabel: 'Ростов-на-Дону', etaLabel: '2026-04-05 18:00', weightStatus: 'PENDING' },
    ],
    incidents: [] as any[],
  };
}

export function buildMarketRows(_state?: any) {
  return [
    { culture: 'Пшеница 3кл', region: 'ЮФО', price: 14200, trend: 'up', volume: 12000 },
    { culture: 'Ячмень', region: 'ЮФО', price: 12800, trend: 'flat', volume: 7500 },
    { culture: 'Кукуруза', region: 'СКФО', price: 13500, trend: 'up', volume: 4200 },
  ];
}

export function scoreBuyerRows(rows: any[]) {
  return rows.map((r, i) => ({ ...r, score: 80 - i * 8, tier: i === 0 ? 'A' : 'B' }));
}

export function buildQualityView(_state?: any) {
  const samples = [
    { id: 'SAMPLE-001', dealId: 'DEAL-001', status: 'ANALYZED', crop: 'wheat', protein: 13.2, moisture: 12.5, flags: [] },
    { id: 'SAMPLE-002', dealId: 'DEAL-002', status: 'RETEST', crop: 'corn', moisture: 16.1, protein: 10.5, flags: ['retest-required'] },
  ];
  return {
    samples,
    checks: samples, // alias used by lab-mobile
    pendingProtocols: 1,
    retests: 1,
  };
}

export function buildLogisticsView(_state?: any) {
  return buildDispatchView(_state);
}

export async function buildPaymentDetailView(paymentId: string) {
  const payments: Record<string, any> = {
    'PAY-001': { id: 'PAY-001', dealId: 'DEAL-001', status: 'PARTIAL_READY', amount: 4200000, beneficiaryName: 'КФХ Алексеев', releaseGate: 'lab + docs', reason: 'Docs verified' },
    'PAY-002': { id: 'PAY-002', dealId: 'DEAL-002', status: 'HOLD', amount: 3100000, beneficiaryName: 'ООО Агроцентр', releaseGate: 'dispute release', reason: 'Dispute hold' },
  };
  const payment = payments[paymentId] ?? null;
  return {
    payment,
    disputes: payment ? [{ id: 'DIS-001', dealId: payment.dealId, status: 'OPEN', topic: 'Quality mismatch' }] : [],
    documents: payment ? [{ id: 'DOC-001', type: 'contract', status: 'SIGNED', linkedDealId: payment.dealId, version: '1.0', verifiedBy: 'system' }] : [],
    waterfall: payment ? { steps: [{ step: 'reserve', amount: Math.round(payment.amount * 0.05) }, { step: 'partial', amount: Math.round(payment.amount * 0.65) }, { step: 'final', amount: Math.round(payment.amount * 0.30) }] } : null,
  };
}

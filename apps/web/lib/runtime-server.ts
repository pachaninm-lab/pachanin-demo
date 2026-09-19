const SNAPSHOT = {
  meta: {
    source: 'runtime.seed',
    lastSimulatedAt: '2026-04-03T11:45:00Z',
  },
  deals: [
    { id: 'DEAL-001', status: 'QUALITY_CHECK', culture: 'Пшеница', volume: 240, lotId: 'LOT-001', blocker: '', nextAction: 'Закрыть quality rail' },
    { id: 'DEAL-002', status: 'PAYMENT_HOLD', culture: 'Подсолнечник', volume: 150, lotId: 'LOT-002', blocker: 'bank callback pending', nextAction: 'Проверить payment rail' },
  ],
  payments: [
    { id: 'PAY-001', dealId: 'DEAL-001', status: 'PARTIAL_READY', amount: 4200000, reason: 'Docs verified', beneficiaryName: 'КФХ Алексеев', releaseGate: 'lab + docs', initiatedBy: 'operator', approvedBy: 'accounting', timeline: [{ at: '2026-04-04T10:00:00Z', event: 'Создан', actor: 'operator' }, { at: '2026-04-05T09:00:00Z', event: 'Частично подтверждён', actor: 'accounting' }] },
    { id: 'PAY-002', dealId: 'DEAL-002', status: 'HOLD', amount: 3100000, reason: 'Dispute hold', beneficiaryName: 'ООО Агроцентр', releaseGate: 'dispute release', initiatedBy: 'operator', approvedBy: '', timeline: [{ at: '2026-04-03T14:00:00Z', event: 'Создан', actor: 'operator' }, { at: '2026-04-04T11:00:00Z', event: 'Заблокирован спором', actor: 'system' }] },
  ],
  documents: [
    { id: 'DOC-001', dealId: 'DEAL-001', linkedDealId: 'DEAL-001', type: 'Акт приёмки', status: 'GREEN', title: 'Акт приёмки партии', format: 'PDF', sizeKb: 128, issuedAt: '2026-04-04T10:00:00Z', uploadedBy: 'operator', verifiedBy: 'lab-1', linkedTo: 'DEAL-001', blocker: '', hash: 'abc123', version: 'v1' },
    { id: 'DOC-002', dealId: 'DEAL-002', linkedDealId: 'DEAL-002', type: 'Протокол качества', status: 'AMBER', title: 'Протокол качества DEAL-002', format: 'PDF', sizeKb: 96, issuedAt: '2026-04-03T15:00:00Z', uploadedBy: 'lab-1', verifiedBy: '', linkedTo: 'DEAL-002', blocker: 'retest pending', hash: 'def456', version: 'v2' },
  ],
  disputes: [
    { id: 'DIS-001', dealId: 'DEAL-002', topic: 'Quality mismatch', status: 'OPEN' },
  ],
  labSamples: [
    { id: 'LAB-001', dealId: 'DEAL-001', linkedDealId: 'DEAL-001', status: 'COMPLETED', priceImpact: 1200, financialImpactRub: 288000, blockers: [], crop: 'Пшеница', moisture: 11.7, protein: 12.3, flags: [] },
    { id: 'LAB-002', dealId: 'DEAL-002', linkedDealId: 'DEAL-002', status: 'RETEST', priceImpact: -800, financialImpactRub: 120000, blockers: ['retest pending'], crop: 'Подсолнечник', moisture: 9.2, protein: 0, flags: ['retest'] },
  ],
  inventoryLots: [
    { id: 'INV-001', dealId: 'DEAL-001', sourceDealId: 'DEAL-001', batch: 'BATCH-001', titleStatus: 'GREEN' },
    { id: 'INV-002', dealId: 'DEAL-002', sourceDealId: 'DEAL-002', batch: 'BATCH-002', titleStatus: 'AMBER' },
  ],
  connectors: [
    { name: 'ЭДО', status: 'CONNECTED', note: 'Document exchange active', latency: '2m', quality: 'stable' },
    { name: 'Банк', status: 'SANDBOX', note: 'Bank callbacks simulated', latency: '4m', quality: 'manual fallback' },
  ],
  chats: [
    { id: 'CHAT-001', title: 'Deal 001 ops', scope: 'deal', linkedId: 'DEAL-001', participants: ['operator', 'buyer'], messages: [{ who: 'operator', text: 'Quality pack attached' }] },
    { id: 'CHAT-002', title: 'Payment hold', scope: 'finance', linkedId: 'PAY-002', participants: ['finance', 'operator'], messages: [{ who: 'finance', text: 'Waiting callback' }] },
  ],
  playbooks: [
    { id: 'PB-001', trigger: 'Route deviation', owner: 'operator', firstResponse: 'Open logistics rail', secondLine: 'Escalate to dispatch', resolution: 'Route confirmed', freeze: 'Trip payout hold' },
    { id: 'PB-002', trigger: 'Quality mismatch', owner: 'lab', firstResponse: 'Open dispute rail', secondLine: 'Launch re-test', resolution: 'Signed protocol', freeze: 'Settlement hold' },
  ],
  notifications: [
    { id: 'NOT-001', title: 'Market signal', scope: 'MARKET', actionHref: '/market-news', type: 'MARKET_ALERT' },
  ],
  shipments: [
    { id: 'SHIP-001', dealId: 'DEAL-001', driverName: 'Иванов А.П.', truckNumber: 'А123ВС77', status: 'IN_TRANSIT', origin: 'Тамбов', destination: 'Липецк', originLabel: 'Тамбов (элеватор Юг)', destinationLabel: 'Липецк (элеватор Север)', etaLabel: '2026-04-06 16:00', lat: 52.7, lng: 41.4, weightStatus: 'CONFIRMED' },
    { id: 'SHIP-002', dealId: 'DEAL-002', driverName: 'Петров В.С.', truckNumber: 'В456ЕК61', status: 'AT_UNLOADING', origin: 'Краснодар', destination: 'Ростов-на-Дону', originLabel: 'Краснодар (порт)', destinationLabel: 'Ростов-на-Дону', etaLabel: '2026-04-05 18:00', lat: 47.2, lng: 39.7, weightStatus: 'PENDING' },
  ],
  receivingTickets: [
    { id: 'RCV-001', dealId: 'DEAL-001', shipmentId: 'SHIP-001', elevatorId: 'elev-1', status: 'AWAITING', slotAt: '2026-04-06T14:00:00Z', volumeTon: 500 },
  ],
};

export async function getRuntimeSnapshot() {
  return SNAPSHOT;
}

export async function getRuntimeOperatorCockpit() {
  return {
    cockpit: {
      summary: {
        moneyAtRisk: 2,
        moneyAtRiskAmountRub: 3100000,
        closeToFinish: 1,
        blocked: 1,
        bypass: 0,
        escalations: 1,
        openDisputes: 1,
        staleSupport: 0,
      },
      queues: {
        moneyAtRisk: [{ id: 'oq-1', title: 'Payment hold · DEAL-002', reason: 'Dispute hold', owner: 'finance', nextAction: 'Open payment rail', severity: 'red', amountRub: 3100000, href: '/payments/PAY-002', reasonCodes: ['DISPUTE_HOLD'], evidenceScore: 68 }],
        closeToFinish: [{ id: 'oq-2', title: 'Deal 001', reason: 'Only settlement release left', owner: 'operator', nextAction: 'Release after final check', severity: 'amber', amountRub: 4200000, href: '/deals/DEAL-001', reasonCodes: ['READY_TO_CLOSE'], evidenceScore: 91 }],
        blockedByDocsLabReceiving: [{ id: 'oq-3', title: 'Lab retest · DEAL-002', reason: 'Retest pending', owner: 'lab', nextAction: 'Complete lab rail', severity: 'amber', amountRub: 120000, href: '/lab/LAB-002', reasonCodes: ['RETEST'], evidenceScore: 54 }],
        bypassAndFraud: [],
        escalations: [{ id: 'oq-4', title: 'Dispute open · DEAL-002', reason: 'Quality mismatch', owner: 'operator', nextAction: 'Review dispute trail', severity: 'red', amountRub: 3100000, href: '/disputes/DIS-001', reasonCodes: ['QUALITY_MISMATCH'], evidenceScore: 72 }],
      },
    },
    meta: SNAPSHOT.meta,
  };
}

export async function getRuntimeExportPack(kind: string, dealId?: string) {
  return {
    meta: { source: 'runtime.export-pack' },
    pack: {
      kind,
      pilotKpis: {
        dealsClosed: 1,
        blockedDeals: 1,
        moneyAtRiskRub: 3100000,
        metrics: { releaseReadyRate: 87, disputeRate: 8, avgEvidenceScore: 72, avgBlockersPerDeal: 1.2, totalDeals: 3, avgCycleDays: 12 },
        benchmark: { releaseReadyRate: 80, disputeRate: 12, avgEvidenceScore: 65, avgBlockersPerDeal: 2.1, industry: 14, platform: 12 },
      },
      metrics: { moneyAtRisk: 1, moneyAtRiskAmountRub: 3100000 },
      goldenPaths: [
        { id: 'gp-1', name: 'Стандартная поставка', steps: 10, avgDays: 12, successRate: 87 },
        { id: 'gp-2', name: 'Срочная оферта', steps: 7, avgDays: 5, successRate: 91 },
      ],
      documents: [
        { id: 'DOC-001', type: 'contract', status: 'SIGNED' },
        { id: 'DOC-002', type: 'quality_protocol', status: 'GENERATED' },
      ],
    },
  };
}

// Export RuntimeSnapshot type for pages that import it
export type RuntimeSnapshot = Awaited<ReturnType<typeof getRuntimeSnapshot>>;

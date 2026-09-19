export function buildExecutionReadiness({ snapshot, trustGraph, pilotMetrics }: { snapshot?: any; trustGraph?: any; pilotMetrics?: any }) {
  const deals = Array.isArray(snapshot?.deals) ? snapshot.deals : [];
  const disputes = Array.isArray(snapshot?.disputes) ? snapshot.disputes : [];
  const buyers = Array.isArray(trustGraph?.buyers) ? trustGraph.buyers : [];
  const blockedDeals = deals.filter((item: any) => String(item.status || '').toLowerCase().includes('block') || String(item.blocker || '').trim()).length;
  const activeDisputes = disputes.filter((item: any) => !['closed', 'resolved'].includes(String(item.status || '').toLowerCase())).length;
  const trustedBuyers = buyers.filter((item: any) => item.admission === 'GREEN' || item.status === 'GREEN' || item.trusted).length;
  const railScore = Math.max(0, Math.min(100, 100 - blockedDeals * 5 - activeDisputes * 4 + trustedBuyers));

  return {
    summary: {
      railScore,
      blockedDeals,
      activeDisputes,
      trustedBuyers,
    },
    lanes: [
      { id: 'deal', title: 'Deal rail', detail: `Всего сделок ${deals.length}`, status: blockedDeals ? 'risk' : 'ok' },
      { id: 'dispute', title: 'Dispute rail', detail: `Активных споров ${activeDisputes}`, status: activeDisputes ? 'risk' : 'ok' },
      { id: 'trust', title: 'Trust rail', detail: `Trusted buyers ${trustedBuyers}`, status: trustedBuyers ? 'ok' : 'pending' },
    ],
    bottlenecks: [
      blockedDeals ? { id: 'blocked-deals', title: 'Сделки с блокером', detail: `Количество ${blockedDeals}`, severity: 'high' } : null,
      activeDisputes ? { id: 'active-disputes', title: 'Незакрытые споры', detail: `Количество ${activeDisputes}`, severity: 'high' } : null,
      !trustedBuyers ? { id: 'trust-gap', title: 'Недостаток trusted buyers', detail: 'Trust layer нужно усиливать.', severity: 'medium' } : null,
    ].filter(Boolean),
    productRules: [
      'Один канонический deal rail.',
      'Один money contour с явным hold/release path.',
      'Один evidence trail для quality, logistics и documents.',
      'Ручной fallback допустим только с owner и audit trail.'
    ],
    manualFallbacks: [
      { id: 'docs', lane: 'documents', allowed: 'operator review', owner: 'operator', evidence: 'document pack', backToRail: 'EDO sync' },
      { id: 'payments', lane: 'payments', allowed: 'hold until callback', owner: 'finance', evidence: 'payment proof', backToRail: 'bank callback' },
    ],
    stopCodingGates: [
      { id: 'pilot', title: 'Controlled pilot passed', liveGate: 'Одна сделка закрыта end-to-end.', status: blockedDeals || activeDisputes ? 'pending' : 'ready' },
      { id: 'money', title: 'Money rail stable', liveGate: 'Нет критичных money blockers.', status: activeDisputes ? 'pending' : 'ready' },
    ],
    pilotMetrics,
  };
}

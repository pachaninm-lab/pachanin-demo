export type OperatorCase = {
  id: string;
  kind: 'dispute' | 'document' | 'shipment' | 'payment' | 'onboarding' | 'connector' | 'support';
  title: string;
  owner: string;
  status: string;
  severity: 'GREEN' | 'AMBER' | 'RED';
  slaMinutes: number;
  nextAction: string;
  moneyImpactRub: number;
  href?: string;
  reasonCodes: string[];
};

function norm(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

function severityOf(item: any): OperatorCase['severity'] {
  const blob = `${norm(item?.status)} ${norm(item?.severity)} ${norm(item?.risk)}`;
  if (/BLOCK|OVERDUE|FAILED|DISPUTE|HOLD|ESCALATE/.test(blob)) return 'RED';
  if (/PENDING|WAIT|REVIEW|WARN/.test(blob)) return 'AMBER';
  return 'GREEN';
}

export function buildOperatorCaseCenter(input: {
  disputes?: any[];
  documents?: any[];
  shipments?: any[];
  payments?: any[];
  onboarding?: any[];
  connectors?: any[];
  support?: any[];
}) {
  const cases: OperatorCase[] = [];
  const push = (kind: OperatorCase['kind'], item: any, index: number, fallbackTitle: string, href?: string) => {
    const severity = severityOf(item);
    cases.push({
      id: item?.id || `${kind}-${index}`,
      kind,
      title: item?.title || item?.label || item?.name || fallbackTitle,
      owner: item?.owner || item?.ownerLabel || item?.assignee || 'operator',
      status: norm(item?.status) || 'OPEN',
      severity,
      slaMinutes: severity === 'RED' ? 30 : severity === 'AMBER' ? 180 : 720,
      nextAction: item?.nextAction || item?.requiredNow || (severity === 'RED' ? 'manual_review' : 'continue'),
      moneyImpactRub: Number(item?.moneyImpactRub || item?.amountRub || item?.value || 0),
      href: item?.href || href,
      reasonCodes: Array.isArray(item?.reasonCodes) ? item.reasonCodes : []
    });
  };
  (input.disputes || []).forEach((item, index) => push('dispute', item, index, 'Open dispute', item?.href || '/disputes'));
  (input.documents || []).forEach((item, index) => push('document', item, index, 'Document issue', item?.href || '/documents'));
  (input.shipments || []).forEach((item, index) => push('shipment', item, index, 'Shipment issue', item?.href || '/logistics'));
  (input.payments || []).forEach((item, index) => push('payment', item, index, 'Payment issue', item?.href || '/payments'));
  (input.onboarding || []).forEach((item, index) => push('onboarding', item, index, 'Onboarding issue', item?.href || '/onboarding'));
  (input.connectors || []).forEach((item, index) => push('connector', item, index, 'Connector degradation', item?.href || '/connectors'));
  (input.support || []).forEach((item, index) => push('support', item, index, 'Support issue', item?.href || '/support'));

  const ordered = cases.sort((a, b) => {
    const score = { RED: 0, AMBER: 1, GREEN: 2 };
    if (score[a.severity] !== score[b.severity]) return score[a.severity] - score[b.severity];
    return b.moneyImpactRub - a.moneyImpactRub;
  });

  return {
    cases: ordered,
    summary: {
      total: ordered.length,
      red: ordered.filter((item) => item.severity === 'RED').length,
      amber: ordered.filter((item) => item.severity === 'AMBER').length,
      moneyAtRiskRub: ordered.reduce((sum, item) => sum + Number(item.moneyImpactRub || 0), 0)
    }
  };
}

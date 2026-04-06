import { evaluateStatusTransition, type WorkflowLane } from './status-policy-engine';
import { sourceOfTruthMatrix } from './source-of-truth';

export type ActionDecision = {
  allowed: boolean;
  primaryAction: string;
  reasonCodes: string[];
  owner: string;
  severity: 'GREEN' | 'AMBER' | 'RED';
  sourceTruthLabel: string;
  nextAction: string;
  escalationRequired: boolean;
  slaMinutes: number;
};

function normalize(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export function buildActionDecision(input: {
  lane: WorkflowLane;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  docsReady?: boolean;
  evidenceReady?: boolean;
  blockers?: string[];
  activeDispute?: boolean;
  runMode?: string | null;
  sourceOfTruth?: string | null;
  providerMode?: string | null;
  connectorHealth?: string | null;
  lastSyncAt?: string | null;
  requiredFreshnessMinutes?: number | null;
}) : ActionDecision {
  const blockers = Array.isArray(input.blockers) ? input.blockers.filter(Boolean) : [];
  const transition = evaluateStatusTransition({
    lane: input.lane,
    from: input.fromStatus,
    to: input.toStatus,
    docsReady: input.docsReady,
    evidenceReady: input.evidenceReady
  });
  const source = sourceOfTruthMatrix({
    runMode: input.runMode,
    sourceOfTruth: input.sourceOfTruth,
    providerMode: input.providerMode,
    connectorHealth: input.connectorHealth,
    lastSyncAt: input.lastSyncAt,
    requiredFreshnessMinutes: input.requiredFreshnessMinutes
  });
  const reasons = [...transition.reasonCodes, ...blockers.map((item) => normalize(item).replace(/\s+/g, '_'))];
  if (input.activeDispute && ['payment', 'deal'].includes(input.lane) && normalize(input.action).includes('release')) reasons.push('active_dispute_blocks_release');
  if (source.failClosed) reasons.push(source.stale ? 'source_of_truth_stale' : 'source_of_truth_not_live');
  const allowed = transition.allowed && reasons.length === 0;
  const escalationRequired = !allowed && (source.failClosed || reasons.some((item) => /dispute|missing|invalid|stale|source/.test(item)));
  const severity: ActionDecision['severity'] = allowed ? 'GREEN' : source.failClosed || blockers.length > 1 ? 'RED' : 'AMBER';
  const nextAction = allowed
    ? `execute_${normalize(input.action).replace(/[^a-z0-9]+/g, '_')}`
    : reasons.includes('documents_not_ready')
      ? 'close_document_gap'
      : reasons.some((item) => item.includes('evidence'))
        ? 'attach_evidence'
        : reasons.some((item) => item.includes('dispute'))
          ? 'resolve_dispute'
          : source.failClosed
            ? 'restore_live_truth'
            : 'manual_review';
  return {
    allowed,
    primaryAction: input.action,
    reasonCodes: Array.from(new Set(reasons)),
    owner: transition.owner,
    severity,
    sourceTruthLabel: source.uiLabel,
    nextAction,
    escalationRequired,
    slaMinutes: severity === 'RED' ? 30 : severity === 'AMBER' ? 120 : 480
  };
}

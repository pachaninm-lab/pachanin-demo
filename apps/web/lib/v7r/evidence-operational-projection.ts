import { createActionLogEntry, type PlatformActionLogEntry } from '../platform-v7/action-log';
import { buildStableDisputeEvidencePack } from './evidence-pack';
import { buildEvidencePackReadinessUiModel } from './evidence-pack-ui';
import { buildDealPersistenceTimeline } from './deal-persistence-timeline';

export interface P7EvidenceTimelineEvent {
  readonly ts: string;
  readonly actor: string;
  readonly action: string;
  readonly type: 'success' | 'danger' | 'warning';
}

export interface P7DisputeEvidenceOperationalProjection {
  readonly disputeId: string;
  readonly dealId: string | null;
  readonly evidenceScore: string;
  readonly evidenceStatus: string;
  readonly evidenceBlockers: string[];
  readonly timeline: P7EvidenceTimelineEvent[];
  readonly operatorActionLog: PlatformActionLogEntry[];
  readonly summary: {
    readonly timelineEvents: number;
    readonly actionLogEntries: number;
    readonly evidenceObjects: number;
    readonly persistenceEvents: number;
  };
}

function latestEvidenceTimestamp(items: ReturnType<typeof buildStableDisputeEvidencePack>['items']): string {
  const dates = items
    .map((item) => item.uploadedAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (!dates.length) return '2026-04-26T12:30:00Z';
  return new Date(Math.max(...dates)).toISOString();
}

function normalizeTimelineType(value: string): P7EvidenceTimelineEvent['type'] {
  if (value === 'danger') return 'danger';
  if (value === 'warning') return 'warning';
  return 'success';
}

function buildDealEvidenceTimeline(dealId: string): P7EvidenceTimelineEvent[] {
  return buildDealPersistenceTimeline(dealId).map((event) => ({
    ts: event.ts,
    actor: event.actor,
    action: event.action,
    type: normalizeTimelineType(event.type),
  }));
}

function buildEvidenceTimelineEvent(input: {
  disputeId: string;
  score: string;
  status: string;
  blockers: readonly string[];
  at: string;
}): P7EvidenceTimelineEvent {
  return {
    ts: input.at,
    actor: 'Evidence runtime',
    action: input.blockers.length
      ? `Evidence readiness ${input.score}: requires review ${input.disputeId}`
      : `Evidence readiness ${input.score}: ${input.status} ${input.disputeId}`,
    type: input.blockers.length ? 'danger' : 'success',
  };
}

function buildEvidenceActionLog(input: {
  disputeId: string;
  dealId: string | null;
  score: string;
  blockers: readonly string[];
  at: string;
}): PlatformActionLogEntry[] {
  const objectId = input.disputeId || input.dealId || 'UNKNOWN';

  return [createActionLogEntry({
    scope: 'dispute',
    status: input.blockers.length ? 'error' : 'success',
    objectId,
    action: 'evidence-readiness-check',
    actor: 'operator-runtime',
    at: input.at,
    message: input.blockers.length
      ? `Evidence readiness ${input.score}: ${input.blockers.length} issue(s).`
      : `Evidence readiness ${input.score}: pack can move to review in controlled pilot layer.`,
    error: input.blockers.length ? input.blockers.join('; ') : undefined,
  })];
}

export function buildDisputeEvidenceOperationalProjection(disputeId: string): P7DisputeEvidenceOperationalProjection {
  const pack = buildStableDisputeEvidencePack(disputeId);
  const ui = buildEvidencePackReadinessUiModel(disputeId);
  const dealTimeline = pack.dealId ? buildDealEvidenceTimeline(pack.dealId) : [];
  const at = latestEvidenceTimestamp(pack.items);
  const evidenceEvent = buildEvidenceTimelineEvent({
    disputeId,
    score: ui.scoreLabel,
    status: ui.statusLabel,
    blockers: ui.blockers,
    at,
  });
  const operatorActionLog = buildEvidenceActionLog({
    disputeId,
    dealId: pack.dealId,
    score: ui.scoreLabel,
    blockers: ui.blockers,
    at,
  });

  return {
    disputeId,
    dealId: pack.dealId,
    evidenceScore: ui.scoreLabel,
    evidenceStatus: ui.statusLabel,
    evidenceBlockers: ui.blockers,
    timeline: [...dealTimeline, evidenceEvent].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()),
    operatorActionLog,
    summary: {
      timelineEvents: dealTimeline.length + 1,
      actionLogEntries: operatorActionLog.length,
      evidenceObjects: pack.items.length,
      persistenceEvents: dealTimeline.length,
    },
  };
}

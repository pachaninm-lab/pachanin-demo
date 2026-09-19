export type PlatformV7CasePackKind =
  | 'loading_photo'
  | 'seal_photo'
  | 'gps_point'
  | 'route_track'
  | 'loading_weight'
  | 'acceptance_weight'
  | 'lab_protocol'
  | 'discrepancy_act'
  | 'party_comment'
  | 'arbitration_decision';

export type PlatformV7CasePackStatus = 'missing' | 'uploaded' | 'verified' | 'manual_review' | 'rejected';

export interface PlatformV7CasePackItem {
  readonly kind: PlatformV7CasePackKind;
  readonly itemId: string;
  readonly status: PlatformV7CasePackStatus;
  readonly blocksMoneyRelease: boolean;
  readonly disputeRequired: boolean;
}

export interface PlatformV7CasePackReadiness {
  readonly complete: boolean;
  readonly missingKinds: readonly PlatformV7CasePackKind[];
  readonly manualReviewKinds: readonly PlatformV7CasePackKind[];
  readonly verifiedCount: number;
  readonly moneyReleaseBlocked: boolean;
  readonly disputeReady: boolean;
}

export const PLATFORM_V7_REQUIRED_CASE_PACK_KINDS: readonly PlatformV7CasePackKind[] = [
  'loading_photo',
  'seal_photo',
  'gps_point',
  'route_track',
  'loading_weight',
  'acceptance_weight',
  'lab_protocol',
  'discrepancy_act',
  'party_comment',
  'arbitration_decision',
] as const;

export function platformV7CreateCasePackItems(dealId: string): readonly PlatformV7CasePackItem[] {
  return PLATFORM_V7_REQUIRED_CASE_PACK_KINDS.map((kind) => ({
    kind,
    itemId: `${dealId}-${kind}`,
    status: 'missing',
    blocksMoneyRelease: true,
    disputeRequired: false,
  }));
}

export function platformV7CasePackReadiness(items: readonly PlatformV7CasePackItem[]): PlatformV7CasePackReadiness {
  const byKind = new Map(items.map((item) => [item.kind, item]));
  const missingKinds = PLATFORM_V7_REQUIRED_CASE_PACK_KINDS.filter((kind) => !byKind.has(kind) || byKind.get(kind)?.status === 'missing');
  const manualReviewKinds = items.filter((item) => item.status === 'manual_review').map((item) => item.kind);
  const verifiedCount = items.filter((item) => item.status === 'verified').length;
  const moneyReleaseBlocked = items.some((item) => item.blocksMoneyRelease && item.status !== 'verified') || missingKinds.length > 0;
  const disputeReady = items.some((item) => item.disputeRequired) && verifiedCount >= 3;

  return {
    complete: missingKinds.length === 0 && manualReviewKinds.length === 0,
    missingKinds,
    manualReviewKinds,
    verifiedCount,
    moneyReleaseBlocked,
    disputeReady,
  };
}

export type P7EvidenceType = 'photo' | 'pdf' | 'video' | 'lab_protocol' | 'surveyor_act' | 'transport_document' | 'bank_event' | 'fgis_record' | 'other';
export type P7EvidenceSource = 'seller' | 'buyer' | 'platform' | 'bank' | 'fgis' | 'sberkorus' | 'lab' | 'surveyor';
export type P7EvidenceTrust = 'self_declared' | 'platform_verified' | 'provider_verified' | 'signed';
export type P7EvidencePackStatus = 'incomplete' | 'ready_for_review' | 'locked';

export interface P7EvidenceGeo {
  readonly lat: number;
  readonly lon: number;
  readonly accuracyM?: number;
}

export interface P7EvidenceItem {
  readonly id: string;
  readonly dealId: string;
  readonly disputeId?: string;
  readonly type: P7EvidenceType;
  readonly source: P7EvidenceSource;
  readonly trust: P7EvidenceTrust;
  readonly title: string;
  readonly hash: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
  readonly capturedAt?: string;
  readonly uploadedAt: string;
  readonly actor: string;
  readonly geo?: P7EvidenceGeo;
  readonly signedBy?: string;
  readonly previousHash?: string;
  readonly version: number;
  readonly immutable: boolean;
}

export interface P7EvidencePackRequirement {
  readonly type: P7EvidenceType;
  readonly source?: P7EvidenceSource;
  readonly minCount: number;
  readonly required: boolean;
}

export interface P7EvidencePackIssue {
  readonly code: 'MISSING_REQUIRED_EVIDENCE' | 'HASH_MISSING' | 'IMMUTABILITY_BROKEN' | 'VERSION_INVALID' | 'CHAIN_BROKEN' | 'SIGNATURE_REQUIRED';
  readonly target: string;
  readonly message: string;
}

export interface P7EvidencePackReadiness {
  readonly status: P7EvidencePackStatus;
  readonly total: number;
  readonly requiredTotal: number;
  readonly requiredReady: number;
  readonly score: number;
  readonly issues: P7EvidencePackIssue[];
}

export const DEFAULT_DISPUTE_EVIDENCE_REQUIREMENTS: P7EvidencePackRequirement[] = [
  { type: 'lab_protocol', minCount: 1, required: true },
  { type: 'transport_document', minCount: 1, required: true },
  { type: 'photo', minCount: 1, required: true },
  { type: 'surveyor_act', minCount: 1, required: false },
  { type: 'bank_event', minCount: 1, required: false },
];

function matchesRequirement(item: P7EvidenceItem, requirement: P7EvidencePackRequirement): boolean {
  if (item.type !== requirement.type) return false;
  if (requirement.source && item.source !== requirement.source) return false;
  return true;
}

function countMatching(items: readonly P7EvidenceItem[], requirement: P7EvidencePackRequirement): number {
  return items.filter((item) => matchesRequirement(item, requirement)).length;
}

export function validateEvidenceItem(item: P7EvidenceItem): P7EvidencePackIssue[] {
  const issues: P7EvidencePackIssue[] = [];

  if (!item.hash.trim()) {
    issues.push({ code: 'HASH_MISSING', target: item.id, message: `Evidence ${item.id} has no hash` });
  }

  if (!item.immutable) {
    issues.push({ code: 'IMMUTABILITY_BROKEN', target: item.id, message: `Evidence ${item.id} is mutable` });
  }

  if (!Number.isInteger(item.version) || item.version < 1) {
    issues.push({ code: 'VERSION_INVALID', target: item.id, message: `Evidence ${item.id} has invalid version` });
  }

  if (item.trust === 'signed' && !item.signedBy?.trim()) {
    issues.push({ code: 'SIGNATURE_REQUIRED', target: item.id, message: `Evidence ${item.id} requires signer` });
  }

  return issues;
}

export function validateEvidenceChain(items: readonly P7EvidenceItem[]): P7EvidencePackIssue[] {
  const issues: P7EvidencePackIssue[] = [];
  const byHash = new Set(items.map((item) => item.hash).filter(Boolean));

  for (const item of items) {
    if (item.previousHash && !byHash.has(item.previousHash)) {
      issues.push({ code: 'CHAIN_BROKEN', target: item.id, message: `Evidence ${item.id} points to missing previous hash` });
    }
  }

  return issues;
}

export function buildEvidencePackReadiness(
  items: readonly P7EvidenceItem[],
  requirements: readonly P7EvidencePackRequirement[] = DEFAULT_DISPUTE_EVIDENCE_REQUIREMENTS,
): P7EvidencePackReadiness {
  const itemIssues = items.flatMap(validateEvidenceItem);
  const chainIssues = validateEvidenceChain(items);
  const missingIssues: P7EvidencePackIssue[] = [];
  const requiredRequirements = requirements.filter((requirement) => requirement.required);

  let requiredReady = 0;
  let requiredTotal = 0;

  for (const requirement of requiredRequirements) {
    requiredTotal += requirement.minCount;
    const count = countMatching(items, requirement);
    requiredReady += Math.min(count, requirement.minCount);

    if (count < requirement.minCount) {
      missingIssues.push({
        code: 'MISSING_REQUIRED_EVIDENCE',
        target: requirement.source ? `${requirement.source}:${requirement.type}` : requirement.type,
        message: `Missing ${requirement.minCount - count} required evidence item(s) for ${requirement.type}`,
      });
    }
  }

  const issues = [...itemIssues, ...chainIssues, ...missingIssues];
  const score = requiredTotal === 0 ? 100 : Math.round((requiredReady / requiredTotal) * 100);
  const status: P7EvidencePackStatus = issues.length > 0 ? 'incomplete' : 'ready_for_review';

  return {
    status,
    total: items.length,
    requiredTotal,
    requiredReady,
    score,
    issues,
  };
}

export function lockEvidencePack(items: readonly P7EvidenceItem[]): P7EvidenceItem[] {
  return items.map((item) => ({ ...item, immutable: true }));
}

export function appendEvidenceItem(items: readonly P7EvidenceItem[], item: P7EvidenceItem): readonly P7EvidenceItem[] {
  if (items.some((existing) => existing.id === item.id)) return [...items];
  return [...items, item];
}

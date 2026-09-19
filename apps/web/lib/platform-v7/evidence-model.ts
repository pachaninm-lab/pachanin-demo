import type { PlatformV7EntityId } from './execution-model';

export interface PlatformV7EvidencePack {
  id: PlatformV7EntityId;
  dealId: PlatformV7EntityId;
  readinessScore: number;
  requiredEvidenceTypes: string[];
  receivedEvidenceIds: PlatformV7EntityId[];
  missingEvidenceTypes: string[];
  canResolve: boolean;
}

export function getPlatformV7EvidenceMissingCount(pack: PlatformV7EvidencePack): number {
  return pack.missingEvidenceTypes.length;
}

export function isPlatformV7EvidencePackComplete(pack: PlatformV7EvidencePack): boolean {
  return pack.requiredEvidenceTypes.length > 0 && pack.missingEvidenceTypes.length === 0 && pack.receivedEvidenceIds.length >= pack.requiredEvidenceTypes.length;
}

export function canPlatformV7ResolveFromEvidence(pack: PlatformV7EvidencePack): boolean {
  return pack.canResolve && pack.readinessScore >= 80 && isPlatformV7EvidencePackComplete(pack);
}

export function isPlatformV7EvidencePackLinked(pack: PlatformV7EvidencePack): boolean {
  return Boolean(pack.dealId && pack.id);
}

import type { PlatformV7Blocker, PlatformV7EntityId, PlatformV7IsoDateTime, PlatformV7NextAction, PlatformV7Tons } from './execution-model';

export interface PlatformV7GrainBatch {
  id: PlatformV7EntityId;
  ownerId: PlatformV7EntityId;
  crop: string;
  class: string;
  harvestYear: number;
  totalTons: PlatformV7Tons;
  availableTons: PlatformV7Tons;
  reservedTons: PlatformV7Tons;
  soldTons: PlatformV7Tons;
  region: string;
  storageLocation: string;
  storageType: 'farm' | 'elevator' | 'warehouse';
  fgisStatus: 'missing' | 'draft' | 'ready' | 'sent' | 'confirmed' | 'manual_review';
  sdizStatus: 'missing' | 'draft' | 'ready_to_sign' | 'signed' | 'sent' | 'redeemed' | 'manual_review';
  qualityStatus: 'missing' | 'declared' | 'lab_pending' | 'confirmed' | 'rejected';
  documentStatus: 'missing' | 'partial' | 'ready' | 'blocked';
  readinessScore: number;
  blockers: PlatformV7Blocker[];
  createdAt: PlatformV7IsoDateTime;
  updatedAt: PlatformV7IsoDateTime;
}

export interface PlatformV7BatchReadiness {
  batchId: PlatformV7EntityId;
  score: number;
  canPublish: boolean;
  canCreateDeal: boolean;
  criticalBlockers: PlatformV7Blocker[];
  warnings: PlatformV7Blocker[];
  nextActions: PlatformV7NextAction[];
}

export function isPlatformV7BatchVolumeBalanced(batch: PlatformV7GrainBatch): boolean {
  return batch.availableTons + batch.reservedTons + batch.soldTons <= batch.totalTons;
}

export function canPlatformV7BatchPublish(batch: PlatformV7GrainBatch): boolean {
  return isPlatformV7BatchVolumeBalanced(batch) && batch.readinessScore >= 80 && batch.blockers.every((blocker) => blocker.severity !== 'critical');
}

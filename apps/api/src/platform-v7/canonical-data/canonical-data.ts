import type { PlatformV7Role } from '../rbac';

export type PlatformV7CanonicalEntityType =
  | 'deal'
  | 'participant'
  | 'logisticsOrder'
  | 'qualityResult'
  | 'moneyBasis'
  | 'disputeCase'
  | 'auditEntry'
  | 'supportCase';

export type PlatformV7CanonicalSource =
  | 'platform-v7-control-plane'
  | 'tenant-ledger-read-model'
  | 'evidence-read-model'
  | 'support-read-model';

export type PlatformV7CanonicalWritePolicy = 'read-only' | 'controlled-pilot-write' | 'external-live-blocked';

export type PlatformV7CanonicalEntity = Readonly<{
  entityType: PlatformV7CanonicalEntityType;
  canonicalSource: PlatformV7CanonicalSource;
  ownerRoles: readonly PlatformV7Role[];
  writePolicy: PlatformV7CanonicalWritePolicy;
  notes: string;
}>;

export type PlatformV7CanonicalDecisionReason =
  | 'canonical-source-selected'
  | 'unknown-entity'
  | 'role-not-owner'
  | 'write-blocked'
  | 'external-live-blocked';

export type PlatformV7CanonicalDecision = Readonly<{
  allowed: boolean;
  reason: PlatformV7CanonicalDecisionReason;
  entity: PlatformV7CanonicalEntity | null;
}>;

export const PLATFORM_V7_CANONICAL_ENTITIES: Readonly<Record<PlatformV7CanonicalEntityType, PlatformV7CanonicalEntity>> = {
  deal: {
    entityType: 'deal',
    canonicalSource: 'platform-v7-control-plane',
    ownerRoles: ['seller', 'buyer', 'operator', 'support', 'executive'],
    writePolicy: 'controlled-pilot-write',
    notes: 'Deal header and status source for controlled-pilot flows; no DB or live provider wiring in this boundary.',
  },
  participant: {
    entityType: 'participant',
    canonicalSource: 'platform-v7-control-plane',
    ownerRoles: ['seller', 'buyer', 'operator', 'support', 'compliance'],
    writePolicy: 'controlled-pilot-write',
    notes: 'Participant profile source stays internal to the pilot boundary; auth/session persistence is not selected.',
  },
  logisticsOrder: {
    entityType: 'logisticsOrder',
    canonicalSource: 'tenant-ledger-read-model',
    ownerRoles: ['logistics', 'driver', 'elevator', 'operator', 'executive'],
    writePolicy: 'controlled-pilot-write',
    notes: 'Operational logistics source only; no live carrier integration or runtime orchestration.',
  },
  qualityResult: {
    entityType: 'qualityResult',
    canonicalSource: 'evidence-read-model',
    ownerRoles: ['elevator', 'lab', 'operator', 'compliance', 'executive'],
    writePolicy: 'controlled-pilot-write',
    notes: 'Quality result source is typed but not connected to FGIS, EDO or laboratory live systems.',
  },
  moneyBasis: {
    entityType: 'moneyBasis',
    canonicalSource: 'tenant-ledger-read-model',
    ownerRoles: ['bank', 'compliance', 'operator', 'executive'],
    writePolicy: 'read-only',
    notes: 'Money basis is read-only in this boundary; no release authority, ledger mutation or banking integration.',
  },
  disputeCase: {
    entityType: 'disputeCase',
    canonicalSource: 'evidence-read-model',
    ownerRoles: ['arbitrator', 'compliance', 'operator', 'support', 'executive'],
    writePolicy: 'controlled-pilot-write',
    notes: 'Dispute source is controlled-pilot evidence metadata only; no storage or legal workflow integration.',
  },
  auditEntry: {
    entityType: 'auditEntry',
    canonicalSource: 'evidence-read-model',
    ownerRoles: ['compliance', 'arbitrator', 'operator', 'support', 'executive'],
    writePolicy: 'read-only',
    notes: 'Audit entries are read-only here; no audit/outbox persistence is selected.',
  },
  supportCase: {
    entityType: 'supportCase',
    canonicalSource: 'support-read-model',
    ownerRoles: ['support', 'operator', 'compliance'],
    writePolicy: 'controlled-pilot-write',
    notes: 'Support case source remains local to the platform-v7 pilot boundary.',
  },
} as const;

export function platformV7CanonicalEntityFor(entityType: string): PlatformV7CanonicalEntity | null {
  return PLATFORM_V7_CANONICAL_ENTITIES[entityType as PlatformV7CanonicalEntityType] ?? null;
}

export function platformV7CanonicalReadDecision(
  role: PlatformV7Role,
  entityType: string,
): PlatformV7CanonicalDecision {
  const entity = platformV7CanonicalEntityFor(entityType);

  if (entity === null) {
    return { allowed: false, reason: 'unknown-entity', entity: null };
  }

  if (!entity.ownerRoles.includes(role)) {
    return { allowed: false, reason: 'role-not-owner', entity };
  }

  return { allowed: true, reason: 'canonical-source-selected', entity };
}

export function platformV7CanonicalWriteDecision(
  role: PlatformV7Role,
  entityType: string,
): PlatformV7CanonicalDecision {
  const readDecision = platformV7CanonicalReadDecision(role, entityType);

  if (!readDecision.allowed || readDecision.entity === null) {
    return readDecision;
  }

  if (readDecision.entity.writePolicy === 'external-live-blocked') {
    return { allowed: false, reason: 'external-live-blocked', entity: readDecision.entity };
  }

  if (readDecision.entity.writePolicy === 'read-only') {
    return { allowed: false, reason: 'write-blocked', entity: readDecision.entity };
  }

  return readDecision;
}

export function platformV7AssertCanonicalRead(role: PlatformV7Role, entityType: string): void {
  const decision = platformV7CanonicalReadDecision(role, entityType);

  if (!decision.allowed) {
    throw new Error(`platform-v7 canonical read rejected: ${decision.reason}`);
  }
}

export function platformV7AssertCanonicalWrite(role: PlatformV7Role, entityType: string): void {
  const decision = platformV7CanonicalWriteDecision(role, entityType);

  if (!decision.allowed) {
    throw new Error(`platform-v7 canonical write rejected: ${decision.reason}`);
  }
}

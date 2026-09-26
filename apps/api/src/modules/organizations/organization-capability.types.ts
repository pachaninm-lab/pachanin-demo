import type { OrganizationCapabilityCode } from './organization-capability.registry';

export const ORGANIZATION_CAPABILITY_STATUSES = ['PENDING', 'ACTIVE', 'DISABLED'] as const;
export type OrganizationCapabilityStatus = typeof ORGANIZATION_CAPABILITY_STATUSES[number];

export const ORGANIZATION_CAPABILITY_INTENTS = ['ENABLE', 'DISABLE'] as const;
export type OrganizationCapabilityIntent = typeof ORGANIZATION_CAPABILITY_INTENTS[number];

export type OrganizationCapabilityRecord = Readonly<{
  id: string;
  tenantId: string;
  organizationId: string;
  capabilityCode: OrganizationCapabilityCode;
  status: OrganizationCapabilityStatus;
  evidenceRef: string | null;
  evidenceKind: 'DECLARATION_ONLY' | 'ROLE_ELIGIBILITY' | 'SERVER_EVIDENCE_REQUIRED';
  version: string;
  createdAt: string;
  updatedAt: string;
}>;

export type OrganizationCapabilityMutationInput = Readonly<{
  capabilityCode: OrganizationCapabilityCode;
  intent: OrganizationCapabilityIntent;
  expectedVersion: bigint;
  idempotencyKey: string;
  correlationId: string;
}>;

export type OrganizationCapabilityMutationResult = Readonly<{
  assignment: OrganizationCapabilityRecord;
  replayed: boolean;
  reasonCode: string;
  auditId: string;
  outboxId: string;
}>;

export type OrganizationCapabilityMutationBody = Readonly<{
  intent?: unknown;
  expectedVersion?: unknown;
  idempotencyKey?: unknown;
  correlationId?: unknown;
}>;

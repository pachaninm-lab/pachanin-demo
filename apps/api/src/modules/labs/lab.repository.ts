import type { RequestUser } from '../../common/types/request-user';

/** PostgreSQL-backed laboratory data-access boundary used by production. */
export const LAB_REPOSITORY = 'LAB_REPOSITORY';

export type LabCommand = Readonly<{
  commandId: string;
  idempotencyKey: string;
  correlationId?: string;
}>;

export type CreateLabSampleCommand = LabCommand & Readonly<{
  dealId: string;
  shipmentId: string;
  acceptanceId: string;
  evidenceRef: string;
  occurredAt: string;
  note?: string;
}>;

export type CollectLabSampleCommand = LabCommand & Readonly<{
  expectedVersion: string;
  evidenceRef: string;
  occurredAt: string;
}>;

export type LabCustodyEventType = 'SEALED' | 'HANDOFF' | 'RECEIVED' | 'OPENED';

export type RecordLabCustodyCommand = LabCommand & Readonly<{
  expectedVersion: string;
  eventType: LabCustodyEventType;
  evidenceRef: string;
  occurredAt: string;
  note?: string;
}>;

export type RecordLabTestCommand = LabCommand & Readonly<{
  expectedVersion: string;
  metric: string;
  value: number;
  unit: string;
  methodCode: string;
  equipmentCode: string;
  evidenceRef: string;
  occurredAt: string;
  note?: string;
}>;

export type LabSampleRecord = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  acceptanceId: string | null;
  tenantId: string;
  status: string;
  custodyStatus: string;
  culture: string | null;
  protocol: string | null;
  gost: string | null;
  labId: string | null;
  labName: string | null;
  assignedActorUserId: string | null;
  collectedAt: Date | null;
  finalizedAt: Date | null;
  certificateDocId: string | null;
  latestEvidenceFileId: string | null;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type LabTestRecord = Readonly<{
  id: string;
  sampleId: string;
  tenantId: string;
  parameter: string;
  value: string;
  unit: string | null;
  normMin: string | null;
  normMax: string | null;
  result: string;
  methodId: string;
  equipmentId: string;
  evidenceFileId: string;
  actorUserId: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string | null;
  supersedesId: string | null;
  recordedAt: Date;
}>;

export type LabCustodyEventRecord = Readonly<{
  id: string;
  sampleId: string;
  tenantId: string;
  eventType: string;
  fromStatus: string;
  toStatus: string;
  actorUserId: string;
  laboratoryOrgId: string;
  evidenceFileId: string;
  commandId: string;
  idempotencyKey: string;
  correlationId: string | null;
  occurredAt: Date;
  note: string | null;
  prevHash: string | null;
  hash: string;
  createdAt: Date;
}>;

export type LabProtocolRecord = Readonly<{
  id: string;
  sampleId: string;
  tenantId: string;
  protocolNumber: string;
  laboratoryOrgId: string;
  accreditationRef: string;
  standardRef: string;
  result: string;
  signedEvidenceFileId: string;
  finalizedByUserId: string;
  finalizedAt: Date;
  version: number;
  supersedesId: string | null;
  createdAt: Date;
}>;

export type LabWorkspace = Readonly<{
  sample: LabSampleRecord;
  tests: LabTestRecord[];
  custody: LabCustodyEventRecord[];
  protocol: LabProtocolRecord | null;
}>;

export type LabMutationResult = Readonly<{
  sample: LabSampleRecord;
  auditId: string;
  outboxId: string;
  duplicate: boolean;
  test?: LabTestRecord;
  custodyEvent?: LabCustodyEventRecord;
}>;

export interface LabRepository {
  list(user: RequestUser): Promise<LabSampleRecord[]>;
  getById(id: string, user: RequestUser): Promise<LabSampleRecord>;
  workspace(id: string, user: RequestUser): Promise<LabWorkspace>;
  create(command: CreateLabSampleCommand, user: RequestUser): Promise<LabMutationResult>;
  collect(id: string, command: CollectLabSampleCommand, user: RequestUser): Promise<LabMutationResult>;
  recordCustody(id: string, command: RecordLabCustodyCommand, user: RequestUser): Promise<LabMutationResult>;
  recordTest(id: string, command: RecordLabTestCommand, user: RequestUser): Promise<LabMutationResult>;
}

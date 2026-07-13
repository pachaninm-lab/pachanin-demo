import type { RequestUser } from '../../common/types/request-user';

export const LAB_REPOSITORY = 'LAB_REPOSITORY';

export type LabSampleStatus =
  | 'PENDING'
  | 'COLLECTED'
  | 'RECEIVED'
  | 'ANALYSIS_IN_PROGRESS'
  | 'READY_FOR_FINALIZATION'
  | 'FINALIZED';

export type LabTestRecord = Readonly<{
  id: string;
  sampleId: string;
  tenantId: string;
  parameter: string;
  value: number;
  unit: string | null;
  normMin: number | null;
  normMax: number | null;
  passed: boolean;
  methodId: string;
  equipmentId: string;
  actorUserId: string;
  correctionOfTestId: string | null;
  recordedAt: Date;
}>;

export type LabCustodyEventRecord = Readonly<{
  id: string;
  sampleId: string;
  tenantId: string;
  eventType: string;
  fromOrgId: string | null;
  fromUserId: string | null;
  toOrgId: string;
  toUserId: string;
  evidenceRef: string;
  occurredAt: Date;
  commandId: string;
  createdAt: Date;
}>;

export type LabSampleRecord = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  acceptanceId: string | null;
  tenantId: string;
  labOrgId: string;
  assignedLabUserId: string;
  samplerUserId: string | null;
  currentCustodianOrgId: string;
  currentCustodianUserId: string;
  status: LabSampleStatus;
  culture: string | null;
  protocol: string | null;
  gost: string | null;
  accreditationId: string | null;
  finalizedAt: Date | null;
  finalizedByUserId: string | null;
  certificateDocId: string | null;
  protocolHash: string | null;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type LabWorkspace = Readonly<{
  sample: LabSampleRecord;
  tests: LabTestRecord[];
  custody: LabCustodyEventRecord[];
}>;

export type LabCommandBase = Readonly<{
  commandId: string;
  idempotencyKey: string;
  expectedVersion: string | number | bigint;
  correlationId?: string;
}>;

export type CreateLabSampleCommand = Readonly<{
  dealId: string;
  shipmentId?: string;
  acceptanceId?: string;
  evidenceRef: string;
  occurredAt: string | Date;
  commandId: string;
  idempotencyKey: string;
  correlationId?: string;
}>;

export type CollectLabSampleCommand = LabCommandBase & Readonly<{
  evidenceRef: string;
  occurredAt: string | Date;
  note?: string;
}>;

export type RecordLabTestCommand = LabCommandBase & Readonly<{
  metric: string;
  value: number;
  unit?: string;
  normMin?: number;
  normMax?: number;
  methodId: string;
  equipmentId: string;
  correctionOfTestId?: string;
  recordedAt: string | Date;
  note?: string;
}>;

export type FinalizeLabSampleCommand = LabCommandBase & Readonly<{
  protocolNumber: string;
  applicableStandard: string;
  accreditationId: string;
  signedEvidenceRef: string;
  finalizedAt: string | Date;
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
  getById(id: string, user: RequestUser): Promise<LabWorkspace>;
  create(command: CreateLabSampleCommand, user: RequestUser): Promise<LabMutationResult>;
  collect(id: string, command: CollectLabSampleCommand, user: RequestUser): Promise<LabMutationResult>;
  recordTest(id: string, command: RecordLabTestCommand, user: RequestUser): Promise<LabMutationResult>;
  finalize(id: string, command: FinalizeLabSampleCommand, user: RequestUser): Promise<LabMutationResult>;
}

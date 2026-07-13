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
  shipmentId?: string;
  note?: string;
  expectedDealUpdatedAt: string;
}>;

export type CollectLabSampleCommand = LabCommand & Readonly<{
  expectedVersion: string;
  occurredAt: string;
  evidenceRef: string;
  sealCode?: string;
}>;

export type RecordLabTestCommand = LabCommand & Readonly<{
  expectedVersion: string;
  metric: string;
  value: number;
  unit?: string;
  normMin?: number;
  normMax?: number;
  methodId: string;
  equipmentId: string;
  recordedAt: string;
  note?: string;
}>;

export type FinalizeLabSampleCommand = LabCommand & Readonly<{
  expectedVersion: string;
  protocolNumber: string;
  applicableStandard: string;
  accreditationRef: string;
  signedEvidenceRef: string;
  finalizedAt: string;
}>;

export type LabSampleRecord = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  acceptanceId: string | null;
  status: string;
  culture: string | null;
  protocol: string | null;
  gost: string | null;
  labId: string | null;
  labName: string | null;
  collectedAt: Date | null;
  finalizedAt: Date | null;
  moneyDeltaKopecks: string | null;
  certificateDocId: string | null;
  version: string;
  createdAt: Date;
}>;

export type LabTestRecord = Readonly<{
  id: string;
  sampleId: string;
  parameter: string;
  value: number;
  unit: string | null;
  normMin: number | null;
  normMax: number | null;
  passed: boolean;
  gradeDelta: number | null;
  recordedAt: Date;
}>;

export type LabCustodyRecord = Readonly<{
  id: string;
  tenantId: string;
  dealId: string;
  sampleId: string;
  eventType: string;
  actorUserId: string;
  actorOrgId: string;
  evidenceFileId: string | null;
  sealCode: string | null;
  occurredAt: Date;
  commandId: string;
  idempotencyKey: string;
  correlationId: string | null;
  createdAt: Date;
}>;

export type LabProtocolRecord = Readonly<{
  id: string;
  tenantId: string;
  dealId: string;
  sampleId: string;
  laboratoryOrgId: string;
  protocolNumber: string;
  applicableStandard: string;
  accreditationRef: string;
  evidenceFileId: string;
  status: string;
  finalizedByUserId: string;
  finalizedAt: Date;
  supersedesProtocolId: string | null;
  version: string;
  createdAt: Date;
}>;

export type LabWorkspace = Readonly<{
  sample: LabSampleRecord;
  tests: LabTestRecord[];
  custody: LabCustodyRecord[];
  protocols: LabProtocolRecord[];
}>;

export type LabMutationResult = Readonly<{
  sample: LabSampleRecord;
  auditId: string;
  outboxId: string;
  duplicate: boolean;
  test?: LabTestRecord;
  custodyEvent?: LabCustodyRecord;
  protocol?: LabProtocolRecord;
}>;

export interface LabRepository {
  list(user: RequestUser): Promise<LabSampleRecord[]>;
  getById(id: string, user: RequestUser): Promise<LabSampleRecord>;
  workspace(id: string, user: RequestUser): Promise<LabWorkspace>;
  create(command: CreateLabSampleCommand, user: RequestUser): Promise<LabMutationResult>;
  collect(id: string, command: CollectLabSampleCommand, user: RequestUser): Promise<LabMutationResult>;
  recordTest(id: string, command: RecordLabTestCommand, user: RequestUser): Promise<LabMutationResult>;
  finalize(id: string, command: FinalizeLabSampleCommand, user: RequestUser): Promise<LabMutationResult>;
}

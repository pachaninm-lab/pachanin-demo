import { serverApiUrl, serverAuthHeaders } from './server-api';

export type DocumentBasisStatus = 'ready' | 'review' | 'required';

export type DocumentBasisKind =
  | 'contract'
  | 'sdiz'
  | 'transport_waybill'
  | 'lab_protocol'
  | 'quality_certificate'
  | 'acceptance_act'
  | 'bank_basis';

export type DealDocumentAuthority = Readonly<{
  id: string;
  dealId: string;
  tenantId: string;
  type: string;
  status: string;
  name: string;
  hash: string | null;
  signedAt: string | null;
  bankRequired: boolean;
  releaseRequired: boolean;
  bankAcceptance: string;
  edoStatus: string | null;
  edoExternalId: string | null;
  version: number;
  isImmutable: boolean;
  sourceFileId: string | null;
  signatureFileId: string | null;
  supersedesId: string | null;
  seriesId: string | null;
  uploadedAt: string;
}>;

type DocumentShipment = Readonly<{
  id: string;
  dealId: string;
  tenantId: string;
  status: string;
}>;

type DocumentAcceptance = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  status: string;
  qualityStatus: string;
  actDocId: string | null;
  actSignedAt: string | null;
}>;

type DocumentLabSample = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  acceptanceId: string | null;
  tenantId: string;
  status: string;
  finalizedAt: string | null;
  certificateDocId: string | null;
  tests: ReadonlyArray<Readonly<{ id: string; passed: boolean }>>;
}>;

export type CanonicalDealDocumentWorkspace = Readonly<{
  deal: Readonly<{
    id: string;
    tenantId: string;
    version: string;
    status: string;
    lotId: string | null;
    sourceLotId: string | null;
    shipments: DocumentShipment[];
    acceptanceRecords: DocumentAcceptance[];
    labSamples: DocumentLabSample[];
  }>;
  viewer: Readonly<{
    participantId: string;
    organizationId: string;
    role: string;
    accessLevel: string;
  }>;
  documents: DealDocumentAuthority[];
}>;

export type DocumentBasisItem = Readonly<{
  kind: DocumentBasisKind;
  status: DocumentBasisStatus;
  document: DealDocumentAuthority | null;
  blocker: string | null;
}>;

export type DocumentBasisProjection = Readonly<{
  dealId: string;
  tenantId: string;
  dealVersion: string;
  lotId: string | null;
  shipmentId: string;
  acceptanceId: string | null;
  laboratoryId: string | null;
  items: DocumentBasisItem[];
  blockers: string[];
  documentsReady: boolean;
  bankBasisReady: boolean;
}>;

const IDENTIFIER = /^[^\u0000-\u001F\u007F]{1,200}$/;
const AUTHORITATIVE_DOCUMENT_STATUSES = new Set(['SIGNED', 'VALIDATED', 'CONFIRMED']);
const AUTHORITATIVE_BANK_ACCEPTANCE = new Set(['ACCEPTED', 'CONFIRMED']);
const ACCEPTED_QUALITY_STATUSES = new Set(['ACCEPTED', 'PASSED', 'COMPLIANT', 'OK']);
const PRE_BANK_DOCUMENTS: readonly DocumentBasisKind[] = [
  'contract',
  'sdiz',
  'transport_waybill',
  'lab_protocol',
  'quality_certificate',
  'acceptance_act',
];
const ALL_DOCUMENTS: readonly DocumentBasisKind[] = [...PRE_BANK_DOCUMENTS, 'bank_basis'];

export async function getCanonicalDealDocumentWorkspace(
  dealIdInput: string,
): Promise<CanonicalDealDocumentWorkspace | null> {
  const dealId = identifier(dealIdInput);
  if (!dealId) return null;

  try {
    const response = await fetch(serverApiUrl(`/deals/${encodeURIComponent(dealId)}/workspace`), {
      cache: 'no-store',
      headers: serverAuthHeaders(),
    });
    if (!response.ok) return null;
    const workspace = parseWorkspace(await response.json());
    return workspace.deal.id === dealId ? workspace : null;
  } catch {
    return null;
  }
}

export function buildDocumentBasisProjection(
  workspace: CanonicalDealDocumentWorkspace,
  shipmentIdInput?: string,
): DocumentBasisProjection | null {
  const requestedShipmentId = shipmentIdInput ? identifier(shipmentIdInput) : null;
  if (shipmentIdInput && !requestedShipmentId) return null;

  const shipment = requestedShipmentId
    ? workspace.deal.shipments.find((item) => item.id === requestedShipmentId)
    : workspace.deal.shipments[0];
  if (!shipment) return null;

  const acceptance = workspace.deal.acceptanceRecords
    .find((item) => item.shipmentId === shipment.id) ?? null;
  const laboratory = workspace.deal.labSamples.find((sample) =>
    sample.shipmentId === shipment.id || (acceptance && sample.acceptanceId === acceptance.id),
  ) ?? null;
  const latest = latestDocumentByType(workspace.documents);
  const blockers: string[] = [];

  if (!acceptance) blockers.push('ACCEPTANCE_RECORD_NOT_PERSISTED');
  if (acceptance && (
    acceptance.status !== 'ACCEPTED'
    || !acceptance.actDocId
    || !acceptance.actSignedAt
  )) {
    blockers.push('ACCEPTANCE_ACT_NOT_SIGNED');
  }
  if (acceptance && !ACCEPTED_QUALITY_STATUSES.has(acceptance.qualityStatus.toUpperCase())) {
    blockers.push('QUALITY_STATUS_NOT_ACCEPTED');
  }
  if (!laboratory) blockers.push('LAB_RESULT_NOT_PERSISTED');
  if (laboratory && (
    laboratory.status !== 'DONE'
    || !laboratory.finalizedAt
    || !laboratory.certificateDocId
  )) {
    blockers.push('LAB_RESULT_NOT_FINAL');
  }
  if (laboratory && (
    laboratory.tests.length === 0
    || laboratory.tests.some((test) => !test.passed)
  )) {
    blockers.push('LAB_TESTS_NOT_ACCEPTED');
  }

  const items = ALL_DOCUMENTS.map((kind) => {
    const document = latest.get(kind) ?? null;
    const blocker = documentBlocker(kind, document, acceptance, laboratory);
    if (kind !== 'bank_basis' && blocker) blockers.push(blocker);
    return Object.freeze({
      kind,
      status: documentStatus(document, blocker),
      document,
      blocker,
    });
  });
  const bankBasis = items.find((item) => item.kind === 'bank_basis') ?? null;
  const documentsReady = blockers.length === 0
    && items
      .filter((item) => PRE_BANK_DOCUMENTS.includes(item.kind))
      .every((item) => item.status === 'ready');
  const bankBasisReady = Boolean(
    bankBasis?.status === 'ready'
      && bankBasis.document
      && AUTHORITATIVE_BANK_ACCEPTANCE.has(bankBasis.document.bankAcceptance.toUpperCase()),
  );

  return Object.freeze({
    dealId: workspace.deal.id,
    tenantId: workspace.deal.tenantId,
    dealVersion: workspace.deal.version,
    lotId: workspace.deal.sourceLotId ?? workspace.deal.lotId,
    shipmentId: shipment.id,
    acceptanceId: acceptance?.id ?? null,
    laboratoryId: laboratory?.id ?? null,
    items,
    blockers: [...new Set(blockers)],
    documentsReady,
    bankBasisReady,
  });
}

function documentBlocker(
  kind: DocumentBasisKind,
  document: DealDocumentAuthority | null,
  acceptance: DocumentAcceptance | null,
  laboratory: DocumentLabSample | null,
): string | null {
  const code = kind.toUpperCase();
  if (!document) return `DOCUMENT_${code}_MISSING`;
  if (!document.isImmutable || !document.hash || !document.sourceFileId) {
    return `DOCUMENT_${code}_NOT_IMMUTABLE`;
  }
  if (!AUTHORITATIVE_DOCUMENT_STATUSES.has(document.status.toUpperCase())) {
    return `DOCUMENT_${code}_NOT_AUTHORITATIVE`;
  }
  if (kind === 'acceptance_act' && acceptance?.actDocId !== document.id) {
    return 'ACCEPTANCE_ACT_DOCUMENT_MISMATCH';
  }
  if (kind === 'quality_certificate' && laboratory?.certificateDocId !== document.id) {
    return 'QUALITY_CERTIFICATE_DOCUMENT_MISMATCH';
  }
  return null;
}

function documentStatus(
  document: DealDocumentAuthority | null,
  blocker: string | null,
): DocumentBasisStatus {
  if (!document) return 'required';
  return blocker ? 'review' : 'ready';
}

function latestDocumentByType(
  documents: DealDocumentAuthority[],
): Map<DocumentBasisKind, DealDocumentAuthority> {
  const latest = new Map<DocumentBasisKind, DealDocumentAuthority>();
  for (const document of documents) {
    if (!isDocumentBasisKind(document.type)) continue;
    const current = latest.get(document.type);
    if (!current || compareDocumentVersion(document, current) > 0) {
      latest.set(document.type, document);
    }
  }
  return latest;
}

function compareDocumentVersion(
  left: DealDocumentAuthority,
  right: DealDocumentAuthority,
): number {
  if (left.version !== right.version) return left.version - right.version;
  const time = Date.parse(left.uploadedAt) - Date.parse(right.uploadedAt);
  return time !== 0 ? time : left.id.localeCompare(right.id);
}

function isDocumentBasisKind(value: string): value is DocumentBasisKind {
  return ALL_DOCUMENTS.includes(value as DocumentBasisKind);
}

function parseWorkspace(value: unknown): CanonicalDealDocumentWorkspace {
  const root = record(value, 'deal workspace');
  const deal = record(root.deal, 'deal');
  const viewer = record(root.viewer, 'viewer');
  const projections = record(root.projections, 'projections');
  const dealId = requiredIdentifier(deal.id, 'deal.id');
  const tenantId = requiredIdentifier(deal.tenantId, 'deal.tenantId');
  const shipments = array(deal.shipments, 'deal.shipments').map(parseShipment);
  const acceptanceRecords = array(deal.acceptanceRecords, 'deal.acceptanceRecords').map(parseAcceptance);
  const labSamples = array(deal.labSamples, 'deal.labSamples').map(parseLabSample);
  const documents = array(projections.documents, 'projections.documents').map(parseDocument);

  if (shipments.some((item) => item.dealId !== dealId || item.tenantId !== tenantId)) {
    throw new Error('shipment authority does not match Deal tenant');
  }
  if (acceptanceRecords.some((item) => item.dealId !== dealId)) {
    throw new Error('acceptance authority does not match Deal');
  }
  if (acceptanceRecords.some((item) => item.shipmentId && !shipments.some((shipment) => shipment.id === item.shipmentId))) {
    throw new Error('acceptance shipment is outside the Deal');
  }
  if (labSamples.some((item) => item.dealId !== dealId || item.tenantId !== tenantId)) {
    throw new Error('laboratory authority does not match Deal tenant');
  }
  if (labSamples.some((item) => item.shipmentId && !shipments.some((shipment) => shipment.id === item.shipmentId))) {
    throw new Error('laboratory shipment is outside the Deal');
  }
  if (documents.some((item) => item.dealId !== dealId || item.tenantId !== tenantId)) {
    throw new Error('document authority does not match Deal tenant');
  }

  return Object.freeze({
    deal: Object.freeze({
      id: dealId,
      tenantId,
      version: requiredText(deal.version, 'deal.version'),
      status: requiredText(deal.status, 'deal.status'),
      lotId: nullableIdentifier(deal.lotId, 'deal.lotId'),
      sourceLotId: nullableIdentifier(deal.sourceLotId, 'deal.sourceLotId'),
      shipments,
      acceptanceRecords,
      labSamples,
    }),
    viewer: Object.freeze({
      participantId: requiredIdentifier(viewer.participantId, 'viewer.participantId'),
      organizationId: requiredIdentifier(viewer.organizationId, 'viewer.organizationId'),
      role: requiredText(viewer.role, 'viewer.role'),
      accessLevel: requiredText(viewer.accessLevel, 'viewer.accessLevel'),
    }),
    documents,
  });
}

function parseShipment(value: unknown): DocumentShipment {
  const item = record(value, 'shipment');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'shipment.id'),
    dealId: requiredIdentifier(item.dealId, 'shipment.dealId'),
    tenantId: requiredIdentifier(item.tenantId, 'shipment.tenantId'),
    status: requiredText(item.status, 'shipment.status'),
  });
}

function parseAcceptance(value: unknown): DocumentAcceptance {
  const item = record(value, 'acceptance record');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'acceptance.id'),
    dealId: requiredIdentifier(item.dealId, 'acceptance.dealId'),
    shipmentId: nullableIdentifier(item.shipmentId, 'acceptance.shipmentId'),
    status: requiredText(item.status, 'acceptance.status'),
    qualityStatus: requiredText(item.qualityStatus, 'acceptance.qualityStatus'),
    actDocId: nullableIdentifier(item.actDocId, 'acceptance.actDocId'),
    actSignedAt: nullableDate(item.actSignedAt, 'acceptance.actSignedAt'),
  });
}

function parseLabSample(value: unknown): DocumentLabSample {
  const item = record(value, 'laboratory sample');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'laboratory.id'),
    dealId: requiredIdentifier(item.dealId, 'laboratory.dealId'),
    shipmentId: nullableIdentifier(item.shipmentId, 'laboratory.shipmentId'),
    acceptanceId: nullableIdentifier(item.acceptanceId, 'laboratory.acceptanceId'),
    tenantId: requiredIdentifier(item.tenantId, 'laboratory.tenantId'),
    status: requiredText(item.status, 'laboratory.status'),
    finalizedAt: nullableDate(item.finalizedAt, 'laboratory.finalizedAt'),
    certificateDocId: nullableIdentifier(item.certificateDocId, 'laboratory.certificateDocId'),
    tests: array(item.tests, 'laboratory.tests').map((testValue) => {
      const test = record(testValue, 'laboratory test');
      return Object.freeze({
        id: requiredIdentifier(test.id, 'laboratory.test.id'),
        passed: requiredBoolean(test.passed, 'laboratory.test.passed'),
      });
    }),
  });
}

function parseDocument(value: unknown): DealDocumentAuthority {
  const item = record(value, 'document');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'document.id'),
    dealId: requiredIdentifier(item.dealId, 'document.dealId'),
    tenantId: requiredIdentifier(item.tenantId, 'document.tenantId'),
    type: requiredText(item.type, 'document.type'),
    status: requiredText(item.status, 'document.status'),
    name: requiredText(item.name, 'document.name'),
    hash: nullableText(item.hash, 'document.hash'),
    signedAt: nullableDate(item.signedAt, 'document.signedAt'),
    bankRequired: requiredBoolean(item.bankRequired, 'document.bankRequired'),
    releaseRequired: requiredBoolean(item.releaseRequired, 'document.releaseRequired'),
    bankAcceptance: requiredText(item.bankAcceptance, 'document.bankAcceptance'),
    edoStatus: nullableText(item.edoStatus, 'document.edoStatus'),
    edoExternalId: nullableIdentifier(item.edoExternalId, 'document.edoExternalId'),
    version: requiredInteger(item.version, 'document.version'),
    isImmutable: requiredBoolean(item.isImmutable, 'document.isImmutable'),
    sourceFileId: nullableIdentifier(item.sourceFileId, 'document.sourceFileId'),
    signatureFileId: nullableIdentifier(item.signatureFileId, 'document.signatureFileId'),
    supersedesId: nullableIdentifier(item.supersedesId, 'document.supersedesId'),
    seriesId: nullableIdentifier(item.seriesId, 'document.seriesId'),
    uploadedAt: requiredDate(item.uploadedAt, 'document.uploadedAt'),
  });
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}

function identifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return IDENTIFIER.test(normalized) ? normalized : null;
}

function requiredIdentifier(value: unknown, field: string): string {
  const normalized = identifier(value);
  if (!normalized) throw new Error(`${field} must be a valid identifier`);
  return normalized;
}

function nullableIdentifier(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredIdentifier(value, field);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2_000) {
    throw new Error(`${field} must be non-empty text`);
  }
  return value.trim();
}

function nullableText(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredText(value, field);
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} must be boolean`);
  return value;
}

function requiredInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

function requiredDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO date`);
  }
  return value;
}

function nullableDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredDate(value, field);
}

import { serverApiUrl, serverAuthHeaders } from './server-api';

export type DealExecutionCheckpoint = Readonly<{
  id: string;
  shipmentId: string;
  tenantId: string;
  type: string;
  completedAt: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  photoUrl: string | null;
  actorId: string | null;
  createdAt: string;
}>;

export type DealExecutionShipment = Readonly<{
  id: string;
  dealId: string;
  tenantId: string;
  status: string;
  driverUserId: string | null;
  driverName: string | null;
  vehicleNumber: string | null;
  carrierOrgId: string | null;
  carrierName: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  pinVerified: boolean;
  version: string;
  nextAction: string | null;
  blockers: string[];
  checkpoints: DealExecutionCheckpoint[];
  createdAt: string;
  updatedAt: string;
}>;

export type DealAcceptanceRecord = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  status: string;
  weightActualTons: number | null;
  volumeActualTons: number | null;
  qualityStatus: string;
  gost: string | null;
  actDocId: string | null;
  actSignedAt: string | null;
  actorId: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type DealLabTest = Readonly<{
  id: string;
  sampleId: string;
  tenantId: string | null;
  parameter: string;
  value: number;
  unit: string | null;
  normMin: number | null;
  normMax: number | null;
  passed: boolean;
  result: string | null;
  recordedAt: string;
}>;

export type DealLabSample = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  acceptanceId: string | null;
  tenantId: string;
  status: string;
  custodyStatus: string;
  sampleCode: string | null;
  protocol: string | null;
  protocolResult: string | null;
  gost: string | null;
  labId: string | null;
  labName: string | null;
  finalizedAt: string | null;
  certificateDocId: string | null;
  version: string;
  tests: DealLabTest[];
  createdAt: string;
  updatedAt: string;
}>;

export type DealEvidenceFile = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  type: string;
  filename: string;
  hash: string;
  prevHash: string | null;
  uploadedAt: string;
}>;

export type CanonicalDealExecutionWorkspace = Readonly<{
  deal: Readonly<{
    id: string;
    tenantId: string;
    status: string;
    version: string;
    lotId: string | null;
    sourceLotId: string | null;
    sellerOrgId: string;
    buyerOrgId: string;
    volumeTons: number | null;
    volumeTonsDec: string | null;
    shipments: DealExecutionShipment[];
    acceptanceRecords: DealAcceptanceRecord[];
    labSamples: DealLabSample[];
    updatedAt: string;
  }>;
  viewer: Readonly<{
    participantId: string;
    organizationId: string;
    role: string;
    accessLevel: string;
  }>;
  evidence: DealEvidenceFile[];
}>;

export type AcceptanceWeightFact = Readonly<{
  grossTons: string;
  tareTons: string;
  netTons: string;
  weighingSource: string;
  occurredAt: string;
  evidenceRef: string;
  equipmentId: string;
}>;

export type AcceptanceProjection = Readonly<{
  dealId: string;
  tenantId: string;
  dealVersion: string;
  lotId: string | null;
  shipment: DealExecutionShipment;
  acceptance: DealAcceptanceRecord | null;
  arrival: DealExecutionCheckpoint | null;
  weight: AcceptanceWeightFact | null;
  laboratory: DealLabSample | null;
  evidence: DealEvidenceFile[];
  blockers: string[];
  ready: boolean;
}>;

const IDENTIFIER = /^[^\u0000-\u001F\u007F]{1,200}$/;
const DECIMAL_6 = /^\d+(?:\.\d{1,6})?$/;

export async function getCanonicalDealExecutionWorkspace(
  dealIdInput: string,
): Promise<CanonicalDealExecutionWorkspace | null> {
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

export function buildAcceptanceProjection(
  workspace: CanonicalDealExecutionWorkspace,
  shipmentIdInput?: string,
): AcceptanceProjection | null {
  const requestedShipmentId = shipmentIdInput ? identifier(shipmentIdInput) : null;
  if (shipmentIdInput && !requestedShipmentId) return null;

  const shipment = requestedShipmentId
    ? workspace.deal.shipments.find((item) => item.id === requestedShipmentId)
    : workspace.deal.shipments[0];
  if (!shipment) return null;

  const acceptance = workspace.deal.acceptanceRecords
    .find((item) => item.shipmentId === shipment.id) ?? null;
  const arrival = [...shipment.checkpoints]
    .reverse()
    .find((item) => item.type === 'ARRIVAL' && item.completedAt) ?? null;
  const weight = acceptance ? parseWeightFact(acceptance.notes, shipment.id) : null;
  const laboratory = workspace.deal.labSamples.find((sample) =>
    sample.shipmentId === shipment.id || (acceptance && sample.acceptanceId === acceptance.id),
  ) ?? null;
  const evidence = workspace.evidence.filter((item) =>
    item.shipmentId === null || item.shipmentId === shipment.id,
  );

  const blockers: string[] = [];
  if (!arrival) blockers.push('ARRIVAL_NOT_PERSISTED');
  if (!acceptance) blockers.push('ACCEPTANCE_RECORD_NOT_PERSISTED');
  if (!weight) blockers.push('WEIGHT_FACT_INVALID_OR_MISSING');
  if (!laboratory) blockers.push('LAB_RESULT_NOT_PERSISTED');
  if (laboratory && (laboratory.status !== 'DONE' || !laboratory.finalizedAt || !laboratory.certificateDocId)) {
    blockers.push('LAB_RESULT_NOT_FINAL');
  }
  if (laboratory && laboratory.tests.length === 0) blockers.push('LAB_TESTS_MISSING');
  if (laboratory?.tests.some((test) => !test.passed)) blockers.push('QUALITY_DEVIATION_REQUIRES_DECISION');
  if (!acceptance || acceptance.status !== 'ACCEPTED' || !acceptance.actSignedAt || !acceptance.actDocId) {
    blockers.push('ACCEPTANCE_ACT_NOT_SIGNED');
  }
  if (acceptance && !isAcceptedQualityStatus(acceptance.qualityStatus)) {
    blockers.push('QUALITY_STATUS_NOT_ACCEPTED');
  }

  return Object.freeze({
    dealId: workspace.deal.id,
    tenantId: workspace.deal.tenantId,
    dealVersion: workspace.deal.version,
    lotId: workspace.deal.sourceLotId ?? workspace.deal.lotId,
    shipment,
    acceptance,
    arrival,
    weight,
    laboratory,
    evidence,
    blockers: [...new Set(blockers)],
    ready: blockers.length === 0,
  });
}

function parseWorkspace(value: unknown): CanonicalDealExecutionWorkspace {
  const root = record(value, 'deal workspace');
  const deal = record(root.deal, 'deal');
  const viewer = record(root.viewer, 'viewer');
  const projections = record(root.projections, 'projections');
  const dealId = requiredIdentifier(deal.id, 'deal.id');
  const tenantId = requiredIdentifier(deal.tenantId, 'deal.tenantId');
  const shipments = array(deal.shipments, 'deal.shipments').map(parseShipment);
  const acceptanceRecords = array(deal.acceptanceRecords, 'deal.acceptanceRecords').map(parseAcceptance);
  const labSamples = array(deal.labSamples, 'deal.labSamples').map(parseLabSample);
  const evidence = array(projections.evidence, 'projections.evidence').map(parseEvidence);

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
  if (evidence.some((item) => item.dealId !== dealId)) {
    throw new Error('evidence authority does not match Deal');
  }

  return Object.freeze({
    deal: Object.freeze({
      id: dealId,
      tenantId,
      status: requiredText(deal.status, 'deal.status'),
      version: requiredText(deal.version, 'deal.version'),
      lotId: nullableIdentifier(deal.lotId, 'deal.lotId'),
      sourceLotId: nullableIdentifier(deal.sourceLotId, 'deal.sourceLotId'),
      sellerOrgId: requiredIdentifier(deal.sellerOrgId, 'deal.sellerOrgId'),
      buyerOrgId: requiredIdentifier(deal.buyerOrgId, 'deal.buyerOrgId'),
      volumeTons: nullableFiniteNumber(deal.volumeTons, 'deal.volumeTons'),
      volumeTonsDec: nullableDecimal(deal.volumeTonsDec, 'deal.volumeTonsDec'),
      shipments,
      acceptanceRecords,
      labSamples,
      updatedAt: requiredDate(deal.updatedAt, 'deal.updatedAt'),
    }),
    viewer: Object.freeze({
      participantId: requiredIdentifier(viewer.participantId, 'viewer.participantId'),
      organizationId: requiredIdentifier(viewer.organizationId, 'viewer.organizationId'),
      role: requiredText(viewer.role, 'viewer.role'),
      accessLevel: requiredText(viewer.accessLevel, 'viewer.accessLevel'),
    }),
    evidence,
  });
}

function parseShipment(value: unknown): DealExecutionShipment {
  const item = record(value, 'shipment');
  const shipmentId = requiredIdentifier(item.id, 'shipment.id');
  const tenantId = requiredIdentifier(item.tenantId, 'shipment.tenantId');
  const checkpoints = array(item.checkpoints, 'shipment.checkpoints').map(parseCheckpoint);
  if (checkpoints.some((checkpoint) => checkpoint.shipmentId !== shipmentId || checkpoint.tenantId !== tenantId)) {
    throw new Error('checkpoint authority does not match shipment tenant');
  }
  return Object.freeze({
    id: shipmentId,
    dealId: requiredIdentifier(item.dealId, 'shipment.dealId'),
    tenantId,
    status: requiredText(item.status, 'shipment.status'),
    driverUserId: nullableIdentifier(item.driverUserId, 'shipment.driverUserId'),
    driverName: nullableText(item.driverName, 'shipment.driverName'),
    vehicleNumber: nullableText(item.vehicleNumber, 'shipment.vehicleNumber'),
    carrierOrgId: nullableIdentifier(item.carrierOrgId, 'shipment.carrierOrgId'),
    carrierName: nullableText(item.carrierName, 'shipment.carrierName'),
    routeFrom: nullableText(item.routeFrom, 'shipment.routeFrom'),
    routeTo: nullableText(item.routeTo, 'shipment.routeTo'),
    pinVerified: requiredBoolean(item.pinVerified, 'shipment.pinVerified'),
    version: requiredText(item.version, 'shipment.version'),
    nextAction: nullableText(item.nextAction, 'shipment.nextAction'),
    blockers: parseBlockers(item.blockers),
    checkpoints,
    createdAt: requiredDate(item.createdAt, 'shipment.createdAt'),
    updatedAt: requiredDate(item.updatedAt, 'shipment.updatedAt'),
  });
}

function parseCheckpoint(value: unknown): DealExecutionCheckpoint {
  const item = record(value, 'checkpoint');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'checkpoint.id'),
    shipmentId: requiredIdentifier(item.shipmentId, 'checkpoint.shipmentId'),
    tenantId: requiredIdentifier(item.tenantId, 'checkpoint.tenantId'),
    type: requiredText(item.type, 'checkpoint.type'),
    completedAt: nullableDate(item.completedAt, 'checkpoint.completedAt'),
    lat: nullableFiniteNumber(item.lat, 'checkpoint.lat'),
    lng: nullableFiniteNumber(item.lng, 'checkpoint.lng'),
    note: nullableText(item.note, 'checkpoint.note'),
    photoUrl: nullableText(item.photoUrl, 'checkpoint.photoUrl'),
    actorId: nullableIdentifier(item.actorId, 'checkpoint.actorId'),
    createdAt: requiredDate(item.createdAt, 'checkpoint.createdAt'),
  });
}

function parseAcceptance(value: unknown): DealAcceptanceRecord {
  const item = record(value, 'acceptance record');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'acceptance.id'),
    dealId: requiredIdentifier(item.dealId, 'acceptance.dealId'),
    shipmentId: nullableIdentifier(item.shipmentId, 'acceptance.shipmentId'),
    status: requiredText(item.status, 'acceptance.status'),
    weightActualTons: nullableFiniteNumber(item.weightActualTons, 'acceptance.weightActualTons'),
    volumeActualTons: nullableFiniteNumber(item.volumeActualTons, 'acceptance.volumeActualTons'),
    qualityStatus: requiredText(item.qualityStatus, 'acceptance.qualityStatus'),
    gost: nullableText(item.gost, 'acceptance.gost'),
    actDocId: nullableIdentifier(item.actDocId, 'acceptance.actDocId'),
    actSignedAt: nullableDate(item.actSignedAt, 'acceptance.actSignedAt'),
    actorId: requiredIdentifier(item.actorId, 'acceptance.actorId'),
    notes: nullableText(item.notes, 'acceptance.notes'),
    createdAt: requiredDate(item.createdAt, 'acceptance.createdAt'),
    updatedAt: requiredDate(item.updatedAt, 'acceptance.updatedAt'),
  });
}

function parseLabSample(value: unknown): DealLabSample {
  const item = record(value, 'laboratory sample');
  const sampleId = requiredIdentifier(item.id, 'sample.id');
  const tenantId = requiredIdentifier(item.tenantId, 'sample.tenantId');
  const tests = array(item.tests, 'sample.tests').map(parseLabTest);
  if (tests.some((test) => test.sampleId !== sampleId || (test.tenantId && test.tenantId !== tenantId))) {
    throw new Error('laboratory test authority does not match sample tenant');
  }
  return Object.freeze({
    id: sampleId,
    dealId: requiredIdentifier(item.dealId, 'sample.dealId'),
    shipmentId: nullableIdentifier(item.shipmentId, 'sample.shipmentId'),
    acceptanceId: nullableIdentifier(item.acceptanceId, 'sample.acceptanceId'),
    tenantId,
    status: requiredText(item.status, 'sample.status'),
    custodyStatus: requiredText(item.custodyStatus, 'sample.custodyStatus'),
    sampleCode: nullableText(item.sampleCode, 'sample.sampleCode'),
    protocol: nullableText(item.protocol, 'sample.protocol'),
    protocolResult: nullableText(item.protocolResult, 'sample.protocolResult'),
    gost: nullableText(item.gost, 'sample.gost'),
    labId: nullableIdentifier(item.labId, 'sample.labId'),
    labName: nullableText(item.labName, 'sample.labName'),
    finalizedAt: nullableDate(item.finalizedAt, 'sample.finalizedAt'),
    certificateDocId: nullableIdentifier(item.certificateDocId, 'sample.certificateDocId'),
    version: requiredText(item.version, 'sample.version'),
    tests,
    createdAt: requiredDate(item.createdAt, 'sample.createdAt'),
    updatedAt: requiredDate(item.updatedAt, 'sample.updatedAt'),
  });
}

function parseLabTest(value: unknown): DealLabTest {
  const item = record(value, 'laboratory test');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'test.id'),
    sampleId: requiredIdentifier(item.sampleId, 'test.sampleId'),
    tenantId: nullableIdentifier(item.tenantId, 'test.tenantId'),
    parameter: requiredText(item.parameter, 'test.parameter'),
    value: requiredFiniteNumber(item.value, 'test.value'),
    unit: nullableText(item.unit, 'test.unit'),
    normMin: nullableFiniteNumber(item.normMin, 'test.normMin'),
    normMax: nullableFiniteNumber(item.normMax, 'test.normMax'),
    passed: requiredBoolean(item.passed, 'test.passed'),
    result: nullableText(item.result, 'test.result'),
    recordedAt: requiredDate(item.recordedAt, 'test.recordedAt'),
  });
}

function parseEvidence(value: unknown): DealEvidenceFile {
  const item = record(value, 'evidence file');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'evidence.id'),
    dealId: requiredIdentifier(item.dealId, 'evidence.dealId'),
    shipmentId: nullableIdentifier(item.shipmentId, 'evidence.shipmentId'),
    type: requiredText(item.type, 'evidence.type'),
    filename: requiredText(item.filename, 'evidence.filename'),
    hash: requiredText(item.hash, 'evidence.hash'),
    prevHash: nullableText(item.prevHash, 'evidence.prevHash'),
    uploadedAt: requiredDate(item.uploadedAt, 'evidence.uploadedAt'),
  });
}

function parseWeightFact(notes: string | null, shipmentId: string): AcceptanceWeightFact | null {
  if (!notes) return null;
  try {
    const payload = record(JSON.parse(notes), 'weight payload');
    if (requiredIdentifier(payload.shipmentId, 'weight.shipmentId') !== shipmentId) return null;
    const grossTons = requiredDecimal(payload.grossTons, 'weight.grossTons');
    const tareTons = requiredDecimal(payload.tareTons, 'weight.tareTons');
    const netTons = requiredDecimal(payload.netTons, 'weight.netTons');
    if (decimalMicro(grossTons) - decimalMicro(tareTons) !== decimalMicro(netTons)) return null;
    return Object.freeze({
      grossTons,
      tareTons,
      netTons,
      weighingSource: requiredText(payload.weighingSource, 'weight.weighingSource'),
      occurredAt: requiredDate(payload.occurredAt, 'weight.occurredAt'),
      evidenceRef: requiredIdentifier(payload.evidenceRef, 'weight.evidenceRef'),
      equipmentId: requiredIdentifier(payload.equipmentId, 'weight.equipmentId'),
    });
  } catch {
    return null;
  }
}

function isAcceptedQualityStatus(value: string): boolean {
  return ['PASSED', 'ACCEPTED', 'COMPLIANT', 'OK'].includes(value.toUpperCase());
}

function parseBlockers(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) return value.map((item, index) => requiredText(item, `shipment.blockers[${index}]`));
  if (typeof value !== 'string') throw new Error('shipment.blockers must be a string or array');
  const normalized = value.trim();
  if (!normalized) return [];
  try {
    const parsed: unknown = JSON.parse(normalized);
    if (Array.isArray(parsed)) return parsed.map((item, index) => requiredText(item, `shipment.blockers[${index}]`));
  } catch {
    // Existing rows may persist a single blocker as plain text.
  }
  return [normalized];
}

function decimalMicro(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
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
  if (!normalized) throw new Error(`${field} is invalid`);
  return normalized;
}

function nullableIdentifier(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredIdentifier(value, field);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new Error(`${field} is invalid`);
  }
  const normalized = String(value).trim();
  if (!normalized || /[\u0000-\u001F\u007F]/.test(normalized)) throw new Error(`${field} is invalid`);
  return normalized;
}

function nullableText(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredText(value, field);
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} is invalid`);
  return value;
}

function requiredFiniteNumber(value: unknown, field: string): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) throw new Error(`${field} is invalid`);
  return number;
}

function nullableFiniteNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredFiniteNumber(value, field);
}

function requiredDecimal(value: unknown, field: string): string {
  const normalized = requiredText(value, field);
  if (!DECIMAL_6.test(normalized) || decimalMicro(normalized) <= 0n) throw new Error(`${field} is invalid`);
  return normalized;
}

function nullableDecimal(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredDecimal(value, field);
}

function requiredDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) throw new Error(`${field} is invalid`);
  return value;
}

function nullableDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredDate(value, field);
}

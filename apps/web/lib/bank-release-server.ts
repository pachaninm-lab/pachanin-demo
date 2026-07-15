import { serverApiUrl, serverAuthHeaders } from './server-api';
import { REQUIRED_RELEASE_DOCUMENT_TYPES } from './deal-execution-server';

export type BankReleaseState =
  | 'blocked'
  | 'ready_to_request'
  | 'awaiting_bank'
  | 'released'
  | 'manual_review';

type ReleaseDocumentType = typeof REQUIRED_RELEASE_DOCUMENT_TYPES[number];

type ReleaseDocument = Readonly<{
  id: string;
  dealId: string;
  tenantId: string;
  type: string;
  status: string;
  s3Key: string | null;
  hash: string | null;
  signedAt: string | null;
  signatories: string | null;
  bankRequired: boolean;
  bankAcceptance: string;
  version: number;
  isImmutable: boolean;
  uploadedAt: string;
}>;

type ReleaseCheckpoint = Readonly<{
  id: string;
  shipmentId: string;
  tenantId: string;
  type: string;
  completedAt: string | null;
}>;

type ReleaseShipment = Readonly<{
  id: string;
  dealId: string;
  tenantId: string;
  status: string;
  checkpoints: ReleaseCheckpoint[];
}>;

type ReleaseAcceptance = Readonly<{
  id: string;
  dealId: string;
  shipmentId: string | null;
  status: string;
  qualityStatus: string;
  actDocId: string | null;
  actSignedAt: string | null;
}>;

type ReleaseLabSample = Readonly<{
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

type ReleasePayment = Readonly<{
  id: string;
  dealId: string;
  status: string;
  amountKopecks: string | null;
  reservedAt: string | null;
  releasedAt: string | null;
  holdAmountKopecks: string | null;
  refundedKopecks: string | null;
  commissionKopecks: string | null;
  version: string;
  callbackState: string;
  bankRef: string | null;
  createdAt: string;
  updatedAt: string;
}>;

type ReleaseBankOperation = Readonly<{
  id: string;
  dealId: string;
  type: string;
  status: string;
  amountKopecks: string;
  currency: string;
  bankRef: string | null;
  confirmedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}>;

type ReleaseDispute = Readonly<{
  id: string;
  dealId: string;
  status: string;
  claimAmountKopecks: string | null;
  moneyHold: Readonly<{
    amountKopecks: string | null;
    releasedAt: string | null;
  }> | null;
}>;

type ReleaseOutboxEntry = Readonly<{
  id: string;
  type: string;
  dealId: string;
  status: string;
  idempotencyKey: string | null;
  correlationId: string | null;
  auditId: string | null;
  retryCount: number;
  lastError: string | null;
  deadLetterAt: string | null;
  createdAt: string;
  sentAt: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
}>;

export type CanonicalBankReleaseWorkspace = Readonly<{
  deal: Readonly<{
    id: string;
    tenantId: string;
    status: string;
    version: string;
    totalKopecks: string;
    currency: string;
    shipments: ReleaseShipment[];
    acceptanceRecords: ReleaseAcceptance[];
    labSamples: ReleaseLabSample[];
    documents: ReleaseDocument[];
    payments: ReleasePayment[];
    bankOperations: ReleaseBankOperation[];
    updatedAt: string;
  }>;
  viewer: Readonly<{
    participantId: string;
    organizationId: string;
    role: string;
    accessLevel: string;
  }>;
  disputes: ReleaseDispute[];
  outbox: ReleaseOutboxEntry[];
}>;

export type ReleaseDocumentReadiness = Readonly<{
  type: ReleaseDocumentType;
  ready: boolean;
  documentId: string | null;
  blockers: string[];
}>;

export type BankReleaseProjection = Readonly<{
  dealId: string;
  tenantId: string;
  dealVersion: string;
  dealStatus: string;
  shipmentId: string;
  amountKopecks: string;
  currency: string;
  viewerRole: string;
  viewerCanRequest: boolean;
  state: BankReleaseState;
  documents: ReleaseDocumentReadiness[];
  documentsReady: boolean;
  acceptanceReady: boolean;
  reserveConfirmed: boolean;
  releaseRequested: boolean;
  releaseConfirmed: boolean;
  activeDisputeCount: number;
  activeHoldKopecks: string;
  payment: ReleasePayment | null;
  reserveOperation: ReleaseBankOperation | null;
  releaseOperation: ReleaseBankOperation | null;
  releaseOutbox: ReleaseOutboxEntry | null;
  blockers: string[];
  warnings: string[];
}>;

const IDENTIFIER = /^[^\u0000-\u001F\u007F]{1,200}$/;
const NON_NEGATIVE_INTEGER = /^(?:0|[1-9]\d*)$/;
const OPEN_DISPUTE_STATUSES = new Set(['OPEN', 'UNDER_REVIEW', 'EVIDENCE_COLLECTION', 'ESCALATED', 'ARBITRATION']);
const ACCEPTED_QUALITY_STATUSES = new Set(['PASSED', 'ACCEPTED', 'COMPLIANT', 'OK']);
const MONEY_REQUEST_ROLES = new Set(['ACCOUNTING', 'ADMIN']);
const OUTBOX_FAILURE_STATUSES = new Set(['FAILED', 'DEAD_LETTER', 'MANUAL_REVIEW']);
const OPERATION_FAILURE_STATUSES = new Set(['FAILED', 'REJECTED', 'CONFLICT', 'MANUAL_REVIEW']);
const CALLBACK_FAILURE_STATES = new Set(['FAILED', 'ERROR', 'CONFLICT', 'MANUAL_REVIEW']);

export async function getCanonicalBankReleaseWorkspace(
  dealIdInput: string,
): Promise<CanonicalBankReleaseWorkspace | null> {
  const dealId = identifier(dealIdInput);
  if (!dealId) return null;

  try {
    const response = await fetch(serverApiUrl(`/deals/${encodeURIComponent(dealId)}/workspace`), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
    });
    if (!response.ok) return null;
    const workspace = parseWorkspace(await response.json());
    return workspace.deal.id === dealId ? workspace : null;
  } catch {
    return null;
  }
}

export function buildBankReleaseProjection(
  workspace: CanonicalBankReleaseWorkspace,
  shipmentIdInput?: string,
): BankReleaseProjection | null {
  const requestedShipmentId = shipmentIdInput ? identifier(shipmentIdInput) : null;
  if (shipmentIdInput && !requestedShipmentId) return null;

  const shipment = requestedShipmentId
    ? workspace.deal.shipments.find((item) => item.id === requestedShipmentId)
    : workspace.deal.shipments[0];
  if (!shipment) return null;

  const amountKopecks = positiveInteger(workspace.deal.totalKopecks);
  if (!amountKopecks) return null;

  const payment = workspace.deal.payments[0] ?? null;
  const reserveOperation = latestOperation(workspace.deal.bankOperations, 'RESERVE');
  const releaseOperation = latestOperation(workspace.deal.bankOperations, 'RELEASE');
  const releaseOutbox = latestOutbox(workspace.outbox, 'BANK_RELEASE_REQUEST');
  const acceptance = workspace.deal.acceptanceRecords.find((item) => item.shipmentId === shipment.id) ?? null;
  const laboratory = workspace.deal.labSamples.find((item) =>
    item.shipmentId === shipment.id || (acceptance && item.acceptanceId === acceptance.id),
  ) ?? null;
  const documents = REQUIRED_RELEASE_DOCUMENT_TYPES.map((type) =>
    evaluateDocument(type, workspace.deal.documents),
  );
  const documentsReady = documents.every((item) => item.ready);
  const acceptanceReady = Boolean(
    shipment.checkpoints.some((item) => item.type === 'ARRIVAL' && item.completedAt)
      && acceptance
      && acceptance.status === 'ACCEPTED'
      && acceptance.actDocId
      && acceptance.actSignedAt
      && ACCEPTED_QUALITY_STATUSES.has(acceptance.qualityStatus.toUpperCase())
      && laboratory
      && laboratory.status === 'DONE'
      && laboratory.finalizedAt
      && laboratory.certificateDocId
      && laboratory.tests.length > 0
      && laboratory.tests.every((test) => test.passed),
  );
  const openDisputes = workspace.disputes.filter((item) => OPEN_DISPUTE_STATUSES.has(item.status.toUpperCase()));
  const activeHoldKopecks = openDisputes.reduce((total, dispute) => {
    if (!dispute.moneyHold || dispute.moneyHold.releasedAt) return total;
    return total + BigInt(dispute.moneyHold.amountKopecks ?? '0');
  }, 0n);
  const reserveConfirmed = Boolean(
    payment
      && payment.amountKopecks === amountKopecks
      && payment.reservedAt
      && ['RESERVED', 'RELEASE_REQUESTED', 'RELEASED'].includes(payment.status)
      && reserveOperation
      && reserveOperation.amountKopecks === amountKopecks
      && reserveOperation.status === 'DONE'
      && reserveOperation.confirmedAt
      && reserveOperation.bankRef,
  );
  const releaseRequested = Boolean(
    releaseOperation
      && releaseOperation.amountKopecks === amountKopecks
      && ['PENDING', 'SENT', 'DONE'].includes(releaseOperation.status)
      && releaseOutbox
      && ['PENDING', 'SENT', 'CONFIRMED'].includes(releaseOutbox.status),
  );
  const releaseConfirmed = Boolean(
    payment
      && payment.amountKopecks === amountKopecks
      && payment.status === 'RELEASED'
      && payment.releasedAt
      && payment.callbackState === 'CONFIRMED'
      && payment.bankRef
      && releaseOperation
      && releaseOperation.amountKopecks === amountKopecks
      && releaseOperation.status === 'DONE'
      && releaseOperation.confirmedAt
      && releaseOperation.bankRef === payment.bankRef
      && releaseOutbox?.status === 'CONFIRMED'
      && ['RELEASED', 'CLOSED'].includes(workspace.deal.status),
  );

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!acceptanceReady) blockers.push('ACCEPTANCE_NOT_READY');
  blockers.push(...documents.flatMap((item) => item.blockers));
  if (!payment) blockers.push('PAYMENT_NOT_PERSISTED');
  if (payment && payment.amountKopecks !== amountKopecks) blockers.push('PAYMENT_AMOUNT_MISMATCH');
  if (!reserveConfirmed) blockers.push('RESERVE_NOT_CONFIRMED');
  if (openDisputes.length > 0) blockers.push('OPEN_DISPUTE');
  if (activeHoldKopecks > 0n) blockers.push('ACTIVE_MONEY_HOLD');
  if (payment && CALLBACK_FAILURE_STATES.has(payment.callbackState.toUpperCase())) {
    blockers.push('PAYMENT_CALLBACK_REQUIRES_MANUAL_REVIEW');
  }
  if (releaseOperation && OPERATION_FAILURE_STATUSES.has(releaseOperation.status.toUpperCase())) {
    blockers.push('RELEASE_OPERATION_REQUIRES_MANUAL_REVIEW');
  }
  if (releaseOutbox && (
    OUTBOX_FAILURE_STATUSES.has(releaseOutbox.status.toUpperCase())
      || releaseOutbox.deadLetterAt
      || releaseOutbox.failedAt
  )) {
    blockers.push('RELEASE_OUTBOX_REQUIRES_MANUAL_REVIEW');
  }

  const prerequisitesReady = blockers.length === 0;
  let state: BankReleaseState = 'blocked';
  if (releaseConfirmed) {
    state = 'released';
  } else if (blockers.some((item) => item.includes('MANUAL_REVIEW'))) {
    state = 'manual_review';
  } else if (workspace.deal.status === 'RELEASE_REQUESTED' && releaseRequested && prerequisitesReady) {
    state = 'awaiting_bank';
  } else if (workspace.deal.status === 'DOCUMENTS_COMPLETE' && prerequisitesReady) {
    state = 'ready_to_request';
  } else if (['RELEASED', 'CLOSED'].includes(workspace.deal.status)) {
    state = 'manual_review';
    blockers.push('RELEASE_STATE_CONTRADICTION');
  } else if (workspace.deal.status === 'RELEASE_REQUESTED' && !releaseRequested) {
    state = 'manual_review';
    blockers.push('RELEASE_REQUEST_NOT_PERSISTED');
  } else if (!['DOCUMENTS_COMPLETE', 'RELEASE_REQUESTED', 'RELEASED', 'CLOSED'].includes(workspace.deal.status)) {
    blockers.push('DEAL_NOT_AT_RELEASE_STAGE');
  }

  if (state === 'released') {
    warnings.push('RECONCILIATION_RESULT_NOT_EXPOSED_IN_DEAL_WORKSPACE');
  }
  if (!MONEY_REQUEST_ROLES.has(workspace.viewer.role)) {
    warnings.push('VIEWER_CANNOT_REQUEST_RELEASE');
  }

  return Object.freeze({
    dealId: workspace.deal.id,
    tenantId: workspace.deal.tenantId,
    dealVersion: workspace.deal.version,
    dealStatus: workspace.deal.status,
    shipmentId: shipment.id,
    amountKopecks,
    currency: workspace.deal.currency,
    viewerRole: workspace.viewer.role,
    viewerCanRequest: MONEY_REQUEST_ROLES.has(workspace.viewer.role),
    state,
    documents,
    documentsReady,
    acceptanceReady,
    reserveConfirmed,
    releaseRequested,
    releaseConfirmed,
    activeDisputeCount: openDisputes.length,
    activeHoldKopecks: activeHoldKopecks.toString(),
    payment,
    reserveOperation,
    releaseOperation,
    releaseOutbox,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
  });
}

function evaluateDocument(
  type: ReleaseDocumentType,
  allDocuments: readonly ReleaseDocument[],
): ReleaseDocumentReadiness {
  const candidates = allDocuments
    .filter((document) => document.type === type)
    .sort((left, right) => right.version - left.version || right.uploadedAt.localeCompare(left.uploadedAt));
  const latestVersion = candidates[0]?.version ?? null;
  const latest = latestVersion === null
    ? []
    : candidates.filter((document) => document.version === latestVersion);
  const document = latest[0] ?? null;
  const blockers: string[] = [];

  if (!document) return Object.freeze({ type, ready: false, documentId: null, blockers: [`DOCUMENT:${type}:MISSING`] });
  if (latest.length !== 1) blockers.push(`DOCUMENT:${type}:DUPLICATE_LATEST_VERSION`);
  if (document.status !== 'SIGNED') blockers.push(`DOCUMENT:${type}:STATUS_NOT_SIGNED`);
  if (!document.hash) blockers.push(`DOCUMENT:${type}:HASH_MISSING`);
  if (!document.s3Key) blockers.push(`DOCUMENT:${type}:STORAGE_MISSING`);
  if (!document.isImmutable) blockers.push(`DOCUMENT:${type}:NOT_IMMUTABLE`);
  if (!document.signedAt) blockers.push(`DOCUMENT:${type}:SIGNED_AT_MISSING`);
  if (!validSignatories(document.signatories)) blockers.push(`DOCUMENT:${type}:SIGNATORIES_INVALID`);
  if (document.bankRequired && document.bankAcceptance !== 'ACCEPTED') {
    blockers.push(`DOCUMENT:${type}:BANK_NOT_ACCEPTED`);
  }
  return Object.freeze({ type, ready: blockers.length === 0, documentId: document.id, blockers });
}

function parseWorkspace(value: unknown): CanonicalBankReleaseWorkspace {
  const root = record(value, 'Deal workspace');
  const deal = record(root.deal, 'deal');
  const viewer = record(root.viewer, 'viewer');
  const projections = record(root.projections, 'projections');
  const dealId = requiredIdentifier(deal.id, 'deal.id');
  const tenantId = requiredIdentifier(deal.tenantId, 'deal.tenantId');
  const shipments = array(deal.shipments, 'deal.shipments').map(parseShipment);
  const acceptanceRecords = array(deal.acceptanceRecords, 'deal.acceptanceRecords').map(parseAcceptance);
  const labSamples = array(deal.labSamples, 'deal.labSamples').map(parseLabSample);
  const documents = array(deal.documents, 'deal.documents').map(parseDocument);
  const payments = array(deal.payments, 'deal.payments').map(parsePayment);
  const bankOperations = array(deal.bankOperations, 'deal.bankOperations').map(parseBankOperation);
  const disputes = array(projections.disputes, 'projections.disputes').map(parseDispute);
  const outbox = array(root.outbox, 'outbox').map(parseOutbox);

  assertDealTenant(shipments, dealId, tenantId, 'shipment');
  if (acceptanceRecords.some((item) => item.dealId !== dealId)) throw new Error('acceptance authority does not match Deal');
  assertDealTenant(labSamples, dealId, tenantId, 'laboratory');
  assertDealTenant(documents, dealId, tenantId, 'document');
  if (payments.some((item) => item.dealId !== dealId)) throw new Error('payment authority does not match Deal');
  if (bankOperations.some((item) => item.dealId !== dealId)) throw new Error('bank operation authority does not match Deal');
  if (disputes.some((item) => item.dealId !== dealId)) throw new Error('dispute authority does not match Deal');
  if (outbox.some((item) => item.dealId !== dealId)) throw new Error('outbox authority does not match Deal');

  const projectedDocumentIds = array(projections.documents, 'projections.documents').map((item, index) =>
    requiredIdentifier(record(item, `projections.documents[${index}]`).id, `projections.documents[${index}].id`),
  ).sort();
  const projectedPaymentIds = array(projections.payments, 'projections.payments').map((item, index) =>
    requiredIdentifier(record(item, `projections.payments[${index}]`).id, `projections.payments[${index}].id`),
  ).sort();
  assertSameIds(documents.map((item) => item.id), projectedDocumentIds, 'document');
  assertSameIds(payments.map((item) => item.id), projectedPaymentIds, 'payment');

  return Object.freeze({
    deal: Object.freeze({
      id: dealId,
      tenantId,
      status: requiredText(deal.status, 'deal.status'),
      version: requiredIntegerString(deal.version, 'deal.version'),
      totalKopecks: requiredIntegerString(deal.totalKopecks, 'deal.totalKopecks'),
      currency: requiredText(deal.currency, 'deal.currency').toUpperCase(),
      shipments,
      acceptanceRecords,
      labSamples,
      documents,
      payments,
      bankOperations,
      updatedAt: requiredDate(deal.updatedAt, 'deal.updatedAt'),
    }),
    viewer: Object.freeze({
      participantId: requiredIdentifier(viewer.participantId, 'viewer.participantId'),
      organizationId: requiredIdentifier(viewer.organizationId, 'viewer.organizationId'),
      role: requiredText(viewer.role, 'viewer.role'),
      accessLevel: requiredText(viewer.accessLevel, 'viewer.accessLevel'),
    }),
    disputes,
    outbox,
  });
}

function parseShipment(value: unknown): ReleaseShipment {
  const item = record(value, 'shipment');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'shipment.id'),
    dealId: requiredIdentifier(item.dealId, 'shipment.dealId'),
    tenantId: requiredIdentifier(item.tenantId, 'shipment.tenantId'),
    status: requiredText(item.status, 'shipment.status'),
    checkpoints: array(item.checkpoints, 'shipment.checkpoints').map(parseCheckpoint),
  });
}

function parseCheckpoint(value: unknown): ReleaseCheckpoint {
  const item = record(value, 'checkpoint');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'checkpoint.id'),
    shipmentId: requiredIdentifier(item.shipmentId, 'checkpoint.shipmentId'),
    tenantId: requiredIdentifier(item.tenantId, 'checkpoint.tenantId'),
    type: requiredText(item.type, 'checkpoint.type'),
    completedAt: nullableDate(item.completedAt, 'checkpoint.completedAt'),
  });
}

function parseAcceptance(value: unknown): ReleaseAcceptance {
  const item = record(value, 'acceptance');
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

function parseLabSample(value: unknown): ReleaseLabSample {
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
      return Object.freeze({ id: requiredIdentifier(test.id, 'laboratory.test.id'), passed: requiredBoolean(test.passed, 'laboratory.test.passed') });
    }),
  });
}

function parseDocument(value: unknown): ReleaseDocument {
  const item = record(value, 'document');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'document.id'),
    dealId: requiredIdentifier(item.dealId, 'document.dealId'),
    tenantId: requiredIdentifier(item.tenantId, 'document.tenantId'),
    type: requiredText(item.type, 'document.type'),
    status: requiredText(item.status, 'document.status'),
    s3Key: nullableText(item.s3Key, 'document.s3Key'),
    hash: nullableText(item.hash, 'document.hash'),
    signedAt: nullableDate(item.signedAt, 'document.signedAt'),
    signatories: nullableText(item.signatories, 'document.signatories'),
    bankRequired: requiredBoolean(item.bankRequired, 'document.bankRequired'),
    bankAcceptance: requiredText(item.bankAcceptance, 'document.bankAcceptance'),
    version: requiredPositiveInteger(item.version, 'document.version'),
    isImmutable: requiredBoolean(item.isImmutable, 'document.isImmutable'),
    uploadedAt: requiredDate(item.uploadedAt, 'document.uploadedAt'),
  });
}

function parsePayment(value: unknown): ReleasePayment {
  const item = record(value, 'payment');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'payment.id'),
    dealId: requiredIdentifier(item.dealId, 'payment.dealId'),
    status: requiredText(item.status, 'payment.status'),
    amountKopecks: nullableIntegerString(item.amountKopecks, 'payment.amountKopecks'),
    reservedAt: nullableDate(item.reservedAt, 'payment.reservedAt'),
    releasedAt: nullableDate(item.releasedAt, 'payment.releasedAt'),
    holdAmountKopecks: nullableIntegerString(item.holdAmountKopecks, 'payment.holdAmountKopecks'),
    refundedKopecks: nullableIntegerString(item.refundedKopecks, 'payment.refundedKopecks'),
    commissionKopecks: nullableIntegerString(item.commissionKopecks, 'payment.commissionKopecks'),
    version: requiredIntegerString(item.version, 'payment.version'),
    callbackState: requiredText(item.callbackState, 'payment.callbackState'),
    bankRef: nullableText(item.bankRef, 'payment.bankRef'),
    createdAt: requiredDate(item.createdAt, 'payment.createdAt'),
    updatedAt: requiredDate(item.updatedAt, 'payment.updatedAt'),
  });
}

function parseBankOperation(value: unknown): ReleaseBankOperation {
  const item = record(value, 'bank operation');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'bankOperation.id'),
    dealId: requiredIdentifier(item.dealId, 'bankOperation.dealId'),
    type: requiredText(item.type, 'bankOperation.type'),
    status: requiredText(item.status, 'bankOperation.status'),
    amountKopecks: requiredIntegerString(item.amountKopecks, 'bankOperation.amountKopecks'),
    currency: requiredText(item.currency, 'bankOperation.currency').toUpperCase(),
    bankRef: nullableText(item.bankRef, 'bankOperation.bankRef'),
    confirmedAt: nullableDate(item.confirmedAt, 'bankOperation.confirmedAt'),
    failureReason: nullableText(item.failureReason, 'bankOperation.failureReason'),
    createdAt: requiredDate(item.createdAt, 'bankOperation.createdAt'),
    updatedAt: requiredDate(item.updatedAt, 'bankOperation.updatedAt'),
  });
}

function parseDispute(value: unknown): ReleaseDispute {
  const item = record(value, 'dispute');
  const hold = item.moneyHold === null || item.moneyHold === undefined ? null : record(item.moneyHold, 'dispute.moneyHold');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'dispute.id'),
    dealId: requiredIdentifier(item.dealId, 'dispute.dealId'),
    status: requiredText(item.status, 'dispute.status'),
    claimAmountKopecks: nullableIntegerString(item.claimAmountKopecks, 'dispute.claimAmountKopecks'),
    moneyHold: hold ? Object.freeze({
      amountKopecks: nullableIntegerString(hold.amountKopecks, 'dispute.moneyHold.amountKopecks'),
      releasedAt: nullableDate(hold.releasedAt, 'dispute.moneyHold.releasedAt'),
    }) : null,
  });
}

function parseOutbox(value: unknown): ReleaseOutboxEntry {
  const item = record(value, 'outbox entry');
  return Object.freeze({
    id: requiredIdentifier(item.id, 'outbox.id'),
    type: requiredText(item.type, 'outbox.type'),
    dealId: requiredIdentifier(item.dealId, 'outbox.dealId'),
    status: requiredText(item.status, 'outbox.status'),
    idempotencyKey: nullableText(item.idempotencyKey, 'outbox.idempotencyKey'),
    correlationId: nullableIdentifier(item.correlationId, 'outbox.correlationId'),
    auditId: nullableIdentifier(item.auditId, 'outbox.auditId'),
    retryCount: requiredNonNegativeInteger(item.retryCount, 'outbox.retryCount'),
    lastError: nullableText(item.lastError, 'outbox.lastError'),
    deadLetterAt: nullableDate(item.deadLetterAt, 'outbox.deadLetterAt'),
    createdAt: requiredDate(item.createdAt, 'outbox.createdAt'),
    sentAt: nullableDate(item.sentAt, 'outbox.sentAt'),
    confirmedAt: nullableDate(item.confirmedAt, 'outbox.confirmedAt'),
    failedAt: nullableDate(item.failedAt, 'outbox.failedAt'),
  });
}

function latestOperation(operations: readonly ReleaseBankOperation[], type: string): ReleaseBankOperation | null {
  return [...operations]
    .filter((item) => item.type === type)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))[0] ?? null;
}

function latestOutbox(entries: readonly ReleaseOutboxEntry[], type: string): ReleaseOutboxEntry | null {
  return [...entries]
    .filter((item) => item.type === type)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))[0] ?? null;
}

function validSignatories(value: string | null): boolean {
  if (!value) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0 && parsed.every((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
      const signatory = entry as Record<string, unknown>;
      return Boolean(identifier(signatory.userId) && typeof signatory.signedAt === 'string' && !Number.isNaN(Date.parse(signatory.signedAt)));
    });
  } catch {
    return false;
  }
}

function assertDealTenant<T extends { dealId: string; tenantId: string }>(
  items: readonly T[],
  dealId: string,
  tenantId: string,
  label: string,
): void {
  if (items.some((item) => item.dealId !== dealId || item.tenantId !== tenantId)) {
    throw new Error(`${label} authority does not match Deal tenant`);
  }
}

function assertSameIds(actual: string[], expected: string[], label: string): void {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (left.length !== right.length || left.some((id, index) => id !== right[index])) {
    throw new Error(`${label} projections contradict the canonical Deal envelope`);
  }
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
  if (!normalized) throw new Error(`${field} must be a valid identifier`);
  return normalized;
}

function nullableIdentifier(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredIdentifier(value, field);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 4_000) throw new Error(`${field} must be non-empty text`);
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

function requiredDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be an ISO date`);
  return value;
}

function nullableDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredDate(value, field);
}

function requiredIntegerString(value: unknown, field: string): string {
  const normalized = typeof value === 'bigint' ? value.toString() : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!NON_NEGATIVE_INTEGER.test(normalized)) throw new Error(`${field} must be a non-negative integer string`);
  return normalized;
}

function nullableIntegerString(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredIntegerString(value, field);
}

function positiveInteger(value: string): string | null {
  return NON_NEGATIVE_INTEGER.test(value) && BigInt(value) > 0n ? value : null;
}

function requiredPositiveInteger(value: unknown, field: string): number {
  const normalized = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(normalized) || normalized < 1) throw new Error(`${field} must be a positive integer`);
  return normalized;
}

function requiredNonNegativeInteger(value: unknown, field: string): number {
  const normalized = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(normalized) || normalized < 0) throw new Error(`${field} must be a non-negative integer`);
  return normalized;
}

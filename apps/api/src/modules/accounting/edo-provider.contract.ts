export const EdoRoute = {
  ONE_C_EDO: 'ONE_C_EDO',
  DIRECT_DIADOC: 'DIRECT_DIADOC',
  DIRECT_SABY: 'DIRECT_SABY',
  OTHER_ADAPTER: 'OTHER_ADAPTER',
  MANUAL: 'MANUAL',
} as const;
export type EdoRoute = (typeof EdoRoute)[keyof typeof EdoRoute];

export const EDO_ROUTES = Object.freeze(Object.values(EdoRoute));

export const EdoDocumentState = {
  DRAFT: 'DRAFT',
  READY_TO_SIGN: 'READY_TO_SIGN',
  SIGNED: 'SIGNED',
  SUBMITTED: 'SUBMITTED',
  DELIVERED: 'DELIVERED',
  COUNTERPARTY_ACTION_REQUIRED: 'COUNTERPARTY_ACTION_REQUIRED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CORRECTION_REQUIRED: 'CORRECTION_REQUIRED',
  ANNULMENT_PENDING: 'ANNULMENT_PENDING',
  ANNULLED: 'ANNULLED',
  ERROR: 'ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;
export type EdoDocumentState =
  (typeof EdoDocumentState)[keyof typeof EdoDocumentState];

export const EDO_DOCUMENT_STATES = Object.freeze(Object.values(EdoDocumentState));

export const EDO_PROVIDER_ADAPTER_METHODS = Object.freeze([
  'connect',
  'disconnect',
  'health',
  'listOrganizations',
  'resolveCounterparty',
  'checkRoute',
  'createDraft',
  'validate',
  'send',
  'getDocument',
  'getStatus',
  'accept',
  'reject',
  'requestCorrection',
  'annul',
  'getEvents',
  'downloadOriginal',
  'downloadSignatures',
  'downloadServiceDocuments',
] as const);
export type EdoProviderAdapterMethod = (typeof EDO_PROVIDER_ADAPTER_METHODS)[number];

export interface EdoProviderContext {
  readonly platformOrganizationId: string;
  readonly connectionId: string;
}

export interface EdoConnectRequest {
  readonly authorizationReference: string;
  readonly requestedProviderOrganizationId?: string;
}

export interface EdoConnectionResult {
  readonly providerConnectionId: string;
  readonly providerOrganizationId: string;
}

export interface EdoHealthResult {
  readonly reachable: boolean;
  readonly safeCode: string | null;
}

export interface EdoProviderOrganization {
  readonly providerOrganizationId: string;
  readonly displayName: string;
  readonly providerBoxId?: string;
  readonly providerAccountId?: string;
}

export interface EdoCounterpartyQuery {
  readonly inn: string;
  readonly kpp?: string | null;
}

export interface EdoCounterpartyResolution {
  readonly resolved: boolean;
  readonly providerCounterpartyId: string | null;
}

export interface EdoRouteCheckRequest {
  readonly providerCounterpartyId: string;
  readonly documentType: string;
}

export interface EdoRouteCheckResult {
  readonly available: boolean;
  readonly safeCode: string | null;
}

export interface EdoDraftRequest {
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly documentType: string;
  readonly payloadHash: string;
}

export interface EdoProviderDocumentRef {
  readonly providerDocumentId: string;
  readonly state: EdoDocumentState;
}

export interface EdoValidationResult {
  readonly valid: boolean;
  readonly safeCodes: readonly string[];
}

export interface EdoSendResult {
  readonly providerDocumentId: string;
  readonly state: EdoDocumentState;
  readonly providerEventId: string | null;
}

export interface EdoProviderEvent {
  readonly providerEventId: string;
  readonly providerDocumentId: string | null;
  readonly state: EdoDocumentState | null;
  readonly occurredAt: Date;
}

export interface EdoBinaryDocument {
  readonly content: Uint8Array;
  readonly mediaType: string;
  readonly fileName: string;
}

/**
 * Provider-neutral surface from §25. A Diadoc/Saby/1C-EDO implementation has
 * to implement this same interface so the accounting contour does not learn a
 * vendor-specific state machine.
 */
export interface EdoProviderAdapter {
  connect(request: EdoConnectRequest): Promise<EdoConnectionResult>;
  disconnect(context: EdoProviderContext): Promise<void>;
  health(context: EdoProviderContext): Promise<EdoHealthResult>;
  listOrganizations(context: EdoProviderContext): Promise<readonly EdoProviderOrganization[]>;
  resolveCounterparty(
    context: EdoProviderContext,
    query: EdoCounterpartyQuery,
  ): Promise<EdoCounterpartyResolution>;
  checkRoute(
    context: EdoProviderContext,
    request: EdoRouteCheckRequest,
  ): Promise<EdoRouteCheckResult>;
  createDraft(
    context: EdoProviderContext,
    request: EdoDraftRequest,
  ): Promise<EdoProviderDocumentRef>;
  validate(
    context: EdoProviderContext,
    document: EdoProviderDocumentRef,
  ): Promise<EdoValidationResult>;
  send(
    context: EdoProviderContext,
    document: EdoProviderDocumentRef,
  ): Promise<EdoSendResult>;
  getDocument(
    context: EdoProviderContext,
    providerDocumentId: string,
  ): Promise<EdoProviderDocumentRef>;
  getStatus(
    context: EdoProviderContext,
    providerDocumentId: string,
  ): Promise<EdoDocumentState>;
  accept(context: EdoProviderContext, providerDocumentId: string): Promise<EdoProviderDocumentRef>;
  reject(
    context: EdoProviderContext,
    providerDocumentId: string,
    reason: string,
  ): Promise<EdoProviderDocumentRef>;
  requestCorrection(
    context: EdoProviderContext,
    providerDocumentId: string,
    reason: string,
  ): Promise<EdoProviderDocumentRef>;
  annul(
    context: EdoProviderContext,
    providerDocumentId: string,
    reason: string,
  ): Promise<EdoProviderDocumentRef>;
  getEvents(
    context: EdoProviderContext,
    cursor?: string,
  ): Promise<readonly EdoProviderEvent[]>;
  downloadOriginal(
    context: EdoProviderContext,
    providerDocumentId: string,
  ): Promise<EdoBinaryDocument>;
  downloadSignatures(
    context: EdoProviderContext,
    providerDocumentId: string,
  ): Promise<readonly EdoBinaryDocument[]>;
  downloadServiceDocuments(
    context: EdoProviderContext,
    providerDocumentId: string,
  ): Promise<readonly EdoBinaryDocument[]>;
}

export interface DiadocOrganizationBinding {
  readonly platformOrganizationId: string;
  readonly providerOrganizationId: string;
  readonly providerBoxId: string;
}

export interface SabyOrganizationBinding {
  readonly platformOrganizationId: string;
  readonly providerOrganizationId: string;
  readonly providerAccountId: string;
}

export interface EdoRoutePlan {
  readonly primary: EdoRoute;
  readonly additional: readonly EdoRoute[];
}

export class EdoProviderContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EdoProviderContractError';
  }
}

export function validateDiadocBinding(
  binding: DiadocOrganizationBinding,
  authorizedBoxIds: readonly string[],
): void {
  nonBlank(binding.platformOrganizationId, 'platformOrganizationId');
  nonBlank(binding.providerOrganizationId, 'providerOrganizationId');
  nonBlank(binding.providerBoxId, 'providerBoxId');

  if (!authorizedBoxIds.includes(binding.providerBoxId)) {
    throw new EdoProviderContractError(
      'providerBoxId must be explicitly authorized and selected for this binding',
    );
  }
}

export function validateSabyBinding(binding: SabyOrganizationBinding): void {
  nonBlank(binding.platformOrganizationId, 'platformOrganizationId');
  nonBlank(binding.providerOrganizationId, 'providerOrganizationId');
  nonBlank(binding.providerAccountId, 'providerAccountId');
}

/**
 * If the customer already uses 1C-EDO, a second automatic channel must not be
 * silently enabled. MANUAL is not an automatic provider channel and does not
 * create the duplicate-routing risk this rule is about.
 */
export function hasDuplicateAutomaticEdoChannel(plan: EdoRoutePlan): boolean {
  if (!isEdoRoute(plan.primary)) {
    throw new EdoProviderContractError('primary EDO route is unknown');
  }
  for (const route of plan.additional) {
    if (!isEdoRoute(route)) {
      throw new EdoProviderContractError(`additional EDO route is unknown: ${String(route)}`);
    }
  }

  if (plan.primary !== EdoRoute.ONE_C_EDO) return false;
  return plan.additional.some((route) => route !== EdoRoute.MANUAL);
}

export function isEdoRoute(value: unknown): value is EdoRoute {
  return typeof value === 'string' && (EDO_ROUTES as readonly string[]).includes(value);
}

export function isEdoDocumentState(value: unknown): value is EdoDocumentState {
  return (
    typeof value === 'string'
    && (EDO_DOCUMENT_STATES as readonly string[]).includes(value)
  );
}

/** Timeout after send is ambiguous: the provider may have accepted the document. */
export function edoStateAfterSendFailure(
  failure: 'TIMEOUT' | 'CONNECTION_LOST' | 'PROVIDER_CONFIRMED_ERROR',
): EdoDocumentState {
  return failure === 'PROVIDER_CONFIRMED_ERROR'
    ? EdoDocumentState.ERROR
    : EdoDocumentState.UNKNOWN;
}

export function requiresEdoReconciliationBeforeRetry(state: EdoDocumentState): boolean {
  if (!isEdoDocumentState(state)) {
    throw new EdoProviderContractError('EDO state is unknown');
  }
  return state === EdoDocumentState.UNKNOWN;
}

function nonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new EdoProviderContractError(`${field} is required`);
  }
}

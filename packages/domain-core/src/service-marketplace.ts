export const SERVICE_MARKETPLACE_STATUSES = [
  'REQUESTED',
  'QUOTED',
  'PROVIDER_SELECTED',
  'PAYER_ASSIGNED',
  'PAYER_CONFIRMED',
  'EXECUTING',
  'EVIDENCE_SUBMITTED',
  'ACCEPTED',
  'SETTLEMENT_RECORDED',
] as const;

export const SERVICE_MARKETPLACE_ACTIONS = [
  'CREATE_REQUEST',
  'SUBMIT_QUOTE',
  'SELECT_PROVIDER',
  'ASSIGN_PAYER',
  'CONFIRM_PAYER',
  'START_EXECUTION',
  'SUBMIT_EVIDENCE',
  'ACCEPT_SERVICE',
  'RECORD_SETTLEMENT',
] as const;

export type ServiceMarketplaceStatus = typeof SERVICE_MARKETPLACE_STATUSES[number];
export type ServiceMarketplaceAction = typeof SERVICE_MARKETPLACE_ACTIONS[number];

export class ServiceMarketplaceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ServiceMarketplaceError';
  }
}

const TRANSITIONS: Readonly<Record<Exclude<ServiceMarketplaceAction, 'CREATE_REQUEST'>, Readonly<{
  from: readonly ServiceMarketplaceStatus[];
  to: ServiceMarketplaceStatus;
}>>> = Object.freeze({
  SUBMIT_QUOTE: { from: ['REQUESTED', 'QUOTED'], to: 'QUOTED' },
  SELECT_PROVIDER: { from: ['QUOTED'], to: 'PROVIDER_SELECTED' },
  ASSIGN_PAYER: { from: ['PROVIDER_SELECTED', 'PAYER_ASSIGNED'], to: 'PAYER_ASSIGNED' },
  CONFIRM_PAYER: { from: ['PAYER_ASSIGNED'], to: 'PAYER_CONFIRMED' },
  START_EXECUTION: { from: ['PAYER_CONFIRMED'], to: 'EXECUTING' },
  SUBMIT_EVIDENCE: { from: ['EXECUTING'], to: 'EVIDENCE_SUBMITTED' },
  ACCEPT_SERVICE: { from: ['EVIDENCE_SUBMITTED'], to: 'ACCEPTED' },
  RECORD_SETTLEMENT: { from: ['ACCEPTED'], to: 'SETTLEMENT_RECORDED' },
});

export function isServiceMarketplaceStatus(value: unknown): value is ServiceMarketplaceStatus {
  return typeof value === 'string' && (SERVICE_MARKETPLACE_STATUSES as readonly string[]).includes(value);
}

export function isServiceMarketplaceAction(value: unknown): value is ServiceMarketplaceAction {
  return typeof value === 'string' && (SERVICE_MARKETPLACE_ACTIONS as readonly string[]).includes(value);
}

export function transitionServiceMarketplace(
  current: ServiceMarketplaceStatus | null,
  action: ServiceMarketplaceAction,
): ServiceMarketplaceStatus {
  if (action === 'CREATE_REQUEST') {
    if (current !== null) {
      throw new ServiceMarketplaceError('SERVICE_REQUEST_ALREADY_EXISTS', 'A request can only be created from no state.');
    }
    return 'REQUESTED';
  }
  if (current === null) {
    throw new ServiceMarketplaceError('SERVICE_REQUEST_NOT_FOUND', 'A lifecycle command requires an existing request.');
  }
  const transition = TRANSITIONS[action];
  if (!transition.from.includes(current)) {
    throw new ServiceMarketplaceError(
      'SERVICE_LIFECYCLE_INVALID',
      `${action} cannot advance a service request from ${current}.`,
    );
  }
  return transition.to;
}

export type ServiceSettlementReference = Readonly<{
  referenceType: 'EXTERNAL' | 'SETTLEMENT_PLAN_PENDING' | 'LEDGER_PENDING';
  reference: string;
  createsFinancialObligation: false;
}>;

export function serviceSettlementReference(
  referenceType: ServiceSettlementReference['referenceType'],
  reference: string,
): ServiceSettlementReference {
  if (!/^[A-Za-z0-9][A-Za-z0-9:_.\/-]{2,239}$/u.test(reference)) {
    throw new ServiceMarketplaceError('SETTLEMENT_REFERENCE_INVALID', 'Settlement reference is unsafe.');
  }
  return Object.freeze({ referenceType, reference, createsFinancialObligation: false });
}

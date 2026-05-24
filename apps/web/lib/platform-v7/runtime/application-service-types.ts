import type { PlatformV7ActionBoundaryResult } from '../action-boundary';
import type { P7BankBasisDecision } from '../bank-basis';
import type { PlatformV7DocumentMatrix } from '../document-matrix';
import type { PlatformV7MoneyTree } from '../money-tree';
import type {
  P7ArbitrationBasisRequestDto,
  P7BankBasisSendRequestDto,
  P7BankConfirmationRequestDto,
  P7DocumentActionRequestDto,
  P7ReleaseRequestDto,
  P7RuntimeRequestBaseDto,
  P7ValidationError,
} from './dto-schemas';
import type {
  P7ArbitrationDecisionRecord,
  P7AuditPayload,
  P7RuntimeUnitOfWork,
} from './persistence-ports';

export type P7ApplicationServiceStatus =
  | 'validation_error'
  | 'denied'
  | 'duplicate'
  | 'conflict'
  | 'not_found'
  | 'domain_blocked'
  | 'persisted';

export type P7ApplicationServiceResult<T> =
  | {
    readonly ok: true;
    readonly status: 'persisted';
    readonly value: T;
    readonly auditPayloads: readonly P7AuditPayload[];
    readonly boundaryResult?: PlatformV7ActionBoundaryResult;
  }
  | {
    readonly ok: false;
    readonly status: Exclude<P7ApplicationServiceStatus, 'persisted'>;
    readonly code: string;
    readonly reason: string;
    readonly validationErrors?: readonly P7ValidationError[];
    readonly auditPayloads: readonly P7AuditPayload[];
    readonly boundaryResult?: PlatformV7ActionBoundaryResult;
  };

export interface P7ApplicationServiceDependencies {
  readonly unitOfWork: P7RuntimeUnitOfWork;
  readonly now?: () => string;
}

export interface P7ReleaseWorkflowStatus {
  readonly dealId: string;
  readonly moneyTree: PlatformV7MoneyTree;
  readonly bankBasis: P7BankBasisDecision | null;
}

export interface P7DisputeMoneyImpact {
  readonly dealId: string;
  readonly moneyMovementAllowed: false;
  readonly reason: string;
}

export interface P7MoneyExecutionService {
  requestRelease(dto: P7ReleaseRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  confirmRelease(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  confirmRefund(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  confirmHold(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  startManualReview(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
}

export interface P7DocumentExecutionService {
  uploadDocument(dto: P7DocumentActionRequestDto): Promise<P7ApplicationServiceResult<PlatformV7DocumentMatrix>>;
  confirmDocument(dto: P7DocumentActionRequestDto): Promise<P7ApplicationServiceResult<PlatformV7DocumentMatrix>>;
  rejectDocument(dto: P7DocumentActionRequestDto): Promise<P7ApplicationServiceResult<PlatformV7DocumentMatrix>>;
  sendDocument(dto: P7DocumentActionRequestDto): Promise<P7ApplicationServiceResult<PlatformV7DocumentMatrix>>;
  markManualReview(dto: P7DocumentActionRequestDto): Promise<P7ApplicationServiceResult<PlatformV7DocumentMatrix>>;
}

export interface P7BankBasisExecutionService {
  sendBankBasis(dto: P7BankBasisSendRequestDto): Promise<P7ApplicationServiceResult<P7BankBasisDecision>>;
  confirmBankRelease(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  rejectBankRelease(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  confirmBankRefund(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  confirmBankHold(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  startBankManualReview(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
}

export interface P7ReleaseWorkflowService {
  prepareRelease(dto: P7ReleaseRequestDto): Promise<P7ApplicationServiceResult<P7ReleaseWorkflowStatus>>;
  requestRelease(dto: P7ReleaseRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  sendBasisToBank(dto: P7BankBasisSendRequestDto): Promise<P7ApplicationServiceResult<P7BankBasisDecision>>;
  handleBankEvent(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  getReleaseStatus(dto: P7RuntimeRequestBaseDto): Promise<P7ApplicationServiceResult<P7ReleaseWorkflowStatus>>;
}

export interface P7DisputeSettlementService {
  openDispute(dto: P7RuntimeRequestBaseDto): Promise<P7ApplicationServiceResult<P7DisputeMoneyImpact>>;
  attachEvidence(dto: P7RuntimeRequestBaseDto): Promise<P7ApplicationServiceResult<P7DisputeMoneyImpact>>;
  prepareArbitrationBasis(dto: P7ArbitrationBasisRequestDto): Promise<P7ApplicationServiceResult<P7ArbitrationDecisionRecord>>;
  applyArbitrationOutcomeToBankBasis(dto: P7BankConfirmationRequestDto): Promise<P7ApplicationServiceResult<PlatformV7MoneyTree>>;
  getDisputeMoneyImpact(dto: P7RuntimeRequestBaseDto): Promise<P7ApplicationServiceResult<P7DisputeMoneyImpact>>;
}

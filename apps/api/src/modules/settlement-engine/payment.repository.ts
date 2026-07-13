import type { RequestUser } from '../../common/types/request-user';

export const PAYMENT_REPOSITORY = 'PAYMENT_REPOSITORY';

export type MoneyMinorUnits = string;

export interface PaymentRecord {
  id: string;
  dealId: string;
  status: string;
  amountKopecks: MoneyMinorUnits | null;
  holdAmountKopecks: MoneyMinorUnits;
  refundedKopecks: MoneyMinorUnits;
  commissionKopecks: MoneyMinorUnits;
  reservedAt: string | null;
  releasedAt: string | null;
  callbackState: string;
  bankRef: string | null;
  escrowAccount: string | null;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankOperationRecord {
  id: string;
  dealId: string;
  type: string;
  status: string;
  amountKopecks: MoneyMinorUnits;
  currency: string;
  debitAccount: string;
  creditAccount: string;
  bankRef: string | null;
  bankName: string | null;
  idempotencyKey: string;
  initiatorUserId: string | null;
  confirmedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerRecord {
  id: string;
  dealId: string | null;
  entryType: string;
  debitAccount: string;
  creditAccount: string;
  amountKopecks: MoneyMinorUnits;
  currency: string;
  reference: string | null;
  idempotencyKey: string;
  description: string | null;
  createdAt: string;
  createdByUserId: string | null;
}

export interface SettlementDealRecord {
  id: string;
  dealNumber: string | null;
  status: string;
  sellerOrgId: string;
  buyerOrgId: string;
  totalKopecks: MoneyMinorUnits | null;
  currency: string;
  nextAction: string | null;
  version: string;
  updatedAt: string;
}

export interface SettlementBlocker {
  code: string;
  message: string;
  amountKopecks?: MoneyMinorUnits;
}

export interface SettlementWorkspace {
  deal: SettlementDealRecord;
  payment: PaymentRecord | null;
  blockers: SettlementBlocker[];
  bankOperations: BankOperationRecord[];
  ledger: LedgerRecord[];
  releaseDocuments: {
    required: number;
    complete: number;
    isComplete: boolean;
  };
}

export interface BankWorkspace extends SettlementWorkspace {
  statementEntries: Array<{
    id: string;
    amountKopecks: MoneyMinorUnits;
    currency: string;
    reference: string;
    matchStatus: string;
    mismatchReason: string | null;
    createdAt: string;
  }>;
}

export interface OutboxStatus {
  totalPending: number;
  pending: Array<{
    id: string;
    type: string;
    dealId: string | null;
    status: string;
    idempotencyKey: string | null;
    correlationId: string | null;
    retryCount: number;
    nextRetryAt: string;
    createdAt: string;
  }>;
  manualReview: Array<{
    id: string;
    type: string;
    dealId: string | null;
    status: string;
    lastError: string | null;
    createdAt: string;
  }>;
}

export interface PaymentRepository {
  list(user: RequestUser, take?: number): Promise<PaymentRecord[]>;
  detail(id: string, user: RequestUser): Promise<PaymentRecord>;
  worksheet(dealId: string, user: RequestUser): Promise<SettlementWorkspace>;
  bankWorkspace(dealId: string, user: RequestUser): Promise<BankWorkspace>;
  outboxStatus(dealId: string | undefined, user: RequestUser): Promise<OutboxStatus>;
  exportDeals(
    params: { format?: string; from?: string; to?: string },
    user: RequestUser,
  ): Promise<{ contentType: string; fileName: string; body: string }>;
  exportContractors(
    user: RequestUser,
  ): Promise<{ contentType: string; fileName: string; body: string }>;
}

import type { P7RuntimeTransactionContext } from './runtime/persistence-ports';
import type { P7DealWorkspaceRuntimeDbContract } from './deal-workspace-runtime-db-contract';
import type {
  P7DealWorkspaceRuntimeRepository,
  P7DealWorkspaceRuntimeRepositoryReceipt,
} from './deal-workspace-runtime-db-repository';
import {
  isP7DealWorkspaceRuntimeLinkageValid,
  type P7DealWorkspaceRuntimeLinkageResult,
} from './deal-workspace-runtime-linkage';

export type P7DealWorkspaceRuntimeTransactionMaturity = 'contract-transaction-coordinator';
export type P7DealWorkspaceRuntimeTransactionStage =
  | 'created'
  | 'prepared'
  | 'committed'
  | 'rolled_back'
  | 'failed';
export type P7DealWorkspaceRuntimeTransactionFailureCode =
  | 'INVALID_LINKAGE'
  | 'TRANSACTION_CONTEXT_MISMATCH'
  | 'INVALID_STAGE'
  | 'REPOSITORY_CONFLICT'
  | 'COMMIT_ERROR';

export interface P7DealWorkspaceRuntimeTransactionFailure {
  readonly code: P7DealWorkspaceRuntimeTransactionFailureCode;
  readonly message: string;
}

export interface P7DealWorkspaceRuntimeTransactionResult {
  readonly transaction: P7RuntimeTransactionContext;
  readonly stage: P7DealWorkspaceRuntimeTransactionStage;
  readonly replay: boolean;
  readonly maturity: P7DealWorkspaceRuntimeTransactionMaturity;
  readonly repositoryReceipt?: P7DealWorkspaceRuntimeRepositoryReceipt;
  readonly failure?: P7DealWorkspaceRuntimeTransactionFailure;
  readonly rollbackReason?: string;
}

export interface P7DealWorkspaceRuntimeTransactionInput {
  readonly repository: P7DealWorkspaceRuntimeRepository;
  readonly contract: P7DealWorkspaceRuntimeDbContract;
  readonly linkageResult: P7DealWorkspaceRuntimeLinkageResult;
  readonly transaction: P7RuntimeTransactionContext;
  readonly savedAt?: string;
  readonly beforeCommit?: () => void;
}

export interface P7DealWorkspaceRuntimeTransaction {
  readonly transaction: P7RuntimeTransactionContext;
  current(): P7DealWorkspaceRuntimeTransactionResult;
  prepare(): P7DealWorkspaceRuntimeTransactionResult;
  commit(): P7DealWorkspaceRuntimeTransactionResult;
  rollback(reason: string): P7DealWorkspaceRuntimeTransactionResult;
}

function baseResult(
  transaction: P7RuntimeTransactionContext,
  stage: P7DealWorkspaceRuntimeTransactionStage,
  replay = false,
): P7DealWorkspaceRuntimeTransactionResult {
  return {
    transaction,
    stage,
    replay,
    maturity: 'contract-transaction-coordinator',
  };
}

function failedResult(
  transaction: P7RuntimeTransactionContext,
  code: P7DealWorkspaceRuntimeTransactionFailureCode,
  message: string,
): P7DealWorkspaceRuntimeTransactionResult {
  return {
    ...baseResult(transaction, 'failed'),
    failure: { code, message },
  };
}

function transactionContextMatchesContract(input: P7DealWorkspaceRuntimeTransactionInput): boolean {
  const { transaction, contract } = input;
  if (transaction.correlationId !== contract.correlationId) return false;
  if (transaction.auditId && transaction.auditId !== contract.auditId) return false;
  if (transaction.actorId && transaction.actorId !== contract.actorId) return false;
  return true;
}

export function createP7DealWorkspaceRuntimeTransaction(
  input: P7DealWorkspaceRuntimeTransactionInput,
): P7DealWorkspaceRuntimeTransaction {
  let currentResult: P7DealWorkspaceRuntimeTransactionResult = baseResult(input.transaction, 'created');

  function replayCurrent(): P7DealWorkspaceRuntimeTransactionResult {
    return { ...currentResult, replay: true };
  }

  return {
    transaction: input.transaction,

    current() {
      return { ...currentResult };
    },

    prepare() {
      if (currentResult.stage === 'prepared' || currentResult.stage === 'committed') {
        return replayCurrent();
      }
      if (currentResult.stage === 'rolled_back' || currentResult.stage === 'failed') {
        return replayCurrent();
      }
      if (!transactionContextMatchesContract(input)) {
        currentResult = failedResult(
          input.transaction,
          'TRANSACTION_CONTEXT_MISMATCH',
          'Transaction correlation, audit or actor identity does not match the runtime DB contract.',
        );
        return currentResult;
      }
      if (!isP7DealWorkspaceRuntimeLinkageValid(input.linkageResult)) {
        currentResult = failedResult(
          input.transaction,
          'INVALID_LINKAGE',
          'Runtime linkage evidence failed validation and cannot be prepared for commit.',
        );
        return currentResult;
      }

      currentResult = baseResult(input.transaction, 'prepared');
      return currentResult;
    },

    commit() {
      if (currentResult.stage === 'committed') return replayCurrent();
      if (currentResult.stage !== 'prepared') {
        if (currentResult.stage === 'rolled_back' || currentResult.stage === 'failed') return replayCurrent();
        currentResult = failedResult(
          input.transaction,
          'INVALID_STAGE',
          'Transaction must be prepared before commit.',
        );
        return currentResult;
      }

      try {
        input.beforeCommit?.();
        const repositoryReceipt = input.repository.writeHardened({
          contract: input.contract,
          linkage: input.linkageResult.linkage,
          savedAt: input.savedAt,
        });

        if (repositoryReceipt.status === 'conflict') {
          currentResult = {
            ...failedResult(
              input.transaction,
              'REPOSITORY_CONFLICT',
              repositoryReceipt.conflictReason ?? 'Repository rejected the idempotent write as a conflict.',
            ),
            repositoryReceipt,
          };
          return currentResult;
        }

        currentResult = {
          ...baseResult(input.transaction, 'committed'),
          repositoryReceipt,
        };
        return currentResult;
      } catch (error) {
        currentResult = failedResult(
          input.transaction,
          'COMMIT_ERROR',
          error instanceof Error ? error.message : 'Unknown contract-level commit error.',
        );
        return currentResult;
      }
    },

    rollback(reason) {
      if (currentResult.stage === 'committed') {
        currentResult = failedResult(
          input.transaction,
          'INVALID_STAGE',
          'A committed contract-level transaction cannot be rolled back by this coordinator.',
        );
        return currentResult;
      }
      if (currentResult.stage === 'rolled_back' || currentResult.stage === 'failed') return replayCurrent();

      currentResult = {
        ...baseResult(input.transaction, 'rolled_back'),
        rollbackReason: reason,
      };
      return currentResult;
    },
  };
}

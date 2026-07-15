import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';

const SAFE_ID = /^[A-Za-z0-9:_.-]{1,240}$/;

type CommandRow = Readonly<{ result: Prisma.JsonValue }>;

/**
 * Executes the post-deadline, no-appeal transition.
 *
 * Scheduling remains outside this service. Each invocation is a regular,
 * authorized, idempotent command; PostgreSQL is the only state and money
 * authority and rejects execution before the appeal deadline.
 */
@Injectable()
export class DisputeFinalizationService {
  constructor(private readonly rls: RlsTransactionService) {}

  async finalize(
    caseIdInput: string,
    idempotencyKeyInput: string,
    user: RequestUser,
  ): Promise<Record<string, unknown>> {
    const caseId = safeId(caseIdInput, 'caseId');
    const idempotencyKey = safeId(idempotencyKeyInput, 'idempotencyKey');
    const commandId = `dispute-command:${randomUUID()}`;

    try {
      return await this.rls.withTrustedContext(
        user,
        async (tx) => {
          const rows = await tx.$queryRaw<CommandRow[]>(Prisma.sql`
            SELECT dispute.finalize_case(
              ${caseId}, ${commandId}, ${idempotencyKey}
            ) AS result
          `);
          const result = rows[0]?.result;
          if (!result || typeof result !== 'object' || Array.isArray(result)) {
            throw new InternalServerErrorException({
              code: 'DISPUTE_COMMAND_RECEIPT_MISSING',
              commandId,
            });
          }
          return { ...(result as Record<string, unknown>), commandId };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxConflictRetries: 5,
          timeout: 20_000,
        },
      );
    } catch (error) {
      if (error instanceof BadRequestException
          || error instanceof ConflictException
          || error instanceof NotFoundException
          || error instanceof InternalServerErrorException) {
        throw error;
      }
      const message = databaseMessage(error);
      if (message.includes('DISPUTE_CASE_NOT_FOUND')) {
        throw new NotFoundException({ code: 'DISPUTE_CASE_NOT_FOUND', commandId });
      }
      if (message.includes('DISPUTE_NOT_FINALIZABLE')) {
        throw new ConflictException({ code: 'DISPUTE_NOT_FINALIZABLE', commandId });
      }
      if (message.includes('DISPUTE_')) {
        throw new BadRequestException({
          code: message.match(/DISPUTE_[A-Z0-9_]+/)?.[0] ?? 'DISPUTE_COMMAND_REJECTED',
          commandId,
        });
      }
      throw new InternalServerErrorException({
        code: 'DISPUTE_FINALIZATION_FAILED',
        commandId,
      });
    }
  }
}

function safeId(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_ID.test(normalized)) {
    throw new BadRequestException({
      code: 'DISPUTE_VALIDATION_FAILED',
      field,
      message: `${field} must be a safe identifier.`,
    });
  }
  return normalized;
}

function databaseMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const record = error as Record<string, unknown>;
  const meta = record.meta && typeof record.meta === 'object'
    ? record.meta as Record<string, unknown>
    : undefined;
  return [record.message, meta?.message, meta?.database_error]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

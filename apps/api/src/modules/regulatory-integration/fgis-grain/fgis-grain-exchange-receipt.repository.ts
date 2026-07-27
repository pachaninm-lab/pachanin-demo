import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { ClaimedOutboxEntry } from '../../integration-events/durable-outbox.worker';
import type {
  FgisGrainOutboundDispatchPayload,
  FgisGrainTransportResult,
} from './fgis-grain-1.0.23.dispatch.contract';
import {
  FGIS_GRAIN_EXCHANGE_EVENT_SCHEMA,
  FgisGrainExchangeAuthorityError,
  computeFgisGrainDispatchPayloadFingerprint,
  normalizeAcceptedTransportReceipt,
} from './fgis-grain-exchange.contract';

type DispatchDecision = Readonly<{
  kind: 'SEND' | 'SKIP_TRANSPORT';
  exchangeId: string;
  state: 'DISPATCH_PENDING' | 'TRANSPORT_ACCEPTED' | 'RESPONSE_RECEIVED';
}>;

type FunctionRow = Readonly<{ result: unknown }>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function mapDatabaseFailure(error: unknown): FgisGrainExchangeAuthorityError {
  if (error instanceof FgisGrainExchangeAuthorityError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('OUTBOX_LEASE_INVALID')) {
    return new FgisGrainExchangeAuthorityError(
      'OUTBOX_LEASE_INVALID',
      'canonical outbox lease was lost before exchange persistence',
      true,
    );
  }
  if (message.includes('AUTHORITY_MISSING')) {
    return new FgisGrainExchangeAuthorityError(
      'EXCHANGE_AUTHORITY_MISSING',
      'durable exchange row is missing for the canonical outbox entry',
      false,
    );
  }
  if (message.includes('FINGERPRINT_MISMATCH') || message.includes('AUTHORITY_MISMATCH')) {
    return new FgisGrainExchangeAuthorityError(
      'EXCHANGE_AUTHORITY_MISMATCH',
      'durable exchange authority does not match the outbox payload',
      false,
    );
  }
  const testDiagnostic = process.env.NODE_ENV === 'test'
    ? `; database failure: ${message}`
    : '';
  return new FgisGrainExchangeAuthorityError(
    'TRANSPORT_RECEIPT_PERSISTENCE_FAILED',
    `unable to persist the provider transport receipt${testDiagnostic}`,
    true,
  );
}

@Injectable()
export class FgisGrainExchangeReceiptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async inspectBeforeDispatch(
    entry: ClaimedOutboxEntry,
    payload: FgisGrainOutboundDispatchPayload,
  ): Promise<DispatchDecision> {
    const fingerprint = computeFgisGrainDispatchPayloadFingerprint(payload);
    try {
      const rows = await this.prisma.$queryRaw<FunctionRow[]>(Prisma.sql`
        SELECT public.inspect_fgis_grain_exchange_dispatch(
          ${entry.id},
          ${entry.leaseToken},
          ${fingerprint}
        ) AS "result"
      `);
      const result = asRecord(rows[0]?.result);
      if (
        !result
        || result.schemaVersion !== FGIS_GRAIN_EXCHANGE_EVENT_SCHEMA
        || typeof result.exchangeId !== 'string'
        || result.dispatchPayloadFingerprint !== fingerprint
      ) {
        throw new FgisGrainExchangeAuthorityError(
          'DATABASE_RESULT_INVALID',
          'exchange dispatch inspection returned a malformed result',
          false,
        );
      }
      if (
        result.kind === 'SEND'
        && result.state === 'DISPATCH_PENDING'
      ) {
        return {
          kind: 'SEND',
          exchangeId: result.exchangeId,
          state: 'DISPATCH_PENDING',
        };
      }
      if (
        result.kind === 'SKIP_TRANSPORT'
        && (result.state === 'TRANSPORT_ACCEPTED'
          || result.state === 'RESPONSE_RECEIVED')
      ) {
        return {
          kind: 'SKIP_TRANSPORT',
          exchangeId: result.exchangeId,
          state: result.state,
        };
      }
      if (result.kind === 'RECONCILIATION_REQUIRED') {
        throw new FgisGrainExchangeAuthorityError(
          'RECONCILIATION_REQUIRED',
          'exchange is blocked by governed reconciliation',
          false,
        );
      }
      throw new FgisGrainExchangeAuthorityError(
        'DATABASE_RESULT_INVALID',
        'exchange dispatch inspection returned an unsupported state',
        false,
      );
    } catch (error) {
      throw mapDatabaseFailure(error);
    }
  }

  async recordAccepted(
    entry: ClaimedOutboxEntry,
    payload: FgisGrainOutboundDispatchPayload,
    transportResult: FgisGrainTransportResult,
  ): Promise<void> {
    const fingerprint = computeFgisGrainDispatchPayloadFingerprint(payload);
    const receipt = normalizeAcceptedTransportReceipt(transportResult);
    try {
      const rows = await this.prisma.$queryRaw<FunctionRow[]>(Prisma.sql`
        SELECT public.record_fgis_grain_transport_receipt(
          ${entry.id},
          ${entry.leaseToken},
          ${fingerprint},
          ${receipt.providerMessageId},
          ${receipt.responseCode},
          ${receipt.httpStatus},
          ${receipt.responseBodySha256},
          CAST(${receipt.acceptedAt} AS timestamptz)
        ) AS "result"
      `);
      const result = asRecord(rows[0]?.result);
      if (
        !result
        || result.schemaVersion !== FGIS_GRAIN_EXCHANGE_EVENT_SCHEMA
        || typeof result.exchangeId !== 'string'
      ) {
        throw new FgisGrainExchangeAuthorityError(
          'DATABASE_RESULT_INVALID',
          'transport receipt persistence returned a malformed result',
          false,
        );
      }
      if (result.kind === 'RECONCILIATION_REQUIRED') {
        throw new FgisGrainExchangeAuthorityError(
          'RECONCILIATION_REQUIRED',
          typeof result.reasonCode === 'string'
            ? result.reasonCode
            : 'transport receipt divergence requires reconciliation',
          false,
        );
      }
      if (result.kind !== 'RECORDED' && result.kind !== 'REPLAY') {
        throw new FgisGrainExchangeAuthorityError(
          'DATABASE_RESULT_INVALID',
          'transport receipt persistence returned an unsupported outcome',
          false,
        );
      }
    } catch (error) {
      throw mapDatabaseFailure(error);
    }
  }
}

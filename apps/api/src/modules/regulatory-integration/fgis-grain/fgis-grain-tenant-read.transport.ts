import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  FgisGrainTenantReadTransportRequest,
  FgisGrainTenantReadTransportResult,
} from './fgis-grain-tenant-read.contract';

export const FGIS_GRAIN_TENANT_READ_TRANSPORT = Symbol(
  'FGIS_GRAIN_TENANT_READ_TRANSPORT',
);
export const FGIS_GRAIN_TENANT_READ_OUTCOME_AUTHORITY = Symbol(
  'FGIS_GRAIN_TENANT_READ_OUTCOME_AUTHORITY',
);

export const FGIS_GRAIN_TENANT_READ_MAX_TRANSPORT_MS = 30_000;

export type FgisGrainTenantReadTransportControl = Readonly<{
  signal: AbortSignal;
  deadlineAt: string;
}>;

export type FgisGrainTenantReadClaimCapability = Readonly<{
  id: string;
  completionToken: string;
}>;

export interface FgisGrainTenantReadTransport {
  readonly available: boolean;
  readonly maxExecutionMs: number;
  /**
   * The promise may settle only after the outbound provider operation has
   * completed or cancellation has been acknowledged by the adapter.
   */
  execute(
    request: FgisGrainTenantReadTransportRequest,
    control: FgisGrainTenantReadTransportControl,
  ): Promise<FgisGrainTenantReadTransportResult>;
}

export interface FgisGrainTenantReadOutcomeAuthority {
  readonly available: boolean;
  start(claim: FgisGrainTenantReadClaimCapability): Promise<string>;
  finalize(
    claim: FgisGrainTenantReadClaimCapability,
    result: FgisGrainTenantReadTransportResult | null,
    decision: 'SUCCEEDED' | 'FAILED',
    reasonCode: 'PROVIDER_READ_SUCCEEDED' | 'PROVIDER_READ_FAILED',
  ): Promise<string>;
}

/**
 * Production-safe default. PC-CROP-10C may be merged without provider access,
 * but no outbound request or terminal provider evidence can occur until a
 * separately governed abortable transport and its dedicated PostgreSQL outcome
 * authority are bound together.
 */
@Injectable()
export class DisabledFgisGrainTenantReadTransport
implements FgisGrainTenantReadTransport, FgisGrainTenantReadOutcomeAuthority {
  readonly available = false;
  readonly maxExecutionMs = FGIS_GRAIN_TENANT_READ_MAX_TRANSPORT_MS;

  async execute(
    _request: FgisGrainTenantReadTransportRequest,
    _control: FgisGrainTenantReadTransportControl,
  ): Promise<FgisGrainTenantReadTransportResult> {
    throw this.disabled();
  }

  async finalize(
    _claim: FgisGrainTenantReadClaimCapability,
    _result: FgisGrainTenantReadTransportResult | null,
    _decision: 'SUCCEEDED' | 'FAILED',
    _reasonCode: 'PROVIDER_READ_SUCCEEDED' | 'PROVIDER_READ_FAILED',
  ): Promise<string> {
    throw this.disabled();
  }

  async start(
    _claim: FgisGrainTenantReadClaimCapability,
  ): Promise<string> {
    throw this.disabled();
  }

  private disabled(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'FGIS_GRAIN_READ_TRANSPORT_DISABLED',
      retryable: false,
      operationalStatus: 'NOT_ATTESTED',
    });
  }
}

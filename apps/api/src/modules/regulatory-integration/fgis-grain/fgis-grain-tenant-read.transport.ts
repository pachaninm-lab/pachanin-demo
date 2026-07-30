import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  FgisGrainTenantReadTransportRequest,
  FgisGrainTenantReadTransportResult,
} from './fgis-grain-tenant-read.contract';

export const FGIS_GRAIN_TENANT_READ_TRANSPORT = Symbol(
  'FGIS_GRAIN_TENANT_READ_TRANSPORT',
);

export interface FgisGrainTenantReadTransportOutcome {
  readonly claimId: string;
  readonly completionToken: string;
  readonly decision: 'SUCCEEDED' | 'FAILED';
  readonly reasonCode: 'PROVIDER_READ_SUCCEEDED' | 'PROVIDER_READ_FAILED';
  readonly result: FgisGrainTenantReadTransportResult | null;
}

export interface FgisGrainTenantReadTransport {
  readonly available: boolean;
  execute(
    request: FgisGrainTenantReadTransportRequest,
  ): Promise<FgisGrainTenantReadTransportResult>;
  finalizeOutcome(
    outcome: FgisGrainTenantReadTransportOutcome,
  ): Promise<void>;
}

/**
 * Production-safe default. PC-CROP-10C may be merged without provider access,
 * but no outbound request can occur until a separately governed transport is
 * bound and external read evidence is accepted.
 */
@Injectable()
export class DisabledFgisGrainTenantReadTransport
implements FgisGrainTenantReadTransport {
  readonly available = false;

  async execute(
    _request: FgisGrainTenantReadTransportRequest,
  ): Promise<FgisGrainTenantReadTransportResult> {
    throw new ServiceUnavailableException({
      code: 'FGIS_GRAIN_READ_TRANSPORT_DISABLED',
      retryable: false,
      operationalStatus: 'NOT_ATTESTED',
    });
  }

  async finalizeOutcome(
    _outcome: FgisGrainTenantReadTransportOutcome,
  ): Promise<void> {
    throw new ServiceUnavailableException({
      code: 'FGIS_GRAIN_READ_TRANSPORT_DISABLED',
      retryable: false,
      operationalStatus: 'NOT_ATTESTED',
    });
  }
}

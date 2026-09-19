/**
 * P0.2-1A — legacy ФГИС «Зерно» quarantine.
 *
 * The official ФГИС «Зерно» integration contract is SOAP 1.1 over
 * `SendRequest` / `SendResponse` / `Ack` with XML/XSD payloads and asynchronous
 * business processing. The REST shapes that the retired legacy adapter used
 * (`POST /lots`, `GET /lots/:id/status`, `/shipment`, `/acceptance`,
 * `/certificate`, `/dictionaries/crops`) do not exist in that contract — they
 * were an invented vendor mapping.
 *
 * Anything that still asks this SDK for a production ФГИС «Зерно» adapter is
 * therefore asking for a path that cannot produce a real regulatory result.
 * Rather than answering with a mock — which would let a caller believe an
 * external lot was registered — the registry answers with the adapter below,
 * which fails closed on every call.
 *
 * The only permitted extension point for real ФГИС «Зерно» exchange is
 * `apps/api/src/modules/regulatory-integration/fgis-grain`.
 */

import type { AdapterMode, HealthStatus, IntegrationAdapter } from '../adapter.interface';

/** Stable, secret-free code returned to callers and written to audit. */
export const LEGACY_FGIS_QUARANTINE_CODE = 'LEGACY_FGIS_ADAPTER_RETIRED';

/** Canonical contour that replaces every retired legacy ФГИС path. */
export const FGIS_CANONICAL_CONTOUR =
  'apps/api/src/modules/regulatory-integration/fgis-grain';

const QUARANTINE_MESSAGE =
  'Legacy ФГИС «Зерно» adapter is retired. The official contract is SOAP 1.1 ' +
  '(SendRequest/SendResponse/Ack) and is served only by ' +
  `${FGIS_CANONICAL_CONTOUR}. No REST lot registration path exists.`;

/**
 * Thrown instead of performing a retired legacy ФГИС call. Carries no request
 * payload, credential or endpoint detail so it is safe to log and to surface as
 * a structured denial.
 */
export class LegacyFgisQuarantineError extends Error {
  readonly code = LEGACY_FGIS_QUARANTINE_CODE;
  readonly retryable = false;
  readonly canonicalContour = FGIS_CANONICAL_CONTOUR;

  constructor(message: string = QUARANTINE_MESSAGE) {
    super(message);
    this.name = 'LegacyFgisQuarantineError';
  }
}

export function isLegacyFgisQuarantineError(
  error: unknown,
): error is LegacyFgisQuarantineError {
  return (
    error instanceof LegacyFgisQuarantineError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === LEGACY_FGIS_QUARANTINE_CODE)
  );
}

/**
 * Registered under `FGIS_ZERNO` by default. Every operation fails closed; the
 * health check reports `down` rather than pretending a mock is healthy, so an
 * operator dashboard cannot render this integration as working.
 *
 * `mode` is deliberately `mock` — the union has no "retired" member, and
 * claiming `live` here is exactly the false-status defect this slice removes.
 * Callers that need to branch should use `isQuarantined`.
 */
export class QuarantinedFgisZernoAdapter implements IntegrationAdapter {
  readonly name = 'FGIS_ZERNO';
  readonly version = '0.0.0-quarantined';
  readonly mode: AdapterMode = 'mock';
  readonly isQuarantined = true;
  readonly quarantineCode = LEGACY_FGIS_QUARANTINE_CODE;

  async execute(): Promise<never> {
    throw new LegacyFgisQuarantineError();
  }

  async registerLot(): Promise<never> {
    throw new LegacyFgisQuarantineError();
  }

  async getLotStatus(): Promise<never> {
    throw new LegacyFgisQuarantineError();
  }

  async confirmShipment(): Promise<never> {
    throw new LegacyFgisQuarantineError();
  }

  async confirmAcceptance(): Promise<never> {
    throw new LegacyFgisQuarantineError();
  }

  async getCertificate(): Promise<never> {
    throw new LegacyFgisQuarantineError();
  }

  async getCrops(): Promise<never> {
    throw new LegacyFgisQuarantineError();
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'down',
      lastCheckedAt: new Date().toISOString(),
      detail: LEGACY_FGIS_QUARANTINE_CODE,
    };
  }
}

export function isQuarantinedFgisAdapter(
  adapter: Pick<IntegrationAdapter, 'name'> | null | undefined,
): boolean {
  return Boolean(
    adapter && (adapter as { isQuarantined?: boolean }).isQuarantined === true,
  );
}

/**
 * P0.2-1A — explicit test-only binding for the ФГИС «Зерно» mock adapter.
 *
 * `MockFgisZernoAdapter` used to be registered by the SDK registry at import
 * time, which meant every production process carried a synthetic ФГИС that
 * answered `registerLot` with an invented external ID. It is now bound only by
 * a test that asks for it by name, and only outside production.
 *
 * Import this module from tests and fixtures. Nothing under `src` that runs in
 * production may import it.
 */

import { MockFgisZernoAdapter } from '../adapters/fgis-zerno.adapter';
import { integrationRegistry } from '../registry';
import { QuarantinedFgisZernoAdapter } from '../quarantine/fgis-zerno-legacy';

type Registry = Pick<typeof integrationRegistry, 'register'>;

export class FgisTestBindingRefusedError extends Error {
  readonly code = 'LEGACY_FGIS_TEST_BINDING_REFUSED';

  constructor(nodeEnv: string) {
    super(
      'The ФГИС «Зерно» mock adapter cannot be bound in a production runtime ' +
        `(NODE_ENV=${nodeEnv}). It exists for automated tests only and is never ` +
        'production evidence.',
    );
    this.name = 'FgisTestBindingRefusedError';
  }
}

function assertNotProduction(): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') {
    throw new FgisTestBindingRefusedError(nodeEnv);
  }
}

/**
 * Binds the ФГИС «Зерно» mock adapter for the duration of a test. Refuses to
 * run under `NODE_ENV=production`. Returns a disposer that restores the
 * fail-closed quarantine adapter, so a test cannot leak the mock into the
 * process-wide registry used by later suites.
 */
export function registerMockFgisZernoAdapterForTests(
  registry: Registry = integrationRegistry,
): () => void {
  assertNotProduction();
  registry.register('FGIS_ZERNO', new MockFgisZernoAdapter());
  return () => {
    registry.register('FGIS_ZERNO', new QuarantinedFgisZernoAdapter());
  };
}

/** Restores the fail-closed default without waiting for a disposer. */
export function restoreQuarantinedFgisZernoAdapter(
  registry: Registry = integrationRegistry,
): void {
  registry.register('FGIS_ZERNO', new QuarantinedFgisZernoAdapter());
}

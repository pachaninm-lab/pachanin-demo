/**
 * Mode-aware wiring: bind disabled, explicitly requested stub, or live adapters
 * from environment configuration. Importing the registry never makes a mock
 * callable; `<NAME>_MODE=stub` is required for every stub binding.
 */

import type { AdapterMode, HealthStatus, IntegrationAdapter } from '../adapter.interface';
import { integrationRegistry, type AdapterName } from '../registry';
import { buildHttpClient, type BuildClientDeps } from './build-client';
import { resolveIntegrationConfig, type Env } from './integration-config';
import { HttpIntegrationClient } from './http-integration-client';
import {
  FGIS_CANONICAL_CONTOUR,
  LegacyFgisQuarantineError,
  QuarantinedFgisZernoAdapter,
} from '../quarantine/fgis-zerno-legacy';
import { LiveBankAdapter } from './live-bank.adapter';
import { LiveDiadokAdapter } from './live-diadok.adapter';
import { LiveCryptoproAdapter } from './live-cryptopro.adapter';
import { LiveFnsAdapter } from './live-fns.adapter';
import { LiveFtsAdapter } from './live-fts.adapter';
import { LiveRshnAdapter } from './live-rshn.adapter';
import { LiveGpsAdapter } from './live-gps.adapter';
import { LiveAmlAdapter } from './live-aml.adapter';
import { LiveGisEpdAdapter } from './live-gis-epd.adapter';
import { LiveRzdEtranAdapter } from './live-rzd-etran.adapter';
import { LiveBkiAdapter } from './live-bki.adapter';
import { LiveTakskomAdapter } from './live-takskom.adapter';
import { LiveMarineAdapter } from './live-marine.adapter';
import { LiveSmevAdapter } from './live-smev.adapter';
import { MockFnsAdapter } from '../adapters/fns.adapter';
import { MockDiadokAdapter } from '../adapters/diadok.adapter';
import { MockCryptoproAdapter } from '../adapters/cryptopro.adapter';
import { MockBankAdapter } from '../adapters/bank.adapter';
import { MockGpsAdapter } from '../adapters/gps.adapter';
import { MockFtsAdapter } from '../adapters/fts.adapter';
import { MockRshnAdapter } from '../adapters/rshn.adapter';
import { MockAmlAdapter } from '../adapters/aml.adapter';
import { MockRzdEtranAdapter } from '../adapters/rzd-etran.adapter';
import { MockGisEpdAdapter } from '../adapters/gis-epd.adapter';
import { MockBkiAdapter } from '../adapters/bki.adapter';
import { MockTakskomAdapter } from '../adapters/takskom.adapter';
import { MockMarineAdapter } from '../adapters/marine.adapter';
import { MockSmevAdapter } from '../adapters/smev.adapter';

/**
 * Live adapter factories — one per external system. Each `Live<Name>Adapter`
 * implements the same contract as its mock over the shared HTTP client; the
 * remaining per-vendor work is endpoint paths + field mapping (marked
 * "VENDOR MAPPING" in each file). See INTEGRATION_CONNECT_GUIDE.md.
 *
 * `FGIS_ZERNO` has no entry and must never get one: its official contract is
 * SOAP 1.1, not JSON over this HTTP client, and it is served by the canonical
 * regulatory-integration contour. See `QUARANTINED_ADAPTERS` below.
 */
export const LIVE_ADAPTER_FACTORIES: Partial<Record<AdapterName, (http: HttpIntegrationClient) => IntegrationAdapter>> = {
  BANK: (http) => new LiveBankAdapter(http),
  DIADOK: (http) => new LiveDiadokAdapter(http),
  CRYPTOPRO_DSS: (http) => new LiveCryptoproAdapter(http),
  FNS: (http) => new LiveFnsAdapter(http),
  FTS: (http) => new LiveFtsAdapter(http),
  RSHN: (http) => new LiveRshnAdapter(http),
  GPS: (http) => new LiveGpsAdapter(http),
  AML_ROSFINMONITORING: (http) => new LiveAmlAdapter(http),
  GIS_EPD: (http) => new LiveGisEpdAdapter(http),
  RZD_ETRAN: (http) => new LiveRzdEtranAdapter(http),
  BKI_NBKI: (http) => new LiveBkiAdapter(http),
  TAKSKOM: (http) => new LiveTakskomAdapter(http),
  MARINE_TRAFFIC: (http) => new LiveMarineAdapter(http),
  SMEV: (http) => new LiveSmevAdapter(http),
};

/** Stub factories are opt-in and are never installed by a module import. */
export const STUB_ADAPTER_FACTORIES: Partial<Record<AdapterName, () => IntegrationAdapter>> = {
  FNS: () => new MockFnsAdapter(),
  DIADOK: () => new MockDiadokAdapter(),
  CRYPTOPRO_DSS: () => new MockCryptoproAdapter(),
  BANK: () => new MockBankAdapter(),
  GPS: () => new MockGpsAdapter(),
  FTS: () => new MockFtsAdapter(),
  RSHN: () => new MockRshnAdapter(),
  AML_ROSFINMONITORING: () => new MockAmlAdapter(),
  RZD_ETRAN: () => new MockRzdEtranAdapter(),
  GIS_EPD: () => new MockGisEpdAdapter(),
  BKI_NBKI: () => new MockBkiAdapter(),
  TAKSKOM: () => new MockTakskomAdapter('TAKSKOM'),
  MARINE_TRAFFIC: () => new MockMarineAdapter(),
  SMEV: () => new MockSmevAdapter(),
};

export interface ConfigureResult {
  readonly live: AdapterName[];
  readonly stub: AdapterName[];
  readonly disabled: AdapterName[];
  /** Integrations that no env value can promote — see `QUARANTINED_ADAPTERS`. */
  readonly quarantined: AdapterName[];
}

/**
 * Integrations whose legacy adapter was retired because it did not match the
 * official external contract. They stay fail-closed regardless of `<NAME>_MODE`:
 * an operator cannot re-enable an invented transport by setting an env var.
 */
export const QUARANTINED_ADAPTERS: readonly AdapterName[] = ['FGIS_ZERNO'];

/**
 * Registered in place of a real adapter when `<NAME>_MODE=disabled`. Any call
 * fails loudly rather than silently falling back to the pre-registered mock, so
 * an operator who disabled an integration gets a hard stop, not a working mock.
 */
class DisabledAdapter implements IntegrationAdapter {
  readonly mode: AdapterMode = 'disabled';
  readonly version = '0.0.0-disabled';
  constructor(readonly name: string) {}
  private fail(): never {
    throw new Error(
      `Integration "${this.name}" is disabled (${this.name}_MODE=disabled). ` +
        `Set ${this.name}_MODE=stub|sandbox|live to use it.`,
    );
  }
  async execute(): Promise<never> {
    return this.fail();
  }
  async healthCheck(): Promise<HealthStatus> {
    return { status: 'down', lastCheckedAt: new Date().toISOString(), detail: 'disabled' };
  }
}

const ALL_ADAPTER_NAMES: AdapterName[] = [
  'FGIS_ZERNO', 'FNS', 'DIADOK', 'CRYPTOPRO_DSS', 'BANK', 'GPS', 'FTS', 'RSHN',
  'AML_ROSFINMONITORING', 'RZD_ETRAN', 'GIS_EPD', 'BKI_NBKI', 'TAKSKOM', 'MARINE_TRAFFIC', 'SMEV',
];

/**
 * Reads env and registers a hard-stop adapter by default. A mock is installed
 * only for explicit stub mode. Live/sandbox modes require a live factory and
 * complete configuration (fail-closed).
 */
export function configureIntegrationsFromEnv(
  env: Env = process.env,
  deps: BuildClientDeps = {},
  registry = integrationRegistry,
): ConfigureResult {
  const result: ConfigureResult = { live: [], stub: [], disabled: [], quarantined: [] };

  for (const name of ALL_ADAPTER_NAMES) {
    if (QUARANTINED_ADAPTERS.includes(name)) {
      // Evaluated before the mode switch on purpose: `stub` must not hand back
      // a mock, and `live`/`sandbox` must not silently downgrade to one either.
      registry.register(name, new QuarantinedFgisZernoAdapter());
      result.quarantined.push(name);
      const requested = resolveIntegrationConfig(name, env).mode;
      if (requested === 'live' || requested === 'sandbox') {
        throw new LegacyFgisQuarantineError(
          `Integration "${name}" cannot be set to mode="${requested}": its legacy ` +
            'REST adapter was retired because the official contract is SOAP 1.1 ' +
            `(SendRequest/SendResponse/Ack). Real exchange is served only by ${FGIS_CANONICAL_CONTOUR}.`,
        );
      }
      continue;
    }
    const config = resolveIntegrationConfig(name, env);
    if (config.mode === 'disabled') {
      registry.register(name, new DisabledAdapter(name));
      result.disabled.push(name);
      continue;
    }
    if (config.mode === 'stub') {
      const factory = STUB_ADAPTER_FACTORIES[name];
      if (!factory) {
        throw new Error(`Integration "${name}" is set to mode="stub" but has no explicit stub factory.`);
      }
      registry.register(name, factory());
      result.stub.push(name);
      continue;
    }
    // live | sandbox → need a live implementation + valid config
    const factory = LIVE_ADAPTER_FACTORIES[name];
    if (!factory) {
      throw new Error(
        `Integration "${name}" is set to mode="${config.mode}" but no Live${toPascal(name)}Adapter is implemented yet. ` +
          `Implement it from the reference pattern (LiveBankAdapter) and register it in LIVE_ADAPTER_FACTORIES, ` +
          `or set ${name}_MODE=stub. See INTEGRATION_CONNECT_GUIDE.md.`,
      );
    }
    const client = buildHttpClient(config, deps); // assertLiveReady inside → fail-closed on missing creds
    registry.register(name, factory(client));
    result.live.push(name);
  }

  return result;
}

function toPascal(name: string): string {
  return name
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * Mode-aware wiring: given the environment, swap the default mock adapters in the
 * registry for live ones where `<NAME>_MODE` is `live`/`sandbox` and a live
 * implementation exists. Fail-loud (never silently mock) when live is requested
 * for an adapter whose live class is not yet implemented.
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
  readonly mode: AdapterMode = 'mock';
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
 * Reads env and, for each adapter set to live/sandbox with an available factory,
 * registers a live adapter (replacing the mock). Throws if live is requested but
 * the live class is missing, or if required config is absent (fail-closed).
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
      // Replace the pre-registered mock with a hard-stop adapter so a disabled
      // integration cannot be executed by accident.
      registry.register(name, new DisabledAdapter(name));
      result.disabled.push(name);
      continue;
    }
    if (config.mode === 'stub') {
      result.stub.push(name); // keep the already-registered mock
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

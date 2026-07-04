/**
 * Mode-aware wiring: given the environment, swap the default mock adapters in the
 * registry for live ones where `<NAME>_MODE` is `live`/`sandbox` and a live
 * implementation exists. Fail-loud (never silently mock) when live is requested
 * for an adapter whose live class is not yet implemented.
 */

import type { IntegrationAdapter } from '../adapter.interface';
import { integrationRegistry, type AdapterName } from '../registry';
import { buildHttpClient, type BuildClientDeps } from './build-client';
import { resolveIntegrationConfig, type Env } from './integration-config';
import { HttpIntegrationClient } from './http-integration-client';
import { LiveBankAdapter } from './live-bank.adapter';
import { LiveFgisZernoAdapter } from './live-fgis-zerno.adapter';

/**
 * Live adapter factories. Implemented so far: BANK, FGIS_ZERNO (reference
 * pattern). The remaining adapters follow the exact same shape — add a
 * `Live<Name>Adapter` and register it here. See INTEGRATION_CONNECT_GUIDE.md.
 */
export const LIVE_ADAPTER_FACTORIES: Partial<Record<AdapterName, (http: HttpIntegrationClient) => IntegrationAdapter>> = {
  BANK: (http) => new LiveBankAdapter(http),
  FGIS_ZERNO: (http) => new LiveFgisZernoAdapter(http),
};

export interface ConfigureResult {
  readonly live: AdapterName[];
  readonly stub: AdapterName[];
  readonly disabled: AdapterName[];
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
  const result: ConfigureResult = { live: [], stub: [], disabled: [] };

  for (const name of ALL_ADAPTER_NAMES) {
    const config = resolveIntegrationConfig(name, env);
    if (config.mode === 'disabled') {
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

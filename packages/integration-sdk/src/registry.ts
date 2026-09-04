import { IntegrationAdapter, HealthStatus } from './adapter.interface';
import { QuarantinedFgisZernoAdapter } from './quarantine/fgis-zerno-legacy';

export type AdapterName = 'FGIS_ZERNO' | 'FNS' | 'DIADOK' | 'CRYPTOPRO_DSS' | 'BANK' | 'GPS' | 'FTS' | 'RSHN' | 'AML_ROSFINMONITORING' | 'RZD_ETRAN' | 'GIS_EPD' | 'BKI_NBKI' | 'TAKSKOM' | 'MARINE_TRAFFIC' | 'SMEV';

export class IntegrationRegistry {
  private readonly adapters = new Map<AdapterName, IntegrationAdapter>();

  register(name: AdapterName, adapter: IntegrationAdapter): void {
    this.adapters.set(name, adapter);
  }

  get<T extends IntegrationAdapter = IntegrationAdapter>(name: AdapterName): T {
    const adapter = this.adapters.get(name);
    if (!adapter) throw new Error(`Integration adapter '${name}' not registered`);
    return adapter as T;
  }

  has(name: AdapterName): boolean {
    return this.adapters.has(name);
  }

  async healthCheckAll(): Promise<Record<AdapterName, HealthStatus>> {
    const results: Partial<Record<AdapterName, HealthStatus>> = {};
    await Promise.all(
      Array.from(this.adapters.entries()).map(async ([name, adapter]) => {
        try {
          results[name] = await adapter.healthCheck();
        } catch (err) {
          results[name] = {
            status: 'down',
            lastCheckedAt: new Date().toISOString(),
            detail: err instanceof Error ? err.message : 'Unknown error',
          };
        }
      })
    );
    return results as Record<AdapterName, HealthStatus>;
  }

  listAdapters(): Array<{
    name: AdapterName;
    mode: string;
    version: string;
    quarantined: boolean;
  }> {
    return Array.from(this.adapters.entries()).map(([name, a]) => ({
      name,
      mode: a.mode,
      version: a.version,
      // Surfaced so a status projection can tell "a mock stands in for this
      // integration" apart from "this integration is withdrawn and fails
      // closed". Rendering the second as sandbox would overstate readiness.
      quarantined: (a as { isQuarantined?: boolean }).isQuarantined === true,
    }));
  }
}

/**
 * Process adapter instances are mechanics, not binding or maturity authority.
 * The exported process registry starts with only the permanently quarantined
 * FGIS transport. Every other adapter must be bound explicitly by startup
 * configuration; importing this module can no longer make a mock callable.
 */
export function createIntegrationRegistry(): IntegrationRegistry {
  const registry = new IntegrationRegistry();
  registry.register('FGIS_ZERNO', new QuarantinedFgisZernoAdapter());
  return registry;
}

export const integrationRegistry = createIntegrationRegistry();

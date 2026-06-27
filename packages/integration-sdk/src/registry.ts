import { IntegrationAdapter, HealthStatus } from './adapter.interface';
import { MockFgisZernoAdapter } from './adapters/fgis-zerno.adapter';
import { MockFnsAdapter } from './adapters/fns.adapter';
import { MockDiadokAdapter } from './adapters/diadok.adapter';
import { MockCryptoproAdapter } from './adapters/cryptopro.adapter';
import { MockBankAdapter } from './adapters/bank.adapter';
import { MockGpsAdapter } from './adapters/gps.adapter';
import { MockFtsAdapter } from './adapters/fts.adapter';
import { MockRshnAdapter } from './adapters/rshn.adapter';
import { MockAmlAdapter } from './adapters/aml.adapter';
import { MockRzdEtranAdapter } from './adapters/rzd-etran.adapter';
import { MockGisEpdAdapter } from './adapters/gis-epd.adapter';

export type AdapterName = 'FGIS_ZERNO' | 'FNS' | 'DIADOK' | 'CRYPTOPRO_DSS' | 'BANK' | 'GPS' | 'FTS' | 'RSHN' | 'AML_ROSFINMONITORING' | 'RZD_ETRAN' | 'GIS_EPD';

class IntegrationRegistry {
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

  listAdapters(): Array<{ name: AdapterName; mode: string; version: string }> {
    return Array.from(this.adapters.entries()).map(([name, a]) => ({
      name,
      mode: a.mode,
      version: a.version,
    }));
  }
}

// Singleton registry populated with mock adapters by default
export const integrationRegistry = new IntegrationRegistry();

// Register all mock adapters — replace with live adapters via env flag
integrationRegistry.register('FGIS_ZERNO', new MockFgisZernoAdapter());
integrationRegistry.register('FNS', new MockFnsAdapter());
integrationRegistry.register('DIADOK', new MockDiadokAdapter());
integrationRegistry.register('CRYPTOPRO_DSS', new MockCryptoproAdapter());
integrationRegistry.register('BANK', new MockBankAdapter());
integrationRegistry.register('GPS', new MockGpsAdapter());
integrationRegistry.register('FTS', new MockFtsAdapter());
integrationRegistry.register('RSHN', new MockRshnAdapter());
integrationRegistry.register('AML_ROSFINMONITORING', new MockAmlAdapter());
integrationRegistry.register('RZD_ETRAN', new MockRzdEtranAdapter());
integrationRegistry.register('GIS_EPD', new MockGisEpdAdapter());

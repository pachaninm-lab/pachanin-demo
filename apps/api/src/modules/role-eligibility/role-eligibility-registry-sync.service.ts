import { Injectable } from '@nestjs/common';
import { CbrRegistryAdapter } from './adapters/cbr-registry.adapter';
import { FgisGrainAdapter } from './adapters/fgis-grain.adapter';
import { FnsEvidenceAdapter } from './adapters/fns-evidence.adapter';
import { AccreditationAdapter } from './adapters/accreditation.adapter';
import { RoleEligibilityRegistryRepository } from './role-eligibility-registry.repository';
import { RoleEligibilitySourceHealthService } from './role-eligibility-source-health.service';
import { EligibilitySourceError, type EligibilitySource, type RegistryAdapterFetchResult } from './role-eligibility.types';

const FRESHNESS_MS: Record<EligibilitySource, number> = {
  CBR: 48 * 60 * 60 * 1000,
  FNS: 48 * 60 * 60 * 1000,
  FGIS_GRAIN: 400 * 24 * 60 * 60 * 1000,
  ROSACCREDITATION: 7 * 24 * 60 * 60 * 1000,
};

type Adapter = { source: EligibilitySource; fetchGeneration(): Promise<RegistryAdapterFetchResult> };

@Injectable()
export class RoleEligibilityRegistrySyncService {
  private readonly adapters: Record<EligibilitySource, Adapter>;

  constructor(
    cbr: CbrRegistryAdapter,
    fgis: FgisGrainAdapter,
    fns: FnsEvidenceAdapter,
    accreditation: AccreditationAdapter,
    private readonly registry: RoleEligibilityRegistryRepository,
    private readonly health: RoleEligibilitySourceHealthService,
  ) {
    this.adapters = { CBR: cbr, FGIS_GRAIN: fgis, FNS: fns, ROSACCREDITATION: accreditation };
  }

  async sync(source: EligibilitySource) {
    await this.health.assertFetchAllowed(source);
    const adapter = this.adapters[source];
    try {
      const fetched = await adapter.fetchGeneration();
      if (fetched.source !== source) throw new EligibilitySourceError(source, `${source}_ADAPTER_SOURCE_MISMATCH`, 'SCHEMA_CHANGED');
      if (!/^[0-9a-f]{64}$/.test(fetched.contentSha256)) throw new EligibilitySourceError(source, `${source}_CONTENT_HASH_INVALID`, 'SCHEMA_CHANGED');
      if (!fetched.records.length) throw new EligibilitySourceError(source, `${source}_EMPTY_REGISTRY`, 'SCHEMA_CHANGED');
      const freshUntil = new Date(fetched.publishedAt.getTime() + FRESHNESS_MS[source]);
      const staged = await this.registry.stage(fetched, freshUntil);
      const active = await this.registry.validateAndActivate(staged.id);
      await this.health.success(source, {
        generation: active.generation,
        parserVersion: active.parserVersion,
        schemaVersion: active.schemaVersion,
        freshUntil: active.freshUntil,
      });
      return { source, status: 'ACTIVE' as const, generation: active.generation, records: active.recordCount.toString(), contentSha256: active.contentSha256, freshUntil: active.freshUntil };
    } catch (error) {
      const typed = error instanceof EligibilitySourceError
        ? error
        : new EligibilitySourceError(source, error instanceof Error ? error.message : `${source}_UNKNOWN_FAILURE`, 'UNAVAILABLE');
      await this.health.failure(source, typed.health, typed.code);
      throw typed;
    }
  }

  async syncAll(): Promise<Array<{ source: EligibilitySource; ok: boolean; result?: unknown; errorCode?: string }>> {
    const output: Array<{ source: EligibilitySource; ok: boolean; result?: unknown; errorCode?: string }> = [];
    for (const source of Object.keys(this.adapters) as EligibilitySource[]) {
      try {
        output.push({ source, ok: true, result: await this.sync(source) });
      } catch (error) {
        output.push({ source, ok: false, errorCode: error instanceof EligibilitySourceError ? error.code : `${source}_SYNC_FAILED` });
      }
    }
    return output;
  }
}

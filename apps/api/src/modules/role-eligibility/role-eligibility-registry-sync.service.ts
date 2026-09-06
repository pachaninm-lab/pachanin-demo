import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CbrRegistryAdapter } from './adapters/cbr-registry.adapter';
import { FgisGrainAdapter } from './adapters/fgis-grain.adapter';
import { FnsEvidenceAdapter } from './adapters/fns-evidence.adapter';
import { AccreditationAdapter } from './adapters/accreditation.adapter';
import { RoleEligibilityRegistryRepository } from './role-eligibility-registry.repository';
import { RoleEligibilitySourceHealthService } from './role-eligibility-source-health.service';
import {
  EligibilitySourceError,
  type EligibilitySource,
  type RegistryAdapterFetchResult,
  type RegistryGeneration,
  type SourceHealthSnapshot,
} from './role-eligibility.types';

const FRESHNESS_MS: Readonly<Record<EligibilitySource, number>> = Object.freeze({
  CBR: 45 * 24 * 60 * 60 * 1000,
  FNS: 35 * 24 * 60 * 60 * 1000,
  FGIS_GRAIN: 14 * 24 * 60 * 60 * 1000,
  ROSACCREDITATION: 48 * 60 * 60 * 1000,
});

const MAX_FETCH_ATTEMPTS = 3;
const RETRY_BASE_MS = 300;
const RETRY_MAX_MS = 2_500;
const FNS_UNPROVEN_MACHINE_CONTRACT = 'FNS_ZERO_COST_MACHINE_CONTRACT_NOT_PROVEN';
const FNS_EGRUL_PRESERVATION_AUDIT_FAILED = 'FNS_EGRUL_PRESERVATION_AUDIT_FAILED';
const FILE_BACKED_EGRUL_SCHEMAS = new Set(['EGRUL_408', 'EGRUL_407']);
const FILE_BACKED_EGRUL_PARSER_VERSIONS = new Set(['fns-egrul-v1']);

type Adapter = { source: EligibilitySource; fetchGeneration(): Promise<RegistryAdapterFetchResult> };

function retryableFetchFailure(error: unknown): boolean {
  const code = error instanceof EligibilitySourceError
    ? error.code
    : error instanceof Error ? error.message : String(error || 'UNKNOWN');
  if (error instanceof EligibilitySourceError && error.health === 'SCHEMA_CHANGED') return false;
  if (/NOT_PROVEN|MACHINE_CONTRACT|TRANSPORT_NOT_PROVEN|SCHEMA|COLUMN|HEADER|CARDINALITY|DUPLICATE|EMPTY_REGISTRY|PUBLISHED_SNAPSHOT_STALE|CONTENT_HASH_INVALID/i.test(code)) {
    return false;
  }
  return true;
}

function retryDelayMs(attempt: number): number {
  const exponential = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1));
  const jitter = 0.75 + Math.random() * 0.5;
  return Math.max(RETRY_BASE_MS, Math.floor(exponential * jitter));
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

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

  private async preservedFileBackedFnsGeneration(
    source: EligibilitySource,
    error: unknown,
    stagedId: string | null,
  ): Promise<RegistryGeneration | null> {
    if (
      source !== 'FNS'
      || !(error instanceof EligibilitySourceError)
      || error.source !== 'FNS'
      || error.code !== FNS_UNPROVEN_MACHINE_CONTRACT
      || error.health !== 'UNAVAILABLE'
      || stagedId !== null
    ) return null;

    let active: RegistryGeneration | null;
    let sourceHealth: SourceHealthSnapshot | null;
    try {
      active = await this.registry.active('FNS');
      sourceHealth = await this.health.get('FNS');
    } catch {
      return null;
    }

    if (!active || active.status !== 'ACTIVE') return null;
    if (!FILE_BACKED_EGRUL_SCHEMAS.has(active.schemaVersion)) return null;
    if (!FILE_BACKED_EGRUL_PARSER_VERSIONS.has(active.parserVersion)) return null;
    if (active.freshUntil.getTime() <= Date.now()) return null;
    if (!sourceHealth || sourceHealth.status !== 'HEALTHY' || sourceHealth.circuitState !== 'CLOSED') return null;
    if (sourceHealth.activeGeneration !== active.generation) return null;
    if (sourceHealth.parserVersion !== active.parserVersion) return null;
    if (sourceHealth.schemaVersion !== active.schemaVersion) return null;
    if (!sourceHealth.freshUntil || sourceHealth.freshUntil.getTime() !== active.freshUntil.getTime()) return null;
    if (sourceHealth.freshUntil.getTime() <= Date.now()) return null;
    if (sourceHealth.consecutiveFailures !== 0 || sourceHealth.lastErrorCode !== null) return null;

    return active;
  }

  async sync(source: EligibilitySource) {
    await this.health.assertFetchAllowed(source);
    const adapter = this.adapters[source];
    const correlationId = `registry-sync:${source}:${randomUUID()}`;
    let stagedId: string | null = null;
    let fetchAttempts = 0;
    await this.registry.auditSourceEvent('ROLE_ELIGIBILITY_SOURCE_FETCH_STARTED', source, correlationId);
    try {
      let fetched: RegistryAdapterFetchResult | null = null;
      let lastFetchError: unknown = null;
      for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
        fetchAttempts = attempt;
        try {
          fetched = await adapter.fetchGeneration();
          break;
        } catch (error) {
          lastFetchError = error;
          if (attempt >= MAX_FETCH_ATTEMPTS || !retryableFetchFailure(error)) throw error;
          await sleep(retryDelayMs(attempt));
        }
      }
      if (!fetched) throw lastFetchError ?? new Error(`${source}_FETCH_EXHAUSTED`);

      if (fetched.source !== source) throw new EligibilitySourceError(source, `${source}_ADAPTER_SOURCE_MISMATCH`, 'SCHEMA_CHANGED');
      if (!/^[0-9a-f]{64}$/.test(fetched.contentSha256)) throw new EligibilitySourceError(source, `${source}_CONTENT_HASH_INVALID`, 'SCHEMA_CHANGED');
      if (!fetched.records.length) throw new EligibilitySourceError(source, `${source}_EMPTY_REGISTRY`, 'SCHEMA_CHANGED');
      const freshUntil = new Date(fetched.publishedAt.getTime() + FRESHNESS_MS[source]);
      if (freshUntil.getTime() <= Date.now()) {
        throw new EligibilitySourceError(source, `${source}_PUBLISHED_SNAPSHOT_STALE`, 'DEGRADED');
      }
      const staged = await this.registry.stage(fetched, freshUntil);
      stagedId = staged.id;
      const active = await this.registry.validateAndActivate(staged.id);
      await this.health.success(source, {
        generation: active.generation,
        parserVersion: active.parserVersion,
        schemaVersion: active.schemaVersion,
        freshUntil: active.freshUntil,
      });
      await this.registry.auditSourceEvent('ROLE_ELIGIBILITY_SOURCE_FETCH_SUCCEEDED', source, correlationId, {
        generation: active.generation,
        contentSha256: active.contentSha256,
        recordCount: active.recordCount.toString(),
        parserVersion: active.parserVersion,
        schemaVersion: active.schemaVersion,
        publishedAt: active.publishedAt.toISOString(),
        freshUntil: active.freshUntil.toISOString(),
        fetchAttempts,
      });
      return {
        source,
        status: 'ACTIVE' as const,
        generation: active.generation,
        records: active.recordCount.toString(),
        contentSha256: active.contentSha256,
        freshUntil: active.freshUntil,
        fetchAttempts,
      };
    } catch (error) {
      const typed = error instanceof EligibilitySourceError
        ? error
        : new EligibilitySourceError(source, error instanceof Error ? error.message : `${source}_UNKNOWN_FAILURE`, 'UNAVAILABLE');
      if (stagedId) await this.registry.reject(stagedId);

      const preserved = await this.preservedFileBackedFnsGeneration(source, error, stagedId);
      if (preserved) {
        try {
          await this.registry.auditSourceEvent('ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED', source, correlationId, {
            errorCode: typed.code,
            health: typed.health,
            stagedGenerationId: stagedId,
            fetchAttempts,
            healthPreserved: true,
            preservationReason: FNS_UNPROVEN_MACHINE_CONTRACT,
            preservedGeneration: preserved.generation,
            preservedContentSha256: preserved.contentSha256,
            preservedParserVersion: preserved.parserVersion,
            preservedSchemaVersion: preserved.schemaVersion,
            preservedFreshUntil: preserved.freshUntil.toISOString(),
          });
        } catch {
          await this.health.failure(source, 'UNAVAILABLE', FNS_EGRUL_PRESERVATION_AUDIT_FAILED);
          throw new EligibilitySourceError(source, FNS_EGRUL_PRESERVATION_AUDIT_FAILED, 'UNAVAILABLE');
        }
        throw typed;
      }

      await this.health.failure(source, typed.health, typed.code);
      await this.registry.auditSourceEvent('ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED', source, correlationId, {
        errorCode: typed.code,
        health: typed.health,
        stagedGenerationId: stagedId,
        fetchAttempts,
      });
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

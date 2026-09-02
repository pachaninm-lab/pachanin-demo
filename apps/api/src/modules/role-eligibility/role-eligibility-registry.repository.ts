import { Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sha256, stableJson } from './role-eligibility-security';
import type {
  EligibilitySource,
  RegistryAdapterFetchResult,
  RegistryGeneration,
  SourceHealthSnapshot,
} from './role-eligibility.types';

type SqlClient = Pick<PrismaClient, '$queryRaw' | '$executeRaw' | '$executeRawUnsafe'>;
type GenerationRow = {
  id: string; source: EligibilitySource; generation: string; published_at: Date; downloaded_at: Date;
  content_sha256: string; record_count: bigint; parser_version: string; schema_version: string;
  status: RegistryGeneration['status']; fresh_until: Date;
};

const BULK_INSERT_ROWS = 500;

const mapGeneration = (row: GenerationRow): RegistryGeneration => ({
  id: row.id,
  source: row.source,
  generation: row.generation,
  publishedAt: row.published_at,
  downloadedAt: row.downloaded_at,
  contentSha256: row.content_sha256,
  recordCount: row.record_count,
  parserVersion: row.parser_version,
  schemaVersion: row.schema_version,
  status: row.status,
  freshUntil: row.fresh_until,
});

@Injectable()
export class RoleEligibilityRegistryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private runtime<T>(task: (client: SqlClient) => Promise<T>, serializable = false): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE pc_role_eligibility_runtime');
      return task(tx as unknown as SqlClient);
    }, serializable ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } : undefined);
  }

  async stage(payload: RegistryAdapterFetchResult, freshUntil: Date): Promise<RegistryGeneration> {
    return this.runtime(async (client) => {
      const generation = `${payload.publishedAt.toISOString()}:${payload.contentSha256.slice(0, 16)}`;
      const generationId = `elg_${sha256(`${payload.source}\u001f${generation}`).slice(0, 36)}`;
      const existing = await client.$queryRaw<GenerationRow[]>(Prisma.sql`
        SELECT * FROM eligibility.registry_generations
        WHERE source=${payload.source} AND generation=${generation}
        LIMIT 1
      `);
      if (existing[0]) return mapGeneration(existing[0]);

      await client.$executeRaw(Prisma.sql`
        INSERT INTO eligibility.registry_generations (
          id,source,generation,published_at,downloaded_at,content_sha256,record_count,
          parser_version,schema_version,status,fresh_until,created_at
        ) VALUES (
          ${generationId},${payload.source},${generation},${payload.publishedAt},${payload.checkedAt},${payload.contentSha256},
          ${BigInt(payload.records.length)},${payload.parserVersion},${payload.schemaVersion},'STAGING',${freshUntil},clock_timestamp()
        )
      `);

      for (let offset = 0; offset < payload.records.length; offset += BULK_INSERT_ROWS) {
        const chunk = payload.records.slice(offset, offset + BULK_INSERT_ROWS);
        const values = chunk.map((record) => {
          const payloadSha256 = sha256(stableJson(record.normalizedPayload));
          const id = `elr_${sha256(`${generationId}\u001f${record.sourceRecordId}\u001f${record.recordType}\u001f${payloadSha256}`).slice(0, 36)}`;
          return Prisma.sql`(
            ${id},${generationId},${payload.source},${record.sourceRecordId},${record.subjectInn},${record.subjectOgrn},
            ${record.recordType},${JSON.stringify(record.normalizedPayload)}::jsonb,${payload.publishedAt},
            ${record.validFrom},${record.validUntil},${payloadSha256},clock_timestamp()
          )`;
        });
        if (values.length) {
          await client.$executeRaw(Prisma.sql`
            INSERT INTO eligibility.registry_records (
              id,generation_id,source,source_record_id,subject_inn,subject_ogrn,record_type,normalized_payload,
              source_published_at,valid_from,valid_until,payload_sha256,created_at
            ) VALUES ${Prisma.join(values)}
          `);
        }
      }

      const rows = await client.$queryRaw<GenerationRow[]>(Prisma.sql`
        SELECT * FROM eligibility.registry_generations WHERE id=${generationId}
      `);
      return mapGeneration(rows[0]);
    }, true);
  }

  async validateAndActivate(generationId: string): Promise<RegistryGeneration> {
    return this.runtime(async (client) => {
      const rows = await client.$queryRaw<GenerationRow[]>(Prisma.sql`
        SELECT * FROM eligibility.registry_generations WHERE id=${generationId} FOR UPDATE
      `);
      if (!rows[0]) throw new Error('ROLE_ELIGIBILITY_GENERATION_NOT_FOUND');
      const generation = rows[0];
      if (!['STAGING', 'VALIDATED', 'ACTIVE'].includes(generation.status)) {
        throw new Error('ROLE_ELIGIBILITY_GENERATION_NOT_ACTIVATABLE');
      }
      const counts = await client.$queryRaw<Array<{ count: bigint; duplicate_records: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count,
               (COUNT(*) - COUNT(DISTINCT source_record_id || E'\\x1f' || record_type || E'\\x1f' || payload_sha256))::bigint AS duplicate_records
        FROM eligibility.registry_records WHERE generation_id=${generationId}
      `);
      if (counts[0]?.count !== generation.record_count) throw new Error('ROLE_ELIGIBILITY_GENERATION_CARDINALITY_MISMATCH');
      if ((counts[0]?.count || 0n) <= 0n) throw new Error('ROLE_ELIGIBILITY_EMPTY_GENERATION');
      if ((counts[0]?.duplicate_records || 0n) !== 0n) throw new Error('ROLE_ELIGIBILITY_GENERATION_DUPLICATE_RECORDS');

      if (generation.status === 'STAGING') {
        await client.$executeRaw(Prisma.sql`
          UPDATE eligibility.registry_generations
          SET status='VALIDATED',validated_at=clock_timestamp()
          WHERE id=${generationId} AND status='STAGING'
        `);
      }
      if (generation.status !== 'ACTIVE') {
        await client.$queryRaw(Prisma.sql`
          SELECT eligibility.activate_registry_generation(${generation.source},${generation.generation})
        `);
      }
      const activated = await client.$queryRaw<GenerationRow[]>(Prisma.sql`
        SELECT * FROM eligibility.registry_generations WHERE id=${generationId}
      `);
      return mapGeneration(activated[0]);
    }, true);
  }

  async reject(generationId: string): Promise<void> {
    await this.runtime(async (client) => {
      await client.$executeRaw(Prisma.sql`
        UPDATE eligibility.registry_generations
        SET status='REJECTED'
        WHERE id=${generationId} AND status IN ('STAGING','VALIDATED')
      `);
    }, true);
  }

  async auditSourceEvent(
    eventType: 'ROLE_ELIGIBILITY_SOURCE_FETCH_STARTED' | 'ROLE_ELIGIBILITY_SOURCE_FETCH_SUCCEEDED' | 'ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED',
    source: EligibilitySource,
    correlationId: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.runtime(async (client) => {
      await client.$executeRaw(Prisma.sql`
        INSERT INTO eligibility.audit_events(id,event_type,correlation_id,payload,created_at)
        VALUES (
          ${`ela_${randomUUID()}`},${eventType},${correlationId},
          ${JSON.stringify({ source, ...payload })}::jsonb,clock_timestamp()
        )
      `);
    });
  }

  async active(source: EligibilitySource): Promise<RegistryGeneration | null> {
    const rows = await this.runtime((client) => client.$queryRaw<GenerationRow[]>(Prisma.sql`
      SELECT * FROM eligibility.registry_generations WHERE source=${source} AND status='ACTIVE' LIMIT 1
    `));
    return rows[0] ? mapGeneration(rows[0]) : null;
  }

  async upsertHealth(snapshot: SourceHealthSnapshot): Promise<void> {
    await this.runtime(async (client) => {
      await client.$executeRaw(Prisma.sql`
        INSERT INTO eligibility.source_health (
          source,status,circuit_state,active_generation,parser_version,schema_version,last_success_at,last_failure_at,
          checked_at,fresh_until,consecutive_failures,last_error_code,updated_at
        ) VALUES (
          ${snapshot.source},${snapshot.status},${snapshot.circuitState},${snapshot.activeGeneration},${snapshot.parserVersion},
          ${snapshot.schemaVersion},${snapshot.lastSuccessAt},${snapshot.lastFailureAt},${snapshot.checkedAt},${snapshot.freshUntil},
          ${snapshot.consecutiveFailures},${snapshot.lastErrorCode},clock_timestamp()
        ) ON CONFLICT(source) DO UPDATE SET
          status=EXCLUDED.status,circuit_state=EXCLUDED.circuit_state,active_generation=EXCLUDED.active_generation,
          parser_version=EXCLUDED.parser_version,schema_version=EXCLUDED.schema_version,last_success_at=EXCLUDED.last_success_at,
          last_failure_at=EXCLUDED.last_failure_at,checked_at=EXCLUDED.checked_at,fresh_until=EXCLUDED.fresh_until,
          consecutive_failures=EXCLUDED.consecutive_failures,last_error_code=EXCLUDED.last_error_code,updated_at=clock_timestamp()
      `);
    });
  }
}

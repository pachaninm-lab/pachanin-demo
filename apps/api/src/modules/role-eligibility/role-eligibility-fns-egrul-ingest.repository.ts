import { Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { FnsEgrulNormalizedRecord, FnsEgrulFormat } from './adapters/fns-egrul-feed.parser';
import { RoleEligibilityRegistryRepository } from './role-eligibility-registry.repository';
import { sha256, stableJson } from './role-eligibility-security';

const MAX_APPEND_ROWS = 500;

type SqlClient = Pick<PrismaClient, '$queryRaw' | '$executeRaw'>;
type GenerationState = {
  id: string;
  source: string;
  status: string;
  published_at: Date;
  content_sha256: string;
  parser_version: string;
  schema_version: string;
  record_count: bigint;
};
type ExistingRecord = {
  source_record_id: string;
  subject_ogrn: string | null;
  payload_sha256: string;
  record_type: string;
};
type CountRow = { count: bigint; unmatched?: bigint };

export type FnsEgrulGenerationInput = {
  publishedAt: Date;
  downloadedAt: Date;
  contentSha256: string;
  format: FnsEgrulFormat;
  parserVersion: string;
  freshUntil: Date;
};

function desiredRecords(records: readonly FnsEgrulNormalizedRecord[]): Array<{
  record: FnsEgrulNormalizedRecord;
  payloadSha256: string;
}> {
  const batchOgrns = new Set<string>();
  return records.map((record) => {
    if (record.recordType !== 'EGRUL_LEGAL_ENTITY') throw new Error('FNS_EGRUL_RECORD_TYPE_INVALID');
    if (record.sourceRecordId !== record.subjectOgrn) throw new Error('FNS_EGRUL_SOURCE_ID_OGRN_MISMATCH');
    if (batchOgrns.has(record.subjectOgrn)) throw new Error('FNS_EGRUL_APPEND_DUPLICATE_OGRN');
    batchOgrns.add(record.subjectOgrn);
    return { record, payloadSha256: sha256(stableJson(record.normalizedPayload)) };
  });
}

@Injectable()
export class RoleEligibilityFnsEgrulIngestRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RoleEligibilityRegistryRepository,
  ) {}

  private runtime<T>(task: (client: SqlClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => task(tx as unknown as SqlClient));
  }

  async begin(input: FnsEgrulGenerationInput): Promise<{ id: string; generation: string; alreadyActive: boolean }> {
    if (!/^[0-9a-f]{64}$/.test(input.contentSha256)) throw new Error('FNS_EGRUL_CONTENT_HASH_INVALID');
    if (!input.parserVersion.trim()) throw new Error('FNS_EGRUL_PARSER_VERSION_REQUIRED');
    if (input.freshUntil.getTime() <= input.publishedAt.getTime()) throw new Error('FNS_EGRUL_FRESHNESS_WINDOW_INVALID');

    const generation = `${input.publishedAt.toISOString()}:${input.contentSha256.slice(0, 16)}`;
    const id = `elg_${sha256(`FNS\u001f${generation}`).slice(0, 36)}`;
    const schemaVersion = `EGRUL_${input.format.replace('.', '')}`;
    let alreadyActive = false;

    await this.runtime(async (client) => {
      await client.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0)) IS NULL AS locked
      `);

      const existing = await client.$queryRaw<GenerationState[]>(Prisma.sql`
        SELECT id,source,status,published_at,content_sha256,parser_version,schema_version,record_count
        FROM eligibility.registry_generations
        WHERE id=${id}
        LIMIT 1
      `);
      if (existing[0]) {
        const row = existing[0];
        const identical = row.source === 'FNS'
          && row.content_sha256 === input.contentSha256
          && row.parser_version === input.parserVersion
          && row.schema_version === schemaVersion
          && row.published_at.getTime() === input.publishedAt.getTime();
        if (!identical) throw new Error('FNS_EGRUL_GENERATION_IDENTITY_CONFLICT');
        if (row.status === 'STAGING') return;
        if (row.status === 'ACTIVE') {
          alreadyActive = true;
          return;
        }
        throw new Error('FNS_EGRUL_GENERATION_ALREADY_EXISTS_NOT_RESUMABLE');
      }

      await client.$executeRaw(Prisma.sql`
        INSERT INTO eligibility.registry_generations (
          id,source,generation,published_at,downloaded_at,content_sha256,record_count,
          parser_version,schema_version,status,fresh_until,created_at
        ) VALUES (
          ${id},'FNS',${generation},${input.publishedAt},${input.downloadedAt},${input.contentSha256},0,
          ${input.parserVersion},${schemaVersion},'STAGING',${input.freshUntil},clock_timestamp()
        )
      `);
    });

    return { id, generation, alreadyActive };
  }

  async append(generationId: string, records: readonly FnsEgrulNormalizedRecord[]): Promise<{ inserted: number; replayed: number }> {
    if (!records.length || records.length > MAX_APPEND_ROWS) throw new Error('FNS_EGRUL_APPEND_SIZE_INVALID');

    return this.runtime(async (client) => {
      const generations = await client.$queryRaw<GenerationState[]>(Prisma.sql`
        SELECT id,source,status,published_at,content_sha256,parser_version,schema_version,record_count
        FROM eligibility.registry_generations
        WHERE id=${generationId}
        FOR UPDATE
      `);
      const generation = generations[0];
      if (!generation || generation.source !== 'FNS') throw new Error('FNS_EGRUL_GENERATION_NOT_FOUND');
      if (generation.status !== 'STAGING') throw new Error('FNS_EGRUL_GENERATION_NOT_STAGING');

      const desired = desiredRecords(records);
      const sourceIds = desired.map(({ record }) => record.sourceRecordId);
      const existing = await client.$queryRaw<ExistingRecord[]>(Prisma.sql`
        SELECT source_record_id,subject_ogrn,payload_sha256,record_type
        FROM eligibility.registry_records
        WHERE generation_id=${generationId}
          AND source_record_id IN (${Prisma.join(sourceIds)})
      `);
      const bySourceId = new Map(existing.map((row) => [row.source_record_id, row]));

      const pending = desired.filter(({ record, payloadSha256 }) => {
        const row = bySourceId.get(record.sourceRecordId);
        if (!row) return true;
        if (
          row.subject_ogrn !== record.subjectOgrn
          || row.record_type !== record.recordType
          || row.payload_sha256 !== payloadSha256
        ) throw new Error('FNS_EGRUL_CONFLICTING_OGRN_RECORD');
        return false;
      });

      if (pending.length) {
        const values = pending.map(({ record, payloadSha256 }) => {
          const id = `elr_${sha256(`${generationId}\u001f${record.sourceRecordId}\u001f${record.recordType}\u001f${payloadSha256}`).slice(0, 36)}`;
          return Prisma.sql`(
            ${id},${generationId},'FNS',${record.sourceRecordId},${record.subjectInn},${record.subjectOgrn},
            ${record.recordType},${JSON.stringify(record.normalizedPayload)}::jsonb,${generation.published_at},
            ${record.validFrom},${record.validUntil},${payloadSha256},clock_timestamp()
          )`;
        });

        await client.$executeRaw(Prisma.sql`
          INSERT INTO eligibility.registry_records (
            id,generation_id,source,source_record_id,subject_inn,subject_ogrn,record_type,normalized_payload,
            source_published_at,valid_from,valid_until,payload_sha256,created_at
          ) VALUES ${Prisma.join(values)}
        `);
        await client.$executeRaw(Prisma.sql`
          UPDATE eligibility.registry_generations
          SET record_count=record_count + ${BigInt(pending.length)}
          WHERE id=${generationId} AND status='STAGING'
        `);
      }

      return { inserted: pending.length, replayed: records.length - pending.length };
    });
  }

  async inheritActiveBase(generationId: string): Promise<{
    baseGenerationId: string;
    inherited: number;
    replayed: boolean;
  }> {
    return this.runtime(async (client) => {
      const targetRows = await client.$queryRaw<GenerationState[]>(Prisma.sql`
        SELECT id,source,status,published_at,content_sha256,parser_version,schema_version,record_count
        FROM eligibility.registry_generations
        WHERE id=${generationId}
        FOR UPDATE
      `);
      const target = targetRows[0];
      if (!target || target.source !== 'FNS') throw new Error('FNS_EGRUL_GENERATION_NOT_FOUND');
      if (target.status !== 'STAGING') throw new Error('FNS_EGRUL_GENERATION_NOT_STAGING');

      const baseRows = await client.$queryRaw<GenerationState[]>(Prisma.sql`
        SELECT id,source,status,published_at,content_sha256,parser_version,schema_version,record_count
        FROM eligibility.registry_generations
        WHERE source='FNS' AND status='ACTIVE' AND id<>${generationId}
        ORDER BY published_at DESC,id DESC
        LIMIT 1
        FOR SHARE
      `);
      const base = baseRows[0];
      if (!base) throw new Error('FNS_EGRUL_ACTIVE_BASE_REQUIRED');
      if (base.published_at.getTime() >= target.published_at.getTime()) {
        throw new Error('FNS_EGRUL_DELTA_NOT_NEWER_THAN_BASE');
      }
      if (base.record_count <= 0n) throw new Error('FNS_EGRUL_ACTIVE_BASE_EMPTY');

      if (target.record_count > 0n) {
        const replayRows = await client.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count,
                 COUNT(*) FILTER (WHERE b.id IS NULL)::bigint AS unmatched
          FROM eligibility.registry_records AS t
          LEFT JOIN eligibility.registry_records AS b
            ON b.generation_id=${base.id}
           AND b.source='FNS'
           AND b.source_record_id=t.source_record_id
           AND b.record_type=t.record_type
           AND b.payload_sha256=t.payload_sha256
          WHERE t.generation_id=${generationId} AND t.source='FNS'
        `);
        const replay = replayRows[0];
        if (replay?.count === base.record_count && (replay.unmatched || 0n) === 0n) {
          return { baseGenerationId: base.id, inherited: Number(base.record_count), replayed: true };
        }
        throw new Error('FNS_EGRUL_DELTA_TARGET_ALREADY_INITIALIZED');
      }

      const inserted = await client.$executeRaw(Prisma.sql`
        INSERT INTO eligibility.registry_records (
          id,generation_id,source,source_record_id,subject_inn,subject_ogrn,record_type,normalized_payload,
          source_published_at,valid_from,valid_until,payload_sha256,created_at
        )
        SELECT
          ('elr_i_' || ${generationId} || '_' || r.id),${generationId},'FNS',r.source_record_id,r.subject_inn,r.subject_ogrn,
          r.record_type,r.normalized_payload,r.source_published_at,r.valid_from,r.valid_until,r.payload_sha256,clock_timestamp()
        FROM eligibility.registry_records AS r
        WHERE r.generation_id=${base.id} AND r.source='FNS'
        ORDER BY r.source_record_id,r.record_type,r.payload_sha256
      `);
      if (BigInt(inserted) !== base.record_count) throw new Error('FNS_EGRUL_BASE_COPY_CARDINALITY_MISMATCH');

      const updated = await client.$executeRaw(Prisma.sql`
        UPDATE eligibility.registry_generations
        SET record_count=${BigInt(inserted)}
        WHERE id=${generationId} AND source='FNS' AND status='STAGING' AND record_count=0
      `);
      if (updated !== 1) throw new Error('FNS_EGRUL_BASE_COPY_STATE_CHANGED');

      return { baseGenerationId: base.id, inherited: inserted, replayed: false };
    });
  }

  async applyDailyDelta(generationId: string, records: readonly FnsEgrulNormalizedRecord[]): Promise<{
    replaced: number;
    inserted: number;
  }> {
    if (!records.length || records.length > MAX_APPEND_ROWS) throw new Error('FNS_EGRUL_APPEND_SIZE_INVALID');
    const desired = desiredRecords(records);

    return this.runtime(async (client) => {
      const targetRows = await client.$queryRaw<GenerationState[]>(Prisma.sql`
        SELECT id,source,status,published_at,content_sha256,parser_version,schema_version,record_count
        FROM eligibility.registry_generations
        WHERE id=${generationId}
        FOR UPDATE
      `);
      const target = targetRows[0];
      if (!target || target.source !== 'FNS') throw new Error('FNS_EGRUL_GENERATION_NOT_FOUND');
      if (target.status !== 'STAGING') throw new Error('FNS_EGRUL_GENERATION_NOT_STAGING');

      const baseRows = await client.$queryRaw<GenerationState[]>(Prisma.sql`
        SELECT id,source,status,published_at,content_sha256,parser_version,schema_version,record_count
        FROM eligibility.registry_generations
        WHERE source='FNS' AND status='ACTIVE' AND id<>${generationId}
        ORDER BY published_at DESC,id DESC
        LIMIT 1
        FOR SHARE
      `);
      const base = baseRows[0];
      if (!base) throw new Error('FNS_EGRUL_ACTIVE_BASE_REQUIRED');
      if (base.published_at.getTime() >= target.published_at.getTime()) {
        throw new Error('FNS_EGRUL_DELTA_NOT_NEWER_THAN_BASE');
      }
      if (target.record_count < base.record_count) throw new Error('FNS_EGRUL_DELTA_BASE_NOT_INHERITED');

      const sourceIds = desired.map(({ record }) => record.sourceRecordId);
      const deleted = await client.$executeRaw(Prisma.sql`
        DELETE FROM eligibility.registry_records
        WHERE generation_id=${generationId}
          AND source='FNS'
          AND record_type='EGRUL_LEGAL_ENTITY'
          AND source_record_id IN (${Prisma.join(sourceIds)})
      `);

      const values = desired.map(({ record, payloadSha256 }) => {
        const id = `elr_${sha256(`${generationId}\u001f${record.sourceRecordId}\u001f${record.recordType}\u001f${payloadSha256}`).slice(0, 36)}`;
        return Prisma.sql`(
          ${id},${generationId},'FNS',${record.sourceRecordId},${record.subjectInn},${record.subjectOgrn},
          ${record.recordType},${JSON.stringify(record.normalizedPayload)}::jsonb,${target.published_at},
          ${record.validFrom},${record.validUntil},${payloadSha256},clock_timestamp()
        )`;
      });
      await client.$executeRaw(Prisma.sql`
        INSERT INTO eligibility.registry_records (
          id,generation_id,source,source_record_id,subject_inn,subject_ogrn,record_type,normalized_payload,
          source_published_at,valid_from,valid_until,payload_sha256,created_at
        ) VALUES ${Prisma.join(values)}
      `);

      const nextCount = target.record_count - BigInt(deleted) + BigInt(desired.length);
      if (nextCount <= 0n) throw new Error('FNS_EGRUL_DELTA_RESULT_EMPTY');
      const updated = await client.$executeRaw(Prisma.sql`
        UPDATE eligibility.registry_generations
        SET record_count=${nextCount}
        WHERE id=${generationId} AND source='FNS' AND status='STAGING'
      `);
      if (updated !== 1) throw new Error('FNS_EGRUL_DELTA_STATE_CHANGED');

      return { replaced: deleted, inserted: desired.length };
    });
  }

  async activate(generationId: string) {
    return this.registry.validateAndActivate(generationId);
  }

  async reject(generationId: string): Promise<void> {
    await this.registry.reject(generationId);
  }
}

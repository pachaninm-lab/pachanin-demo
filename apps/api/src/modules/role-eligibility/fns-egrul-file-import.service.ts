import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { constants as fsConstants, type Dirent } from 'node:fs';
import { open, readdir, realpath, type FileHandle } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  decodeFnsEgrulXml,
  type FnsEgrulFormat,
  parseFnsEgrulXml,
} from './adapters/fns-egrul-feed.parser';
import { RoleEligibilityFnsEgrulIngestRepository } from './role-eligibility-fns-egrul-ingest.repository';
import { RoleEligibilityRegistryRepository } from './role-eligibility-registry.repository';
import { sha256, stableJson } from './role-eligibility-security';
import { RoleEligibilitySourceHealthService } from './role-eligibility-source-health.service';
import type { RegistryGeneration } from './role-eligibility.types';

const MAX_IMPORT_FILES = 100_000;
const MAX_IMPORT_DEPTH = 4;
const MAX_XML_BYTES = 32 * 1024 * 1024;
const APPEND_ROWS = 500;
const DEFAULT_PARSER_VERSION = 'fns-egrul-v1';
const FNS_MAX_FRESHNESS_MS = 35 * 24 * 60 * 60 * 1000;
const FNS_ACTIVATION_LOCK = 'FNS_EGRUL_FULL_SNAPSHOT_ACTIVATION_V1';
const SERIALIZATION_MAX_ATTEMPTS = 3;
export const FNS_EGRUL_COVERAGE_AUTHORITY = 'FNS_SUBSCRIBER_REMOTE_INVENTORY_V1' as const;

type InspectedFile = {
  relativePath: string;
  size: number;
  sha256: string;
  publishedAt: Date;
  recordCount: number;
};

type GenerationCardinalityRow = {
  record_count: bigint;
  actual_count: bigint;
};

type GenerationRow = {
  id: string;
  source: string;
  generation: string;
  published_at: Date;
  downloaded_at: Date;
  content_sha256: string;
  record_count: bigint;
  parser_version: string;
  schema_version: string;
  status: RegistryGeneration['status'];
  fresh_until: Date;
};

type ActivationGenerationRow = GenerationRow & {
  fresh_at_activation: boolean;
};

type ActivationCountRow = {
  count: bigint;
  duplicate_records: bigint;
};

type FinalizedReplay = {
  generation: RegistryGeneration;
  successRecorded: boolean;
};

type ActivationOutcome = {
  generation: RegistryGeneration;
  alreadyActive: boolean;
};

export type FnsEgrulSnapshotManifest = {
  format: FnsEgrulFormat;
  publishedAt: Date;
  contentSha256: string;
  fileCount: number;
  recordCount: number;
  files: Array<{
    relativePath: string;
    size: number;
    sha256: string;
    publishedAt: string;
    recordCount: number;
  }>;
};

export type FnsEgrulCoverageProof = {
  authority: typeof FNS_EGRUL_COVERAGE_AUTHORITY;
  capturedAt: Date;
  publishedAt: Date;
  contentSha256: string;
  fileCount: number;
  recordCount: number;
};

export type FnsEgrulFullSnapshotImportInput = {
  directory: string;
  format: FnsEgrulFormat;
  freshUntil: Date;
  coverageProof: FnsEgrulCoverageProof;
  downloadedAt?: Date;
  parserVersion?: string;
};

export type FnsEgrulFullSnapshotImportResult = {
  generationId: string;
  generation: string;
  contentSha256: string;
  publishedAt: Date;
  fileCount: number;
  recordCount: number;
  inserted: number;
  replayed: number;
  alreadyActive: boolean;
};

function importError(code: string): Error {
  const error = new Error(code);
  error.name = 'FnsEgrulFileImportError';
  return error;
}

function stableFailureCode(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return /^[A-Z][A-Z0-9_]{2,127}$/u.test(code) ? code : 'FNS_EGRUL_IMPORT_FAILED';
}

function serializationConflict(error: unknown): boolean {
  const candidate = error && typeof error === 'object' ? error as Record<string, unknown> : null;
  const code = candidate?.code == null ? '' : String(candidate.code);
  const meta = candidate?.meta && typeof candidate.meta === 'object' ? candidate.meta as Record<string, unknown> : null;
  const metaCode = meta?.code == null ? '' : String(meta.code);
  const sqlState = candidate?.sqlState == null ? '' : String(candidate.sqlState);
  const message = error instanceof Error ? error.message : String(error || '');
  return code === 'P2034'
    || code === '40001'
    || metaCode === '40001'
    || sqlState === '40001'
    || /(?:P2034|40001|serialization failure|write conflict)/iu.test(message);
}

async function withSerializationRetry<T>(task: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (!serializationConflict(error)) throw error;
      if (attempt >= SERIALIZATION_MAX_ATTEMPTS) {
        throw importError('FNS_EGRUL_IMPORT_SERIALIZATION_RETRIES_EXHAUSTED');
      }
    }
  }
  throw importError('FNS_EGRUL_IMPORT_SERIALIZATION_RETRIES_EXHAUSTED');
}

function mapGeneration(row: GenerationRow): RegistryGeneration {
  return {
    id: row.id,
    source: 'FNS',
    generation: row.generation,
    publishedAt: row.published_at,
    downloadedAt: row.downloaded_at,
    contentSha256: row.content_sha256,
    recordCount: row.record_count,
    parserVersion: row.parser_version,
    schemaVersion: row.schema_version,
    status: row.status,
    freshUntil: row.fresh_until,
  };
}

function relativePosix(root: string, candidate: string): string {
  const value = relative(root, candidate);
  if (!value || value === '..' || value.startsWith(`..${sep}`) || isAbsolute(value)) {
    throw importError('FNS_EGRUL_IMPORT_PATH_ESCAPE');
  }
  return value.split(sep).join('/');
}

function generationMatchesManifest(row: GenerationRow, manifest: FnsEgrulSnapshotManifest): boolean {
  return row.content_sha256 === manifest.contentSha256
    && row.published_at.getTime() === manifest.publishedAt.getTime()
    && row.record_count === BigInt(manifest.recordCount);
}

function assertCoverageProof(
  manifest: FnsEgrulSnapshotManifest,
  proof: FnsEgrulCoverageProof | null | undefined,
  importStartedAt: Date,
): void {
  if (!proof || proof.authority !== FNS_EGRUL_COVERAGE_AUTHORITY) {
    throw importError('FNS_EGRUL_IMPORT_COVERAGE_PROOF_AUTHORITY_INVALID');
  }
  if (!(proof.capturedAt instanceof Date) || Number.isNaN(proof.capturedAt.getTime()) || proof.capturedAt.getTime() > importStartedAt.getTime()) {
    throw importError('FNS_EGRUL_IMPORT_COVERAGE_PROOF_CAPTURED_AT_INVALID');
  }
  if (!(proof.publishedAt instanceof Date) || Number.isNaN(proof.publishedAt.getTime())) {
    throw importError('FNS_EGRUL_IMPORT_COVERAGE_PROOF_PUBLISHED_AT_INVALID');
  }
  if (!/^[0-9a-f]{64}$/u.test(proof.contentSha256)) {
    throw importError('FNS_EGRUL_IMPORT_COVERAGE_PROOF_SHA256_INVALID');
  }
  if (!Number.isSafeInteger(proof.fileCount) || proof.fileCount <= 0) {
    throw importError('FNS_EGRUL_IMPORT_COVERAGE_PROOF_FILE_COUNT_INVALID');
  }
  if (!Number.isSafeInteger(proof.recordCount) || proof.recordCount <= 0) {
    throw importError('FNS_EGRUL_IMPORT_COVERAGE_PROOF_RECORD_COUNT_INVALID');
  }
  if (
    proof.publishedAt.getTime() !== manifest.publishedAt.getTime()
    || proof.contentSha256 !== manifest.contentSha256
    || proof.fileCount !== manifest.fileCount
    || proof.recordCount !== manifest.recordCount
  ) {
    throw importError('FNS_EGRUL_IMPORT_COVERAGE_PROOF_MISMATCH');
  }
}

async function collectXmlFiles(
  directory: string,
  root: string,
  depth: number,
  output: Array<{ absolutePath: string; relativePath: string }>,
): Promise<void> {
  if (depth > MAX_IMPORT_DEPTH) throw importError('FNS_EGRUL_IMPORT_DEPTH_EXCEEDED');
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    throw importError('FNS_EGRUL_IMPORT_DIRECTORY_READ_FAILED');
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw importError('FNS_EGRUL_IMPORT_SYMLINK_FORBIDDEN');
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectXmlFiles(absolutePath, root, depth + 1, output);
      continue;
    }
    if (!entry.isFile()) throw importError('FNS_EGRUL_IMPORT_NON_REGULAR_FILE');
    if (!/\.xml$/iu.test(entry.name)) throw importError('FNS_EGRUL_IMPORT_NON_XML_FILE');
    output.push({ absolutePath, relativePath: relativePosix(root, absolutePath) });
    if (output.length > MAX_IMPORT_FILES) throw importError('FNS_EGRUL_IMPORT_FILE_LIMIT_EXCEEDED');
  }
}

async function readRegularFileNoFollow(path: string): Promise<Uint8Array> {
  const noFollow = typeof fsConstants.O_NOFOLLOW === 'number' ? fsConstants.O_NOFOLLOW : 0;
  let handle: FileHandle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | noFollow);
  } catch {
    throw importError('FNS_EGRUL_IMPORT_FILE_OPEN_FAILED');
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw importError('FNS_EGRUL_IMPORT_NON_REGULAR_FILE');
    if (!Number.isSafeInteger(stat.size) || stat.size <= 0 || stat.size > MAX_XML_BYTES) {
      throw importError('FNS_EGRUL_IMPORT_FILE_SIZE_INVALID');
    }
    const body = await handle.readFile();
    if (body.byteLength !== stat.size) throw importError('FNS_EGRUL_IMPORT_FILE_SIZE_DRIFT');
    return new Uint8Array(body);
  } finally {
    await handle.close();
  }
}

@Injectable()
export class FnsEgrulFileImportService {
  constructor(
    private readonly ingest: RoleEligibilityFnsEgrulIngestRepository,
    private readonly prisma: PrismaService,
    private readonly registry: RoleEligibilityRegistryRepository,
    private readonly health: RoleEligibilitySourceHealthService,
  ) {}

  async inspectFullSnapshot(directory: string, format: FnsEgrulFormat): Promise<FnsEgrulSnapshotManifest> {
    const resolved = resolve(directory);
    let root: string;
    try {
      root = await realpath(resolved);
    } catch {
      throw importError('FNS_EGRUL_IMPORT_DIRECTORY_UNAVAILABLE');
    }

    const discovered: Array<{ absolutePath: string; relativePath: string }> = [];
    await collectXmlFiles(root, root, 0, discovered);
    if (!discovered.length) throw importError('FNS_EGRUL_IMPORT_EMPTY_DIRECTORY');
    discovered.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

    const inspected: InspectedFile[] = [];
    let snapshotPublishedAt: Date | null = null;
    let totalRecords = 0;

    for (const file of discovered) {
      const canonicalPath = await realpath(file.absolutePath).catch(() => {
        throw importError('FNS_EGRUL_IMPORT_FILE_UNAVAILABLE');
      });
      relativePosix(root, canonicalPath);
      const bytes = await readRegularFileNoFollow(canonicalPath);
      const parsed = parseFnsEgrulXml(decodeFnsEgrulXml(bytes), format);
      if (!snapshotPublishedAt) snapshotPublishedAt = parsed.publishedAt;
      if (snapshotPublishedAt.getTime() !== parsed.publishedAt.getTime()) {
        throw importError('FNS_EGRUL_SNAPSHOT_PUBLICATION_DATE_MISMATCH');
      }
      totalRecords += parsed.records.length;
      if (!Number.isSafeInteger(totalRecords)) throw importError('FNS_EGRUL_IMPORT_RECORD_COUNT_OVERFLOW');
      inspected.push({
        relativePath: file.relativePath,
        size: bytes.byteLength,
        sha256: sha256(bytes),
        publishedAt: parsed.publishedAt,
        recordCount: parsed.records.length,
      });
    }

    if (!snapshotPublishedAt) throw importError('FNS_EGRUL_IMPORT_PUBLICATION_DATE_MISSING');
    const files = inspected.map((file) => ({
      relativePath: file.relativePath,
      size: file.size,
      sha256: file.sha256,
      publishedAt: file.publishedAt.toISOString(),
      recordCount: file.recordCount,
    }));
    const contentSha256 = sha256(stableJson({ format, publishedAt: snapshotPublishedAt.toISOString(), files }));

    return {
      format,
      publishedAt: snapshotPublishedAt,
      contentSha256,
      fileCount: files.length,
      recordCount: totalRecords,
      files,
    };
  }

  async importFullSnapshot(input: FnsEgrulFullSnapshotImportInput): Promise<FnsEgrulFullSnapshotImportResult> {
    const importStartedAt = new Date();
    const downloadedAt = input.downloadedAt ?? importStartedAt;
    if (Number.isNaN(downloadedAt.getTime())) throw importError('FNS_EGRUL_IMPORT_DOWNLOADED_AT_INVALID');
    if (Number.isNaN(input.freshUntil.getTime())) throw importError('FNS_EGRUL_IMPORT_FRESH_UNTIL_INVALID');
    const parserVersion = String(input.parserVersion || DEFAULT_PARSER_VERSION).trim();
    if (!parserVersion) throw importError('FNS_EGRUL_IMPORT_PARSER_VERSION_REQUIRED');

    const manifest = await this.inspectFullSnapshot(input.directory, input.format);
    assertCoverageProof(manifest, input.coverageProof, importStartedAt);
    if (manifest.publishedAt.getTime() > importStartedAt.getTime()) {
      throw importError('FNS_EGRUL_IMPORT_PUBLICATION_DATE_IN_FUTURE');
    }
    if (input.freshUntil.getTime() <= importStartedAt.getTime()) {
      throw importError('FNS_EGRUL_IMPORT_SNAPSHOT_STALE');
    }
    const maxFreshUntil = manifest.publishedAt.getTime() + FNS_MAX_FRESHNESS_MS;
    if (input.freshUntil.getTime() > maxFreshUntil) {
      throw importError('FNS_EGRUL_IMPORT_FRESHNESS_CEILING_EXCEEDED');
    }

    const generation = await this.ingest.begin({
      publishedAt: manifest.publishedAt,
      downloadedAt,
      contentSha256: manifest.contentSha256,
      format: input.format,
      parserVersion,
      freshUntil: input.freshUntil,
    });
    const correlationId = `fns-egrul-file-import:${generation.id}`;

    try {
      await this.registry.auditSourceEvent('ROLE_ELIGIBILITY_SOURCE_FETCH_STARTED', 'FNS', correlationId, {
        mode: 'FULL_SNAPSHOT_AUTHORIZED_FILE_IMPORT',
        generationId: generation.id,
        contentSha256: manifest.contentSha256,
        publishedAt: manifest.publishedAt.toISOString(),
        fileCount: manifest.fileCount,
        recordCount: manifest.recordCount,
        coverageAuthority: input.coverageProof.authority,
        coverageCapturedAt: input.coverageProof.capturedAt.toISOString(),
      });

      if (generation.alreadyActive) {
        const replay = await this.finalizeActiveReplay(generation.id, manifest, correlationId);
        if (!replay) throw importError('FNS_EGRUL_IMPORT_ACTIVE_GENERATION_MISMATCH');
        return this.replayResult(replay.generation, manifest);
      }

      const persisted = await this.prisma.$queryRaw<GenerationRow[]>(Prisma.sql`
        SELECT id,source,generation,published_at,downloaded_at,content_sha256,record_count,
               parser_version,schema_version,status,fresh_until
        FROM eligibility.registry_generations
        WHERE id=${generation.id} AND source='FNS'
        LIMIT 1
      `);
      const stored = persisted[0];
      if (!stored) throw importError('FNS_EGRUL_IMPORT_STAGING_GENERATION_MISSING');
      if (stored.status !== 'STAGING') {
        const concurrentReplay = await this.recoverConcurrentActiveReplay(generation.id, manifest, correlationId);
        if (concurrentReplay) return concurrentReplay;
        throw importError('FNS_EGRUL_IMPORT_STAGING_GENERATION_MISSING');
      }
      if (stored.fresh_until.getTime() <= importStartedAt.getTime()) {
        throw importError('FNS_EGRUL_IMPORT_STORED_SNAPSHOT_STALE');
      }
      if (stored.fresh_until.getTime() !== input.freshUntil.getTime()) {
        throw importError('FNS_EGRUL_IMPORT_STORED_FRESHNESS_MISMATCH');
      }

      const root = await realpath(resolve(input.directory)).catch(() => {
        throw importError('FNS_EGRUL_IMPORT_DIRECTORY_UNAVAILABLE');
      });
      let inserted = 0;
      let replayed = 0;

      for (const file of manifest.files) {
        const absolutePath = resolve(root, ...file.relativePath.split('/'));
        relativePosix(root, absolutePath);
        const canonicalPath = await realpath(absolutePath).catch(() => {
          throw importError('FNS_EGRUL_IMPORT_FILE_UNAVAILABLE');
        });
        relativePosix(root, canonicalPath);
        const bytes = await readRegularFileNoFollow(canonicalPath);
        if (bytes.byteLength !== file.size || sha256(bytes) !== file.sha256) {
          throw importError('FNS_EGRUL_FILE_CHANGED_AFTER_MANIFEST');
        }
        const parsed = parseFnsEgrulXml(decodeFnsEgrulXml(bytes), input.format);
        if (
          parsed.publishedAt.toISOString() !== file.publishedAt
          || parsed.records.length !== file.recordCount
        ) {
          throw importError('FNS_EGRUL_FILE_CHANGED_AFTER_MANIFEST');
        }

        for (let offset = 0; offset < parsed.records.length; offset += APPEND_ROWS) {
          let outcome: { inserted: number; replayed: number };
          try {
            outcome = await this.ingest.append(generation.id, parsed.records.slice(offset, offset + APPEND_ROWS));
          } catch (error) {
            if (error instanceof Error && error.message === 'FNS_EGRUL_GENERATION_NOT_STAGING') {
              const concurrentReplay = await this.recoverConcurrentActiveReplay(generation.id, manifest, correlationId);
              if (concurrentReplay) return concurrentReplay;
            }
            throw error;
          }
          inserted += outcome.inserted;
          replayed += outcome.replayed;
        }
      }

      if (inserted + replayed !== manifest.recordCount) throw importError('FNS_EGRUL_IMPORT_CARDINALITY_MISMATCH');

      const finalManifest = await this.inspectFullSnapshot(input.directory, input.format);
      if (
        finalManifest.contentSha256 !== manifest.contentSha256
        || finalManifest.fileCount !== manifest.fileCount
        || finalManifest.recordCount !== manifest.recordCount
        || finalManifest.publishedAt.getTime() !== manifest.publishedAt.getTime()
      ) {
        throw importError('FNS_EGRUL_IMPORT_DIRECTORY_CHANGED_AFTER_MANIFEST');
      }

      const cardinality = await this.prisma.$queryRaw<GenerationCardinalityRow[]>(Prisma.sql`
        SELECT g.record_count,
               COUNT(r.id)::bigint AS actual_count
        FROM eligibility.registry_generations g
        LEFT JOIN eligibility.registry_records r ON r.generation_id = g.id
        WHERE g.id = ${generation.id} AND g.source = 'FNS' AND g.status IN ('STAGING','ACTIVE')
        GROUP BY g.record_count
      `);
      const expected = BigInt(manifest.recordCount);
      if (
        cardinality.length !== 1
        || cardinality[0].record_count !== expected
        || cardinality[0].actual_count !== expected
      ) {
        const concurrentReplay = await this.recoverConcurrentActiveReplay(generation.id, manifest, correlationId);
        if (concurrentReplay) return concurrentReplay;
        throw importError('FNS_EGRUL_IMPORT_UNIQUE_OGRN_CARDINALITY_MISMATCH');
      }

      const activation = await this.activateMonotonic(generation.id, manifest, correlationId);
      const active = activation.generation;
      return {
        generationId: generation.id,
        generation: active.generation,
        contentSha256: active.contentSha256,
        publishedAt: active.publishedAt,
        fileCount: manifest.fileCount,
        recordCount: Number(active.recordCount),
        inserted: activation.alreadyActive ? 0 : inserted,
        replayed: activation.alreadyActive ? Number(active.recordCount) : replayed,
        alreadyActive: activation.alreadyActive,
      };
    } catch (error) {
      await this.recordFailure(correlationId, generation.id, error);
      throw error;
    }
  }

  private replayResult(active: RegistryGeneration, manifest: FnsEgrulSnapshotManifest): FnsEgrulFullSnapshotImportResult {
    return {
      generationId: active.id,
      generation: active.generation,
      contentSha256: active.contentSha256,
      publishedAt: active.publishedAt,
      fileCount: manifest.fileCount,
      recordCount: Number(active.recordCount),
      inserted: 0,
      replayed: Number(active.recordCount),
      alreadyActive: true,
    };
  }

  private async recoverConcurrentActiveReplay(
    generationId: string,
    manifest: FnsEgrulSnapshotManifest,
    correlationId: string,
  ): Promise<FnsEgrulFullSnapshotImportResult | null> {
    const replay = await this.finalizeActiveReplay(generationId, manifest, correlationId);
    return replay ? this.replayResult(replay.generation, manifest) : null;
  }

  private async finalizeActiveReplay(
    generationId: string,
    manifest: FnsEgrulSnapshotManifest,
    correlationId: string,
  ): Promise<FinalizedReplay | null> {
    return withSerializationRetry(() => this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${FNS_ACTIVATION_LOCK}, 0)) IS NULL AS locked
      `);
      const targets = await tx.$queryRaw<ActivationGenerationRow[]>(Prisma.sql`
        SELECT id,source,generation,published_at,downloaded_at,content_sha256,record_count,
               parser_version,schema_version,status,fresh_until,
               fresh_until > clock_timestamp() AS fresh_at_activation
        FROM eligibility.registry_generations
        WHERE id=${generationId} AND source='FNS'
        FOR UPDATE
      `);
      const target = targets[0];
      if (!target || !generationMatchesManifest(target, manifest)) return null;
      if (target.status === 'ACTIVE') {
        if (!target.fresh_at_activation) throw importError('FNS_EGRUL_IMPORT_ACTIVE_SNAPSHOT_STALE');
        await this.recordSuccessWithin(tx, target, correlationId, true);
        return { generation: mapGeneration(target), successRecorded: true };
      }
      if (target.status !== 'VALIDATED') return null;

      const activeRows = await tx.$queryRaw<GenerationRow[]>(Prisma.sql`
        SELECT id,source,generation,published_at,downloaded_at,content_sha256,record_count,
               parser_version,schema_version,status,fresh_until
        FROM eligibility.registry_generations
        WHERE source='FNS' AND status='ACTIVE'
        ORDER BY published_at DESC,id DESC
        LIMIT 1
        FOR UPDATE
      `);
      const current = activeRows[0];
      if (!current || current.published_at.getTime() <= target.published_at.getTime()) return null;
      throw importError('FNS_EGRUL_IMPORT_ACTIVE_GENERATION_NEWER_OR_EQUAL');
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  }

  private async activateMonotonic(
    generationId: string,
    manifest: FnsEgrulSnapshotManifest,
    correlationId: string,
  ): Promise<ActivationOutcome> {
    return withSerializationRetry(() => this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${FNS_ACTIVATION_LOCK}, 0)) IS NULL AS locked
      `);

      const targets = await tx.$queryRaw<ActivationGenerationRow[]>(Prisma.sql`
        SELECT id,source,generation,published_at,downloaded_at,content_sha256,record_count,
               parser_version,schema_version,status,fresh_until,
               fresh_until > clock_timestamp() AS fresh_at_activation
        FROM eligibility.registry_generations
        WHERE id=${generationId} AND source='FNS'
        FOR UPDATE
      `);
      const target = targets[0];
      if (!target) throw importError('FNS_EGRUL_IMPORT_GENERATION_NOT_FOUND');
      if (!generationMatchesManifest(target, manifest)) throw importError('FNS_EGRUL_IMPORT_GENERATION_MANIFEST_MISMATCH');
      if (!target.fresh_at_activation) {
        throw importError('FNS_EGRUL_IMPORT_STORED_SNAPSHOT_STALE_AT_ACTIVATION');
      }
      if (!['STAGING', 'VALIDATED', 'ACTIVE'].includes(target.status)) {
        throw importError('FNS_EGRUL_IMPORT_GENERATION_NOT_ACTIVATABLE');
      }
      if (target.status === 'ACTIVE') {
        await this.recordSuccessWithin(tx, target, correlationId, true);
        return { generation: mapGeneration(target), alreadyActive: true };
      }

      const activeRows = await tx.$queryRaw<GenerationRow[]>(Prisma.sql`
        SELECT id,source,generation,published_at,downloaded_at,content_sha256,record_count,
               parser_version,schema_version,status,fresh_until
        FROM eligibility.registry_generations
        WHERE source='FNS' AND status='ACTIVE' AND id<>${generationId}
        ORDER BY published_at DESC,id DESC
        LIMIT 1
        FOR UPDATE
      `);
      const current = activeRows[0];
      if (current && current.published_at.getTime() >= target.published_at.getTime()) {
        throw importError('FNS_EGRUL_IMPORT_ACTIVE_GENERATION_NEWER_OR_EQUAL');
      }

      const counts = await tx.$queryRaw<ActivationCountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count,
               (COUNT(*) - COUNT(DISTINCT source_record_id || E'\\x1f' || record_type || E'\\x1f' || payload_sha256))::bigint AS duplicate_records
        FROM eligibility.registry_records
        WHERE generation_id=${generationId}
      `);
      if (counts[0]?.count !== target.record_count) throw importError('FNS_EGRUL_IMPORT_ACTIVATION_CARDINALITY_MISMATCH');
      if ((counts[0]?.count || 0n) <= 0n) throw importError('FNS_EGRUL_IMPORT_EMPTY_GENERATION');
      if ((counts[0]?.duplicate_records || 0n) !== 0n) throw importError('FNS_EGRUL_IMPORT_DUPLICATE_RECORDS');

      if (target.status === 'STAGING') {
        const updated = await tx.$executeRaw(Prisma.sql`
          UPDATE eligibility.registry_generations
          SET status='VALIDATED',validated_at=clock_timestamp()
          WHERE id=${generationId} AND source='FNS' AND status='STAGING'
        `);
        if (updated !== 1) throw importError('FNS_EGRUL_IMPORT_VALIDATION_STATE_CHANGED');
      }

      await tx.$queryRaw(Prisma.sql`
        SELECT eligibility.activate_registry_generation('FNS',${target.generation})
      `);
      const activated = await tx.$queryRaw<ActivationGenerationRow[]>(Prisma.sql`
        SELECT id,source,generation,published_at,downloaded_at,content_sha256,record_count,
               parser_version,schema_version,status,fresh_until,
               fresh_until > clock_timestamp() AS fresh_at_activation
        FROM eligibility.registry_generations
        WHERE id=${generationId} AND source='FNS'
        FOR UPDATE
      `);
      if (!activated[0] || activated[0].status !== 'ACTIVE') {
        throw importError('FNS_EGRUL_IMPORT_ACTIVATION_FAILED');
      }
      if (!activated[0].fresh_at_activation) {
        throw importError('FNS_EGRUL_IMPORT_STORED_SNAPSHOT_STALE_AT_ACTIVATION');
      }
      await this.recordSuccessWithin(tx, activated[0], correlationId, false);
      return { generation: mapGeneration(activated[0]), alreadyActive: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  }

  private async recordSuccessWithin(
    tx: Prisma.TransactionClient,
    active: GenerationRow,
    correlationId: string,
    alreadyActive: boolean,
  ): Promise<void> {
    if (active.status !== 'ACTIVE') throw importError('FNS_EGRUL_IMPORT_SUCCESS_REQUIRES_ACTIVE_GENERATION');
    const payload = JSON.stringify({
      source: 'FNS',
      mode: 'FULL_SNAPSHOT_AUTHORIZED_FILE_IMPORT',
      generation: active.generation,
      contentSha256: active.content_sha256,
      recordCount: active.record_count.toString(),
      parserVersion: active.parser_version,
      schemaVersion: active.schema_version,
      publishedAt: active.published_at.toISOString(),
      freshUntil: active.fresh_until.toISOString(),
      alreadyActive,
    });
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO eligibility.source_health (
        source,status,circuit_state,active_generation,parser_version,schema_version,
        last_success_at,last_failure_at,checked_at,fresh_until,consecutive_failures,last_error_code,updated_at
      ) VALUES (
        'FNS','HEALTHY','CLOSED',${active.generation},${active.parser_version},${active.schema_version},
        clock_timestamp(),NULL,clock_timestamp(),${active.fresh_until},0,NULL,clock_timestamp()
      ) ON CONFLICT (source) DO UPDATE SET
        status='HEALTHY',circuit_state='CLOSED',active_generation=EXCLUDED.active_generation,
        parser_version=EXCLUDED.parser_version,schema_version=EXCLUDED.schema_version,
        last_success_at=EXCLUDED.last_success_at,checked_at=EXCLUDED.checked_at,
        fresh_until=EXCLUDED.fresh_until,consecutive_failures=0,last_error_code=NULL,updated_at=clock_timestamp()
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO eligibility.audit_events(id,event_type,correlation_id,payload,created_at)
      VALUES (
        'ela_' || gen_random_uuid()::text,'ROLE_ELIGIBILITY_SOURCE_FETCH_SUCCEEDED',${correlationId},
        ${payload}::jsonb,clock_timestamp()
      )
    `);
  }

  private async recordFailure(correlationId: string, generationId: string, error: unknown): Promise<void> {
    const errorCode = stableFailureCode(error);
    const preserveHealthySource = errorCode === 'FNS_EGRUL_IMPORT_ACTIVE_GENERATION_NEWER_OR_EQUAL'
      || errorCode === 'FNS_EGRUL_IMPORT_SERIALIZATION_RETRIES_EXHAUSTED';
    let recordingFailed = false;
    if (!preserveHealthySource) {
      try {
        await this.health.failure('FNS', 'UNAVAILABLE', errorCode);
      } catch {
        recordingFailed = true;
      }
    }
    try {
      await this.registry.auditSourceEvent('ROLE_ELIGIBILITY_SOURCE_FETCH_FAILED', 'FNS', correlationId, {
        mode: 'FULL_SNAPSHOT_AUTHORIZED_FILE_IMPORT',
        generationId,
        errorCode,
      });
    } catch {
      recordingFailed = true;
    }
    if (recordingFailed) throw importError('FNS_EGRUL_IMPORT_FAILURE_RECORDING_FAILED');
  }
}

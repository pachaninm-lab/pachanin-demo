import { Injectable } from '@nestjs/common';
import { constants as fsConstants, type Dirent } from 'node:fs';
import { open, readdir, realpath, type FileHandle } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  decodeFnsEgrulXml,
  type FnsEgrulFormat,
  parseFnsEgrulXml,
} from './adapters/fns-egrul-feed.parser';
import { sha256, stableJson } from './role-eligibility-security';

const MAX_IMPORT_FILES = 100_000;
const MAX_IMPORT_DEPTH = 4;
const MAX_XML_BYTES = 32 * 1024 * 1024;

export const FNS_EGRUL_VALIDATE_ONLY_MODE = 'FULL_SNAPSHOT_VALIDATE_ONLY' as const;
export const FNS_EGRUL_NON_AUTHORITATIVE_ACK = 'NON_AUTHORITATIVE_LOCAL_VALIDATION_ONLY' as const;

type InspectedFile = {
  relativePath: string;
  size: number;
  sha256: string;
  publishedAt: Date;
  recordCount: number;
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

export type FnsEgrulLocalSnapshotValidationInput = {
  directory: string;
  format: FnsEgrulFormat;
};

export type FnsEgrulLocalSnapshotValidationResult = {
  status: 'VALIDATED_LOCAL_STAGING';
  authority: false;
  databaseMutation: false;
  activated: false;
  sourceHealthChanged: false;
  registrationTouched: false;
  enforcementChanged: false;
  manifest: FnsEgrulSnapshotManifest;
};

function importError(code: string): Error {
  const error = new Error(code);
  error.name = 'FnsEgrulFileImportError';
  return error;
}

function relativePosix(root: string, candidate: string): string {
  const value = relative(root, candidate);
  if (!value || value === '..' || value.startsWith(`..${sep}`) || isAbsolute(value)) {
    throw importError('FNS_EGRUL_IMPORT_PATH_ESCAPE');
  }
  return value.split(sep).join('/');
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

function manifestsMatch(left: FnsEgrulSnapshotManifest, right: FnsEgrulSnapshotManifest): boolean {
  return left.format === right.format
    && left.publishedAt.getTime() === right.publishedAt.getTime()
    && left.contentSha256 === right.contentSha256
    && left.fileCount === right.fileCount
    && left.recordCount === right.recordCount;
}

@Injectable()
export class FnsEgrulFileImportService {
  async inspectFullSnapshot(directory: string, format: FnsEgrulFormat): Promise<FnsEgrulSnapshotManifest> {
    if (!isAbsolute(directory)) throw importError('FNS_EGRUL_IMPORT_DIR_MUST_BE_ABSOLUTE');

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
    const contentSha256 = sha256(stableJson({
      format,
      publishedAt: snapshotPublishedAt.toISOString(),
      files,
    }));

    return {
      format,
      publishedAt: snapshotPublishedAt,
      contentSha256,
      fileCount: files.length,
      recordCount: totalRecords,
      files,
    };
  }

  async validateFullSnapshot(
    input: FnsEgrulLocalSnapshotValidationInput,
  ): Promise<FnsEgrulLocalSnapshotValidationResult> {
    const initial = await this.inspectFullSnapshot(input.directory, input.format);
    if (initial.publishedAt.getTime() > Date.now()) {
      throw importError('FNS_EGRUL_IMPORT_PUBLICATION_DATE_IN_FUTURE');
    }

    // Re-enumerate and re-read the complete local snapshot before returning a result.
    // This proves only local staging consistency; it is deliberately not source coverage authority.
    const final = await this.inspectFullSnapshot(input.directory, input.format);
    if (!manifestsMatch(initial, final)) {
      throw importError('FNS_EGRUL_IMPORT_DIRECTORY_CHANGED_AFTER_MANIFEST');
    }

    return {
      status: 'VALIDATED_LOCAL_STAGING',
      authority: false,
      databaseMutation: false,
      activated: false,
      sourceHealthChanged: false,
      registrationTouched: false,
      enforcementChanged: false,
      manifest: final,
    };
  }
}

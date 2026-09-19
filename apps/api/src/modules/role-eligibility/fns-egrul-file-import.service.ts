import { Injectable } from '@nestjs/common';
import { constants as fsConstants, type Dirent, type Stats } from 'node:fs';
import { lstat, open, readdir, realpath, type FileHandle } from 'node:fs/promises';
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

async function verifyOpenedFileWithinRoot(
  root: string,
  path: string,
  expectedRelativePath: string,
  handle: FileHandle,
  openedStat: Stats,
): Promise<void> {
  if (process.platform === 'linux') {
    let openedPath: string;
    try {
      // O_NOFOLLOW protects only the final path component. Resolve the already-open
      // descriptor so a parent-directory symlink swap cannot redirect validation
      // outside the governed staging root or alias another in-root logical path.
      openedPath = await realpath(`/proc/self/fd/${handle.fd}`);
    } catch {
      throw importError('FNS_EGRUL_IMPORT_OPEN_FILE_IDENTITY_UNAVAILABLE');
    }
    const actualRelativePath = relativePosix(root, openedPath);
    if (actualRelativePath !== expectedRelativePath) {
      throw importError('FNS_EGRUL_IMPORT_PATH_IDENTITY_DRIFT');
    }
    return;
  }

  // Portable fallback for non-production developer platforms. Re-resolve the
  // path after opening and bind it to the opened inode/device. REG.RU production
  // is Linux and therefore uses the descriptor-authoritative branch above.
  let reopenedPath: string;
  let currentStat: Stats;
  try {
    reopenedPath = await realpath(path);
    const actualRelativePath = relativePosix(root, reopenedPath);
    if (actualRelativePath !== expectedRelativePath) {
      throw importError('FNS_EGRUL_IMPORT_PATH_IDENTITY_DRIFT');
    }
    currentStat = await lstat(reopenedPath);
  } catch (error) {
    if (error instanceof Error && error.name === 'FnsEgrulFileImportError') throw error;
    throw importError('FNS_EGRUL_IMPORT_OPEN_FILE_IDENTITY_UNAVAILABLE');
  }
  if (!currentStat.isFile() || currentStat.dev !== openedStat.dev || currentStat.ino !== openedStat.ino) {
    throw importError('FNS_EGRUL_IMPORT_FILE_IDENTITY_DRIFT');
  }
}

export async function readRegularFileNoFollow(
  root: string,
  path: string,
  expectedRelativePath = relativePosix(root, path),
): Promise<Uint8Array> {
  const noFollow = typeof fsConstants.O_NOFOLLOW === 'number' ? fsConstants.O_NOFOLLOW : 0;
  let handle: FileHandle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | noFollow);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'ELOOP') throw importError('FNS_EGRUL_IMPORT_SYMLINK_FORBIDDEN');
    if (code === 'ENOENT') throw importError('FNS_EGRUL_IMPORT_FILE_UNAVAILABLE');
    throw importError('FNS_EGRUL_IMPORT_FILE_OPEN_FAILED');
  }

  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw importError('FNS_EGRUL_IMPORT_NON_REGULAR_FILE');
    if (!Number.isSafeInteger(stat.size) || stat.size <= 0 || stat.size > MAX_XML_BYTES) {
      throw importError('FNS_EGRUL_IMPORT_FILE_SIZE_INVALID');
    }
    await verifyOpenedFileWithinRoot(root, path, expectedRelativePath, handle, stat);
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
    const rootStat = await lstat(resolved).catch(() => {
      throw importError('FNS_EGRUL_IMPORT_DIRECTORY_UNAVAILABLE');
    });
    if (rootStat.isSymbolicLink()) throw importError('FNS_EGRUL_IMPORT_SYMLINK_FORBIDDEN');
    if (!rootStat.isDirectory()) throw importError('FNS_EGRUL_IMPORT_DIRECTORY_UNAVAILABLE');

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
      // Open the originally enumerated logical path directly. Pre-resolving it with
      // realpath() would defeat O_NOFOLLOW if the final file were swapped to a
      // symlink after enumeration but before open(). Descriptor verification below
      // then catches intermediate-parent redirects and in-root path aliasing.
      const bytes = await readRegularFileNoFollow(root, file.absolutePath, file.relativePath);
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

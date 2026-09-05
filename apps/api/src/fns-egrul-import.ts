import { NestFactory } from '@nestjs/core';
import { isAbsolute } from 'node:path';
import { FNS_EGRUL_SUPPORTED_FORMATS, type FnsEgrulFormat } from './modules/role-eligibility/adapters/fns-egrul-feed.parser';
import {
  FNS_EGRUL_COVERAGE_AUTHORITY,
  FnsEgrulFileImportService,
} from './modules/role-eligibility/fns-egrul-file-import.service';
import { RoleEligibilityFnsEgrulImportModule } from './modules/role-eligibility/role-eligibility-fns-egrul-import.module';

function required(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function parseDate(name: string): Date {
  const value = new Date(required(name));
  if (Number.isNaN(value.getTime())) throw new Error(`${name}_INVALID`);
  return value;
}

function positiveInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name}_INVALID`);
  return value;
}

function sha256Value(name: string): string {
  const value = required(name).toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(value)) throw new Error(`${name}_INVALID`);
  return value;
}

function format(): FnsEgrulFormat {
  const value = required('FNS_EGRUL_FORMAT');
  if (!(FNS_EGRUL_SUPPORTED_FORMATS as readonly string[]).includes(value)) {
    throw new Error('FNS_EGRUL_FORMAT_UNSUPPORTED');
  }
  return value as FnsEgrulFormat;
}

async function main(): Promise<void> {
  if (String(process.env.ROLE_ELIGIBILITY_ENFORCEMENT || '').trim().toLowerCase() === 'true') {
    throw new Error('FNS_EGRUL_IMPORT_REQUIRES_ENFORCEMENT_DISABLED');
  }
  if (required('FNS_EGRUL_IMPORT_MODE') !== 'FULL_SNAPSHOT') {
    throw new Error('FNS_EGRUL_IMPORT_MODE_UNSUPPORTED');
  }
  if (required('FNS_EGRUL_IMPORT_ACK') !== 'AUTHORIZED_OFFICIAL_FNS_FILES') {
    throw new Error('FNS_EGRUL_IMPORT_AUTHORITY_ACK_REQUIRED');
  }
  if (required('FNS_EGRUL_COVERAGE_AUTHORITY') !== FNS_EGRUL_COVERAGE_AUTHORITY) {
    throw new Error('FNS_EGRUL_COVERAGE_AUTHORITY_INVALID');
  }

  const directory = required('FNS_EGRUL_IMPORT_DIR');
  if (!isAbsolute(directory)) throw new Error('FNS_EGRUL_IMPORT_DIR_MUST_BE_ABSOLUTE');
  const freshUntil = parseDate('FNS_EGRUL_FRESH_UNTIL');
  const sourceFormat = format();
  const parserVersion = String(process.env.FNS_EGRUL_PARSER_VERSION || 'fns-egrul-v1').trim();
  if (!parserVersion) throw new Error('FNS_EGRUL_PARSER_VERSION_REQUIRED');
  const coverageProof = {
    authority: FNS_EGRUL_COVERAGE_AUTHORITY,
    capturedAt: parseDate('FNS_EGRUL_COVERAGE_CAPTURED_AT'),
    publishedAt: parseDate('FNS_EGRUL_COVERAGE_PUBLISHED_AT'),
    contentSha256: sha256Value('FNS_EGRUL_COVERAGE_CONTENT_SHA256'),
    fileCount: positiveInteger('FNS_EGRUL_COVERAGE_FILE_COUNT'),
    recordCount: positiveInteger('FNS_EGRUL_COVERAGE_RECORD_COUNT'),
  };

  const application = await NestFactory.createApplicationContext(RoleEligibilityFnsEgrulImportModule, {
    logger: false,
  });
  try {
    const importer = application.get(FnsEgrulFileImportService);
    const result = await importer.importFullSnapshot({
      directory,
      format: sourceFormat,
      freshUntil,
      coverageProof,
      downloadedAt: new Date(),
      parserVersion,
    });
    process.stdout.write(`${JSON.stringify({
      status: 'SUCCESS',
      source: 'FNS',
      mode: 'FULL_SNAPSHOT',
      coverageAuthority: FNS_EGRUL_COVERAGE_AUTHORITY,
      generationId: result.generationId,
      generation: result.generation,
      contentSha256: result.contentSha256,
      publishedAt: result.publishedAt.toISOString(),
      fileCount: result.fileCount,
      recordCount: result.recordCount,
      inserted: result.inserted,
      replayed: result.replayed,
      alreadyActive: result.alreadyActive,
      registrationTouched: false,
      enforcementChanged: false,
    })}\n`);
  } finally {
    await application.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'FNS_EGRUL_IMPORT_UNKNOWN_ERROR';
  process.stderr.write(`FNS_EGRUL_IMPORT_FAILED=${message}\n`);
  process.exitCode = 1;
});

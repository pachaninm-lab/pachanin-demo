import { NestFactory } from '@nestjs/core';
import { isAbsolute } from 'node:path';
import { FNS_EGRUL_SUPPORTED_FORMATS, type FnsEgrulFormat } from './modules/role-eligibility/adapters/fns-egrul-feed.parser';
import {
  FNS_EGRUL_NON_AUTHORITATIVE_ACK,
  FNS_EGRUL_VALIDATE_ONLY_MODE,
  FnsEgrulFileImportService,
} from './modules/role-eligibility/fns-egrul-file-import.service';
import { RoleEligibilityFnsEgrulImportModule } from './modules/role-eligibility/role-eligibility-fns-egrul-import.module';

function required(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
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
  if (required('FNS_EGRUL_IMPORT_MODE') !== FNS_EGRUL_VALIDATE_ONLY_MODE) {
    throw new Error('FNS_EGRUL_IMPORT_MODE_UNSUPPORTED');
  }
  if (required('FNS_EGRUL_IMPORT_ACK') !== FNS_EGRUL_NON_AUTHORITATIVE_ACK) {
    throw new Error('FNS_EGRUL_IMPORT_NON_AUTHORITATIVE_ACK_REQUIRED');
  }

  const directory = required('FNS_EGRUL_IMPORT_DIR');
  if (!isAbsolute(directory)) throw new Error('FNS_EGRUL_IMPORT_DIR_MUST_BE_ABSOLUTE');
  const sourceFormat = format();

  const application = await NestFactory.createApplicationContext(RoleEligibilityFnsEgrulImportModule, {
    logger: false,
  });
  try {
    const validator = application.get(FnsEgrulFileImportService);
    const result = await validator.validateFullSnapshot({
      directory,
      format: sourceFormat,
    });
    process.stdout.write(`${JSON.stringify({
      status: result.status,
      source: 'FNS',
      mode: FNS_EGRUL_VALIDATE_ONLY_MODE,
      authority: result.authority,
      databaseMutation: result.databaseMutation,
      activated: result.activated,
      sourceHealthChanged: result.sourceHealthChanged,
      contentSha256: result.manifest.contentSha256,
      publishedAt: result.manifest.publishedAt.toISOString(),
      fileCount: result.manifest.fileCount,
      recordCount: result.manifest.recordCount,
      registrationTouched: result.registrationTouched,
      enforcementChanged: result.enforcementChanged,
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

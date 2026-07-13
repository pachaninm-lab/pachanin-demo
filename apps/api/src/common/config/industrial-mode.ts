/**
 * Industrial mode — the PostgreSQL-authoritative operating profile.
 *
 * In industrial mode every deal mutation must go through the canonical
 * command path (POST /deals/:id/commands/:actionId) and money state can only
 * be confirmed by a verified bank callback. Legacy runtime (in-memory)
 * repositories and free-form transitions are demo-profile-only.
 *
 * Production is always industrial: the process refuses to start otherwise
 * (fail closed) instead of silently serving in-memory state.
 */

export type ProcessEnv = Record<string, string | undefined>;
export type CriticalRepositoryMode = 'memory' | 'prisma';

export function parseCriticalRepositoryMode(
  variable: string,
  value: string | undefined,
): CriticalRepositoryMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'memory' || normalized === 'prisma') return normalized;
  if (!normalized) {
    throw new IndustrialStartupError(`${variable} must be explicitly set to "memory" or "prisma".`);
  }
  throw new IndustrialStartupError(
    `${variable} has unknown value "${normalized}"; allowed values are "memory" and "prisma".`,
  );
}

export function isIndustrialMode(env: ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') return true;
  return env.PLATFORM_V7_DEAL_REPOSITORY === 'prisma';
}

export class IndustrialStartupError extends Error {
  constructor(message: string) {
    super(`Industrial startup blocked (fail closed): ${message}`);
    this.name = 'IndustrialStartupError';
  }
}

/**
 * Production startup contract. Called from bootstrap before the port opens.
 * Every violation terminates startup — there is no degraded in-memory mode.
 */
export function assertIndustrialProductionStartup(env: ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  if (!env.DATABASE_URL?.trim()) {
    throw new IndustrialStartupError('DATABASE_URL is required: PostgreSQL is the only source of truth.');
  }
  if (!env.STORAGE_DATABASE_URL?.trim()) {
    throw new IndustrialStartupError(
      'STORAGE_DATABASE_URL is required for the isolated evidence-finalization principal.',
    );
  }
  const dealPrincipal = databasePrincipal(env.DATABASE_URL);
  const storagePrincipal = databasePrincipal(env.STORAGE_DATABASE_URL);
  if (!storagePrincipal || storagePrincipal === dealPrincipal) {
    throw new IndustrialStartupError(
      'STORAGE_DATABASE_URL must use a PostgreSQL principal distinct from DATABASE_URL.',
    );
  }
  if (env.PLATFORM_V7_DEAL_REPOSITORY !== 'prisma') {
    throw new IndustrialStartupError(
      'PLATFORM_V7_DEAL_REPOSITORY must be "prisma" in production. ' +
        'The in-memory runtime repository is forbidden as production authority.',
    );
  }
  if (parseCriticalRepositoryMode(
    'PLATFORM_V7_DOCUMENT_REPOSITORY',
    env.PLATFORM_V7_DOCUMENT_REPOSITORY,
  ) !== 'prisma') {
    throw new IndustrialStartupError(
      'PLATFORM_V7_DOCUMENT_REPOSITORY must be "prisma" in production. ' +
        'The in-memory document repository is forbidden as production authority.',
    );
  }
  if (parseCriticalRepositoryMode(
    'PLATFORM_V7_SHIPMENT_REPOSITORY',
    env.PLATFORM_V7_SHIPMENT_REPOSITORY,
  ) !== 'prisma') {
    throw new IndustrialStartupError(
      'PLATFORM_V7_SHIPMENT_REPOSITORY must be "prisma" in production. ' +
        'The in-memory shipment repository is forbidden as production authority.',
    );
  }
  if (parseCriticalRepositoryMode(
    'PLATFORM_V7_LAB_REPOSITORY',
    env.PLATFORM_V7_LAB_REPOSITORY,
  ) !== 'prisma') {
    throw new IndustrialStartupError(
      'PLATFORM_V7_LAB_REPOSITORY must be "prisma" in production. ' +
        'The in-memory laboratory repository is forbidden as production authority.',
    );
  }
  if (env.AUTH_TEST_ACCOUNTS_ENABLED === '1' || env.AUTH_TEST_ACCOUNTS_ENABLED === 'true') {
    throw new IndustrialStartupError('Test accounts must be disabled in production live mode.');
  }
  if (env.ALLOW_RUNTIME_MUTATION === '1' || env.ALLOW_RUNTIME_MUTATION === 'true') {
    throw new IndustrialStartupError('Public runtime mutation must be disabled in production.');
  }
}

/** The migration that establishes the industrial transaction core schema. */
export const INDUSTRIAL_CORE_MIGRATION = '20260712090000_industrial_transaction_core';

function databasePrincipal(value: string | undefined): string {
  try {
    return decodeURIComponent(new URL(String(value ?? '')).username).trim();
  } catch {
    throw new IndustrialStartupError('PostgreSQL datasource URL is invalid.');
  }
}

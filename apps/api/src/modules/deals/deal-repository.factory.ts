import type { DealRepository } from './deal.repository';

export type DealRepositoryMode = 'prisma' | 'runtime';

/**
 * Configuration helper retained only for explicit test-profile composition.
 * Production DealsModule does not call this function and binds Prisma directly.
 * Unknown values never degrade to RuntimeCore.
 */
export function selectDealRepository(
  prisma: DealRepository,
  runtime: DealRepository | undefined,
  options: {
    mode?: string;
    nodeEnv?: string;
    profile?: string;
  } = {},
): DealRepository {
  const mode = (options.mode ?? process.env.PLATFORM_V7_DEAL_REPOSITORY ?? 'prisma').trim().toLowerCase();
  const nodeEnv = (options.nodeEnv ?? process.env.NODE_ENV ?? '').trim().toLowerCase();
  const profile = (options.profile ?? process.env.PLATFORM_V7_PROFILE ?? '').trim().toLowerCase();

  if (mode === 'prisma') return prisma;

  if (mode === 'runtime') {
    const explicitlyNonProduction = nodeEnv === 'test' && ['test', 'demo'].includes(profile);
    if (!explicitlyNonProduction || !runtime) {
      throw new Error(
        'RuntimeDealRepository is allowed only with NODE_ENV=test and PLATFORM_V7_PROFILE=test|demo.',
      );
    }
    return runtime;
  }

  throw new Error(`Unknown PLATFORM_V7_DEAL_REPOSITORY mode: ${mode || '<empty>'}`);
}

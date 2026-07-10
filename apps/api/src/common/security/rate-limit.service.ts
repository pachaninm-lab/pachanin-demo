import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { RateLimitRepository } from './rate-limit.repository';

export type RateLimitDecision = Readonly<{
  allowed: boolean;
  count: number;
  remaining: number;
  limit: number;
  resetAt: number;
}>;

const ROUTE_NAME_PATTERN = /^[a-z0-9][a-z0-9:_-]{0,127}$/;
const CLEANUP_INTERVAL_MS = 60_000;
const NON_PRODUCTION_FALLBACK = 'transparent-price-rate-limit-local-only';

export function resolveRateLimitHmacKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const production = String(env.NODE_ENV ?? '').toLowerCase() === 'production';
  const source = String(env.RATE_LIMIT_KEY_PEPPER ?? '').trim();
  if (production && source.length < 32) {
    throw new Error('RATE_LIMIT_KEY_PEPPER with at least 32 characters is required in production.');
  }
  return createHash('sha256')
    .update(`transparent-price:rate-limit:v1:${source || NON_PRODUCTION_FALLBACK}`)
    .digest();
}

export function hashRateLimitKey(rawKey: string, hmacKey: Buffer): string {
  return createHmac('sha256', hmacKey).update(rawKey).digest('hex');
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly hmacKey = resolveRateLimitHmacKey();
  private lastCleanupAt = 0;

  constructor(private readonly repository: RateLimitRepository) {}

  async consume(
    routeName: string,
    rawKey: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitDecision> {
    const safeRouteName = String(routeName ?? '').trim().toLowerCase();
    if (!ROUTE_NAME_PATTERN.test(safeRouteName)) {
      throw new Error('Rate-limit route name is invalid.');
    }
    const safeKey = String(rawKey ?? '').trim();
    if (!safeKey) throw new Error('Rate-limit key is required.');

    const safeLimit = Math.min(100_000, Math.max(1, Math.floor(limit || 1)));
    const safeWindowSeconds = Math.min(86_400, Math.max(1, Math.floor(windowSeconds || 60)));
    const keyHash = hashRateLimitKey(safeKey, this.hmacKey);
    const bucket = await this.repository.consume({
      routeName: safeRouteName,
      keyHash,
      windowSeconds: safeWindowSeconds,
    });

    await this.cleanupIfDue();

    return {
      allowed: bucket.count <= safeLimit,
      count: bucket.count,
      remaining: Math.max(0, safeLimit - bucket.count),
      limit: safeLimit,
      resetAt: bucket.resetAt.getTime(),
    };
  }

  private async cleanupIfDue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return;
    this.lastCleanupAt = now;
    try {
      await this.repository.deleteExpired();
    } catch (error) {
      this.logger.warn(`Expired rate-limit cleanup failed: ${this.errorMessage(error)}`);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}

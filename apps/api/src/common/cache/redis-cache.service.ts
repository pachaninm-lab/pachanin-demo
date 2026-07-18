import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Opt-in Redis read-through cache.
 *
 * Enabled only when REDIS_URL is set; otherwise every method is a no-op and
 * callers transparently fall back to their source of truth. All operations are
 * best-effort and fail open: a Redis outage never turns into a request failure,
 * it only bypasses the cache. This must never be used to cache authoritative or
 * personalized financial state — only anonymized, non-personalized reads with a
 * bounded TTL.
 */
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis | null;
  private ready = false;
  private loggedError = false;

  constructor() {
    const url = (process.env.REDIS_URL ?? '').trim();
    if (!url) {
      this.client = null;
      return;
    }
    this.client = new Redis(url, {
      // Fail fast rather than queueing when Redis is unreachable, so a request
      // is served from the source of truth instead of hanging on the cache.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
    });
    this.client.on('ready', () => {
      this.ready = true;
      this.loggedError = false;
      this.logger.log('Redis cache connected.');
    });
    this.client.on('end', () => {
      this.ready = false;
    });
    this.client.on('error', (error: Error) => {
      this.ready = false;
      if (!this.loggedError) {
        this.loggedError = true;
        this.logger.warn(`Redis cache unavailable, serving from source: ${error.message}`);
      }
    });
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.client || !this.ready) return undefined;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client || !this.ready) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSeconds)));
    } catch {
      // Best-effort: a failed cache write must not affect the response.
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

import { Injectable } from '@nestjs/common';

type BucketState = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, BucketState>();
  private lastSweepAt = 0;

  consume(key: string, limit: number, windowSeconds: number) {
    const now = Date.now();
    this.sweep(now);
    const safeLimit = Math.max(1, Math.floor(limit || 1));
    const windowMs = Math.max(1000, Math.floor((windowSeconds || 60) * 1000));
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const state = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, state);
      return {
        allowed: true,
        remaining: safeLimit - 1,
        limit: safeLimit,
        resetAt: state.resetAt
      };
    }

    existing.count += 1;
    this.buckets.set(key, existing);
    return {
      allowed: existing.count <= safeLimit,
      remaining: Math.max(0, safeLimit - existing.count),
      limit: safeLimit,
      resetAt: existing.resetAt
    };
  }

  private sweep(now: number) {
    if (now - this.lastSweepAt < 60_000) return;
    this.lastSweepAt = now;
    for (const [key, value] of this.buckets.entries()) {
      if (value.resetAt <= now) this.buckets.delete(key);
    }
  }
}

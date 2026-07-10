/**
 * The process-local middleware was removed.
 *
 * Runtime request protection is enforced by:
 * - PreAuthRateLimitGuard for every non-health HTTP request;
 * - DecoratedRateLimitGuard for route-specific `@RateLimit` policies;
 * - RateLimitService backed by PostgreSQL atomic coordination.
 *
 * This file intentionally exports no middleware to prevent accidental reintroduction
 * of per-process `Map` buckets in AppModule.
 */
export {};

import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';

/**
 * Global module exposing the opt-in Redis cache to any provider. Kept global so
 * feature modules can depend on the cache without re-importing it; it stays a
 * no-op until REDIS_URL is configured.
 */
@Global()
@Module({
  providers: [RedisCacheService],
  exports: [RedisCacheService],
})
export class RedisCacheModule {}

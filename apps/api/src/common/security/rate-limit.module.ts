import { Global, Module } from '@nestjs/common';
import { RateLimitRepository } from './rate-limit.repository';
import { RateLimitService } from './rate-limit.service';
import { TrustedProxyService } from './trusted-proxy';

@Global()
@Module({
  providers: [RateLimitRepository, RateLimitService, TrustedProxyService],
  exports: [RateLimitRepository, RateLimitService, TrustedProxyService],
})
export class RateLimitModule {}

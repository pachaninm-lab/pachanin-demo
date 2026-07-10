import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { MfaService } from './mfa.service';

@Controller('api/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get('status')
  status(@CurrentUser() user: RequestUser) {
    return this.mfa.status(user);
  }

  @RateLimit({ name: 'mfa_setup_init', scope: 'user', limit: 3, windowSeconds: 300, limitEnv: 'RATE_LIMIT_MFA_SETUP_INIT', windowEnv: 'RATE_LIMIT_MFA_WINDOW_SECONDS' })
  @Post('setup/init')
  initSetup(@CurrentUser() user: RequestUser) {
    return this.mfa.beginSetup(user);
  }

  @RateLimit({ name: 'mfa_setup_verify', scope: 'user', limit: 8, windowSeconds: 300, limitEnv: 'RATE_LIMIT_MFA_SETUP_VERIFY', windowEnv: 'RATE_LIMIT_MFA_WINDOW_SECONDS' })
  @Post('setup/verify')
  verifySetup(
    @CurrentUser() user: RequestUser,
    @Body() body: { challengeId: string; code: string },
  ) {
    return this.mfa.confirmSetup(user, body.challengeId, body.code);
  }

  @RateLimit({ name: 'mfa_verify_init', scope: 'user', limit: 5, windowSeconds: 300, limitEnv: 'RATE_LIMIT_MFA_VERIFY_INIT', windowEnv: 'RATE_LIMIT_MFA_WINDOW_SECONDS' })
  @Post('verify/init')
  initVerification(@CurrentUser() user: RequestUser) {
    return this.mfa.beginStepUp(user);
  }

  @RateLimit({ name: 'mfa_verify', scope: 'user', limit: 8, windowSeconds: 300, limitEnv: 'RATE_LIMIT_MFA_VERIFY', windowEnv: 'RATE_LIMIT_MFA_WINDOW_SECONDS' })
  @Post('verify')
  verify(
    @CurrentUser() user: RequestUser,
    @Body() body: { challengeId: string; code?: string; backupCode?: string },
  ) {
    return this.mfa.verifyStepUp(user, body);
  }
}

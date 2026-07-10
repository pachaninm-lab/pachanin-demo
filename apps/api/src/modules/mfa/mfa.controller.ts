import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { MfaService } from './mfa.service';

@Controller('api/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get('status')
  status(@CurrentUser() user: RequestUser) {
    return this.mfa.status(user);
  }

  @Post('setup/init')
  initSetup(@CurrentUser() user: RequestUser) {
    return this.mfa.beginSetup(user);
  }

  @Post('setup/verify')
  verifySetup(
    @CurrentUser() user: RequestUser,
    @Body() body: { challengeId: string; code: string },
  ) {
    return this.mfa.confirmSetup(user, body.challengeId, body.code);
  }

  @Post('verify/init')
  initVerification(@CurrentUser() user: RequestUser) {
    return this.mfa.beginStepUp(user);
  }

  @Post('verify')
  verify(
    @CurrentUser() user: RequestUser,
    @Body() body: { challengeId: string; code?: string; backupCode?: string },
  ) {
    return this.mfa.verifyStepUp(user, body);
  }
}

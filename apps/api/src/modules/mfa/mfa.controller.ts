import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';

@Controller('api/mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Post('setup/init')
  initSetup(@CurrentUser() user: RequestUser) {
    const { secret, otpauthUrl } = this.mfa.generateSecret();
    const url = otpauthUrl('GrainFlow', user.email);
    // In production: save secret to DB (encrypted), don't return plain secret
    return { secret, otpauthUrl: url, message: 'Scan QR code and verify with a TOTP code' };
  }

  @Post('setup/verify')
  verifySetup(
    @CurrentUser() user: RequestUser,
    @Body() body: { secret: string; code: string },
  ) {
    const valid = this.mfa.verifyTotp(body.secret, body.code);
    if (!valid) return { success: false, message: 'Invalid code' };
    const { plain, hashed } = this.mfa.generateBackupCodes();
    // In production: save hashed codes and enable MFA for user in DB
    return { success: true, backupCodes: plain, message: 'MFA enabled. Save backup codes securely.' };
  }

  @Post('verify')
  verify(
    @CurrentUser() _user: RequestUser,
    @Body() body: { secret: string; code: string },
  ) {
    const valid = this.mfa.verifyTotp(body.secret, body.code);
    return { valid };
  }
}

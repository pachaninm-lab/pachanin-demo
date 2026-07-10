import { Body, Controller, Get, Headers, HttpCode, Ip, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequestUser, Role } from '../../common/types/request-user';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { RevokeUserSessionsDto } from './dto/revoke-user-sessions.dto';
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto';

@UseGuards(RolesGuard)
@Roles('ANY_AUTHENTICATED')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Public()
  @RateLimit({ name: 'auth_login', scope: 'ip', limit: 8, windowSeconds: 60, limitEnv: 'RATE_LIMIT_AUTH_LOGIN', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('login')
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.authService.login(dto, userAgent, ip);
  }

  @Public()
  @HttpCode(202)
  @RateLimit({ name: 'auth_password_reset_request', scope: 'ip', limit: 5, windowSeconds: 900, limitEnv: 'RATE_LIMIT_AUTH_PASSWORD_RESET', windowEnv: 'RATE_LIMIT_AUTH_PASSWORD_RESET_WINDOW_SECONDS' })
  @Post('password-reset/request')
  requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
    @Headers('x-password-reset-delivery-key') deliveryKey?: string,
    @Ip() ip?: string,
  ) {
    return this.passwordReset.request(dto.email, ip, deliveryKey);
  }

  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'auth_password_reset_confirm', scope: 'ip', limit: 8, windowSeconds: 900, limitEnv: 'RATE_LIMIT_AUTH_PASSWORD_RESET_CONFIRM', windowEnv: 'RATE_LIMIT_AUTH_PASSWORD_RESET_WINDOW_SECONDS' })
  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto, @Ip() ip?: string) {
    return this.passwordReset.confirm(dto.token, dto.newPassword, ip);
  }

  @Public()
  @RateLimit({ name: 'auth_register', scope: 'ip', limit: 5, windowSeconds: 300, limitEnv: 'RATE_LIMIT_AUTH_REGISTER', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @RateLimit({ name: 'auth_refresh', scope: 'ip', limit: 20, windowSeconds: 60, limitEnv: 'RATE_LIMIT_AUTH_REFRESH', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.authService.refresh(dto, userAgent, ip);
  }

  @Public()
  @RateLimit({ name: 'auth_mfa_verify', scope: 'ip', limit: 10, windowSeconds: 60, limitEnv: 'RATE_LIMIT_AUTH_MFA_VERIFY', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('mfa/verify')
  verifyMfa(@Body() dto: MfaVerifyDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.authService.verifyMfa(dto, userAgent, ip);
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto, @CurrentUser() user: RequestUser) {
    return this.authService.logout(dto, user?.sessionId);
  }

  @Post('sessions/revoke-user')
  @Roles(Role.ADMIN)
  revokeUserSessions(@Body() dto: RevokeUserSessionsDto) {
    return this.authService.revokeUserSessions(dto.userId, dto.reason || 'ADMIN_REVOKE');
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user);
  }

  @Public()
  @Get('sber-business/start')
  sberBusinessStart(@Query() query: { returnPath?: string; orgType?: string; inn?: string; legalName?: string; fullName?: string; email?: string }) {
    return this.authService.sberBusinessStart(query);
  }

  @Public()
  @Get('sber-business/callback')
  sberBusinessCallback(
    @Query() query: { code?: string; state?: string },
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.authService.sberBusinessCallback(query, userAgent, ip);
  }

  @Public()
  @Get('oidc/providers')
  oidcProviders() {
    return this.authService.oidcProviders();
  }

  @Public()
  @Get('oidc/authorization-url')
  oidcAuthorizationUrl() {
    return this.authService.oidcAuthorizationUrl();
  }

  @Get('me/data-export')
  dataExport(@CurrentUser() user: RequestUser) {
    return this.authService.getUserData(user.id);
  }

  @HttpCode(200)
  @Post('me/anonymize')
  anonymize(@CurrentUser() user: RequestUser) {
    return this.authService.anonymizeUser(user.id);
  }
}

import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Headers, Ip, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequestUser } from '../../common/types/request-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';

@UseGuards(RolesGuard)
@Roles('ANY_AUTHENTICATED')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit({ name: 'auth_login', scope: 'ip', limit: 8, windowSeconds: 60, limitEnv: 'RATE_LIMIT_AUTH_LOGIN', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('login')
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.authService.login(dto, userAgent, ip);
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

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto);
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
    @Ip() ip?: string
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
}

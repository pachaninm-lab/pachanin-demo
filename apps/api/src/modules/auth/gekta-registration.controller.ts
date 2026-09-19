import { Body, Controller, Headers, HttpCode, Ip, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { GektaRegistrationService } from './gekta-registration.service';
import { ProductSessionService } from './product-session.service';

/**
 * Регистрация и вход в Гекту.
 *
 * Маршруты публичные по необходимости — до регистрации сессии не существует.
 * Всё остальное решает сервер: пароль, подтверждение email и обязательный
 * MFA. Ни один шаг не выдаёт активную сессию раньше, чем пройдены все три.
 */
@Controller('gekta/auth')
export class GektaRegistrationController {
  constructor(
    private readonly registration: GektaRegistrationService,
    private readonly productSessions: ProductSessionService,
  ) {}

  @Public()
  @HttpCode(202)
  @RateLimit({ name: 'gekta_register', scope: 'ip', limit: 5, windowSeconds: 300, limitEnv: 'RATE_LIMIT_GEKTA_REGISTER', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('register')
  register(
    @Body() body: {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
      acceptedServiceTerms?: boolean;
      acceptedPersonalData?: boolean;
    },
    @Headers('x-registration-delivery-key') deliveryKey?: string,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.registration.register({
      email: String(body?.email ?? ''),
      password: String(body?.password ?? ''),
      fullName: String(body?.fullName ?? ''),
      phone: String(body?.phone ?? ''),
      acceptedServiceTerms: body?.acceptedServiceTerms === true,
      acceptedPersonalData: body?.acceptedPersonalData === true,
    }, deliveryKey, userAgent, ip);
  }

  @Public()
  @HttpCode(202)
  @RateLimit({ name: 'gekta_register_resend', scope: 'ip', limit: 5, windowSeconds: 300, limitEnv: 'RATE_LIMIT_GEKTA_REGISTER_RESEND', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('register/email/resend')
  resendEmail(
    @Body() body: { email?: string },
    @Headers('x-registration-delivery-key') deliveryKey?: string,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.registration.resendEmail(
      String(body?.email ?? ''),
      deliveryKey,
      userAgent,
      ip,
    );
  }

  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'gekta_register_verify', scope: 'ip', limit: 10, windowSeconds: 900, limitEnv: 'RATE_LIMIT_GEKTA_REGISTER_VERIFY', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('register/email/verify')
  verifyEmail(
    @Body() body: { token?: string },
    @Headers('x-registration-delivery-key') deliveryKey?: string,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.registration.verifyEmail(String(body?.token ?? ''), userAgent, ip, deliveryKey);
  }

  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'gekta_mfa_verify', scope: 'ip', limit: 10, windowSeconds: 900, limitEnv: 'RATE_LIMIT_GEKTA_MFA_VERIFY', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('mfa/verify')
  verifyMfa(
    @Body() body: { challengeToken?: string; code?: string },
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.registration.verifyMfa(
      String(body?.challengeToken ?? ''),
      String(body?.code ?? ''),
      userAgent,
      ip,
    );
  }

  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'gekta_login', scope: 'ip', limit: 8, windowSeconds: 60, limitEnv: 'RATE_LIMIT_GEKTA_LOGIN', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('login')
  login(
    @Body() body: { email?: string; password?: string },
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.registration.login(
      String(body?.email ?? ''),
      String(body?.password ?? ''),
      userAgent,
      ip,
    );
  }

  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'gekta_refresh', scope: 'ip', limit: 30, windowSeconds: 60, limitEnv: 'RATE_LIMIT_GEKTA_REFRESH', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('refresh')
  refresh(
    @Body() body: { refreshToken?: string },
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.productSessions.refresh(String(body?.refreshToken ?? ''), userAgent, ip);
  }

  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'gekta_logout', scope: 'ip', limit: 30, windowSeconds: 60, limitEnv: 'RATE_LIMIT_GEKTA_LOGOUT', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('logout')
  logout(
    @Body() body: { refreshToken?: string },
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.productSessions.logout(String(body?.refreshToken ?? ''), userAgent, ip);
  }
}

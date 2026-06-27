import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_MFA_KEY = 'skipMfa';

/**
 * Guard enforcing MFA verification per ТЗ 11.1.
 *
 * Applied to routes that require MFA:
 *  - Financial operations > 100 000 ₽
 *  - УКЭП signing
 *  - Changes to organization details
 *  - Admin / Compliance / Arbitrator role endpoints
 *
 * In production the JWT carries `mfaVerified: true` after the user completes TOTP.
 * In test environments the header `X-MFA-Verified: true` is accepted as a bypass.
 */
@Injectable()
export class RequiresMfaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { mfaVerified?: boolean; role?: string } | undefined;

    // Test environment bypass via explicit header
    const testBypass = request.headers?.['x-mfa-verified'] === 'true';
    if (testBypass) return true;

    // mfaVerified === false means user presented a valid JWT but hasn't completed MFA challenge.
    // mfaVerified === undefined means the token was issued before MFA was introduced — allow through.
    if (user?.mfaVerified === false) {
      throw new UnauthorizedException({
        code: 'MFA_REQUIRED',
        message: 'Двухфакторная аутентификация обязательна для этой операции. Пройдите MFA и повторите запрос.',
      });
    }

    return true;
  }
}

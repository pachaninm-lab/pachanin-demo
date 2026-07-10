import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_MFA_KEY = 'skipMfa';

/**
 * Critical-operation MFA guard.
 *
 * `request.user.mfaVerified` is not trusted from the JWT. It is computed by the
 * durable session verifier from auth_sessions.mfaVerifiedAt and a bounded TTL.
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
    const user = request.user as { mfaVerified?: boolean; sessionId?: string } | undefined;
    if (!user?.sessionId || user.mfaVerified !== true) {
      throw new UnauthorizedException({
        code: 'MFA_REQUIRED',
        message: 'Для этой операции требуется актуальное подтверждение MFA.',
      });
    }
    return true;
  }
}

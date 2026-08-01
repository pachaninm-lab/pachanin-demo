import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { RequestUser } from '../../common/types/request-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    // AppAuthGuard has already verified the signed token against the live
    // PostgreSQL session, user, membership, organization and tenant. Legacy
    // route guards must preserve that authoritative context instead of decoding
    // the short JWT and replacing it with incomplete, unverified role fields.
    if (!user?.id || !user.sessionId || !user.membershipId || !user.orgId || !user.tenantId || !user.role) {
      throw new UnauthorizedException('Verified server session is required');
    }
    return true;
  }
}

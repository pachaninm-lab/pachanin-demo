import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SECURITY_EVENTS, recordSecurityEvent, requestShape } from '../security/security-events';

/**
 * Business-role guard.
 *
 * Internal staff authority is deliberately not interpreted here. Staff access is
 * evaluated by the dedicated staff access control plane using durable
 * assignments, time-bound grants, tenant/resource scope and MFA. No role has a
 * global route bypass.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // Public-route handling is owned by AppAuthGuard before this guard runs.
    if (!user) return true;

    const userRole = String(user.role || '').toUpperCase();
    if (roles.includes('ANY_AUTHENTICATED')) return true;

    if (!roles.includes(userRole)) {
      // An authenticated caller reaching for a route their role may not have is
      // the business-logic bypass this requirement names. The role is recorded
      // because it is read from the session, not from the request.
      recordSecurityEvent(this.logger, SECURITY_EVENTS.AUTHORIZATION_REJECTED, {
        control: 'RolesGuard',
        reason: 'ROLE_NOT_PERMITTED',
        fields: [userRole],
        ...requestShape(req),
      });
      throw new ForbiddenException(`Role ${userRole} is not allowed here`);
    }
    return true;
  }
}

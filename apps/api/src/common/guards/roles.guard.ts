import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

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
      throw new ForbiddenException(`Role ${userRole} is not allowed here`);
    }
    return true;
  }
}

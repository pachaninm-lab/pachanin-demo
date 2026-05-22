import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Only ADMIN and SUPPORT_MANAGER bypass role-based route guards.
// EXECUTIVE is NOT privileged — it is read-only and subject to its own restrictions.
const BYPASS_ROLES = new Set(['ADMIN', 'SUPPORT_MANAGER']);

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

    // Public routes handled by AppAuthGuard before this guard runs
    if (!user) return true;

    const userRole = String(user.role || '').toUpperCase();

    if (roles.includes('ANY_AUTHENTICATED')) return true;

    // ADMIN / SUPPORT_MANAGER bypass route-level role restrictions
    if (BYPASS_ROLES.has(userRole)) return true;

    if (!roles.includes(userRole)) {
      throw new ForbiddenException(`Role ${userRole} is not allowed here`);
    }
    return true;
  }
}

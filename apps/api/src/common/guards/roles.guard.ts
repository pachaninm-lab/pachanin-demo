import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

const PRIVILEGED = new Set(['ADMIN', 'SUPPORT_MANAGER', 'EXECUTIVE']);

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

    // Public routes (no user yet) handled by AppAuthGuard
    if (!user) return true;

    const userRole = String(user.role || '').toUpperCase();

    // ANY_AUTHENTICATED matches all logged-in users
    if (roles.includes('ANY_AUTHENTICATED')) return true;

    // Privileged roles bypass all role checks
    if (PRIVILEGED.has(userRole)) return true;

    if (!roles.includes(userRole)) {
      throw new ForbiddenException(`Role ${userRole} is not allowed here`);
    }
    return true;
  }
}

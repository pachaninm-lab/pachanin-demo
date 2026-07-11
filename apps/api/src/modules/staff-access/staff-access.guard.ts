import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestUser } from '../../common/types/request-user';
import { StaffAccessService } from './staff-access.service';
import { STAFF_PERMISSIONS_KEY } from './staff-permissions.decorator';
import { StaffPermission } from './staff-access.types';

@Injectable()
export class StaffAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly staffAccess: StaffAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<StaffPermission[]>(STAFF_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser | undefined;
    if (!user) throw new UnauthorizedException('Authenticated staff actor is required');

    // A staff endpoint with no explicit permission is intentionally inaccessible.
    if (!required || required.length === 0) return false;
    for (const permission of required) {
      await this.staffAccess.requirePermission(user, permission);
    }
    return true;
  }
}

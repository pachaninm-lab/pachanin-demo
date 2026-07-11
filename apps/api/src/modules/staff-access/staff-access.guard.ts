import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestUser } from '../../common/types/request-user';
import { STAFF_ACCESS_MODES_KEY } from './staff-access-modes.decorator';
import { StaffAccessService } from './staff-access.service';
import { STAFF_PERMISSIONS_KEY } from './staff-permissions.decorator';
import {
  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
} from './staff-access.types';

type StaffGuardRequest = {
  user?: RequestUser;
  staffAccess?: StaffAccessContext;
  headers?: Record<string, string | string[] | undefined>;
};

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
    const allowedModes = this.reflector.getAllAndOverride<StaffAccessMode[]>(STAFF_ACCESS_MODES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<StaffGuardRequest>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated staff actor is required');

    // A staff endpoint with no explicit permission is intentionally inaccessible.
    if (!required || required.length === 0) return false;

    const rawHeader = request.headers?.['x-staff-access-session'];
    if (Array.isArray(rawHeader)) {
      throw new UnauthorizedException('Multiple staff access session headers are not allowed');
    }
    if (!request.staffAccess && !rawHeader) {
      throw new UnauthorizedException('Active time-bound staff access session is required');
    }

    const access = request.staffAccess
      ?? await this.staffAccess.resolveAccessSession(user, String(rawHeader));
    if (access.actorUserId !== user.id) {
      throw new UnauthorizedException('Staff access session actor mismatch');
    }
    if (allowedModes?.length && !allowedModes.includes(access.accessMode)) {
      throw new ForbiddenException(`Staff access mode ${access.accessMode} is not allowed for this endpoint`);
    }

    for (const permission of required) {
      if (!access.permissions.includes(permission)) {
        throw new ForbiddenException(`Active staff grant does not contain ${permission}`);
      }
      // Re-check the durable assignment so a revoked or reduced assignment cannot
      // continue authorizing an otherwise unexpired access session.
      await this.staffAccess.requirePermission(user, permission);
    }

    request.staffAccess = access;
    return true;
  }
}

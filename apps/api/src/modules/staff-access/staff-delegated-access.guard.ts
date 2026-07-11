import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { StaffAccessContext, StaffAccessMode, StaffPermission } from './staff-access.types';

type DelegatedRequest = {
  user?: { id?: string };
  staffAccess?: StaffAccessContext;
  params?: Record<string, string | undefined>;
};

@Injectable()
export class StaffDelegatedAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<DelegatedRequest>();
    const actorId = String(request.user?.id ?? '');
    const access = request.staffAccess;
    if (!actorId || !access) {
      throw new UnauthorizedException('An active X-Staff-Access-Session is required');
    }
    if (access.actorUserId !== actorId) {
      throw new ForbiddenException('Delegated session actor mismatch');
    }
    if (access.expiresAt <= new Date()) {
      throw new UnauthorizedException('Delegated session expired');
    }
    if (access.accessMode !== StaffAccessMode.VIEW_AS) {
      throw new ForbiddenException('Cabinet projection requires VIEW_AS mode');
    }
    if (!access.permissions.includes(StaffPermission.CABINET_VIEW_AS)) {
      throw new ForbiddenException('Delegated session lacks cabinet:view-as');
    }

    const targetOrganizationId = String(request.params?.organizationId ?? '');
    const targetRole = String(request.params?.role ?? '');
    if (!targetOrganizationId || access.effectiveOrganizationId !== targetOrganizationId) {
      throw new ForbiddenException('Delegated session is outside the target organization');
    }
    if (access.effectiveRole && access.effectiveRole !== targetRole) {
      throw new ForbiddenException('Delegated session is outside the target role');
    }
    return true;
  }
}

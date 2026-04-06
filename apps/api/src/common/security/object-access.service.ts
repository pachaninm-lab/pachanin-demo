import { ForbiddenException, Injectable } from '@nestjs/common';
import { RequestUser, Role } from '../types/request-user';

@Injectable()
export class ObjectAccessService {
  private readonly privilegedRoles = new Set([Role.ADMIN, Role.SUPPORT_MANAGER, Role.EXECUTIVE]);

  isPrivileged(user: RequestUser) {
    return this.privilegedRoles.has(user.role as any);
  }

  canAccessDeal(deal: any, user: RequestUser): boolean {
    if (this.isPrivileged(user)) return true;
    return deal.sellerOrgId === user.orgId || deal.buyerOrgId === user.orgId || deal.driverUserId === user.id;
  }

  assertDealAccess(deal: any, user: RequestUser) {
    if (!this.canAccessDeal(deal, user)) throw new ForbiddenException('Access denied to deal');
    return deal;
  }

  canAccessLot(lot: any, user: RequestUser): boolean {
    if (this.isPrivileged(user)) return true;
    if (user.role === Role.FARMER) return lot.sellerOrgId === user.orgId;
    return true; // buyers and others can see published lots
  }

  assertSameOrg(ownerOrgId: string | null | undefined, user: RequestUser) {
    if (!ownerOrgId || this.isPrivileged(user)) return true;
    if (ownerOrgId !== user.orgId) throw new ForbiddenException('Cross-tenant access denied');
    return true;
  }
}

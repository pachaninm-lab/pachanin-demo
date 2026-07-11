import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../common/types/request-user';
import { StaffAccessRepository } from './staff-access.repository';
import {
  RequestStaffAccessInput,
  StaffAccessService,
} from './staff-access.service';
import { StaffAccessContext, StaffPermission } from './staff-access.types';

export type StaffDealScopeRow = {
  tenant_id: string | null;
  seller_organization_id: string;
  buyer_organization_id: string;
};

@Injectable()
export class StaffAccessRequestService {
  constructor(
    private readonly repository: StaffAccessRepository,
    private readonly access: StaffAccessService,
  ) {}

  async listRequests(user: RequestUser, access?: StaffAccessContext) {
    let canReadAll = false;
    if (access) {
      if (access.accessMode !== 'CONTROL_PLANE') {
        throw new ForbiddenException('Only CONTROL_PLANE sessions can review staff access requests');
      }
      if (!access.permissions.includes(StaffPermission.STAFF_REQUEST_READ)) {
        throw new ForbiddenException('Active staff grant cannot read staff access requests');
      }
      await this.access.requirePermission(user, StaffPermission.STAFF_REQUEST_READ);
      canReadAll = true;
    }
    return this.repository.listAccessRequests(this.repository.prisma, user.id, canReadAll);
  }

  async requestAccess(
    user: RequestUser,
    input: RequestStaffAccessInput,
    correlationId?: string,
  ) {
    if (!input.targetDealId) {
      return this.access.requestAccess(user, input, correlationId);
    }

    const rows = await this.repository.prisma.$queryRaw<StaffDealScopeRow[]>(Prisma.sql`
      SELECT *
      FROM auth.staff_resolve_deal_scope(${user.id}, ${input.targetDealId})
    `);
    const scope = rows[0];
    if (!scope) throw new NotFoundException('Target deal not found');
    if (!scope.tenant_id) {
      throw new ForbiddenException('Target deal has no authoritative tenant scope');
    }

    if (input.targetTenantId && input.targetTenantId !== scope.tenant_id) {
      throw new ForbiddenException('Target deal and tenant scope mismatch');
    }
    if (
      input.targetOrganizationId
      && input.targetOrganizationId !== scope.seller_organization_id
      && input.targetOrganizationId !== scope.buyer_organization_id
    ) {
      throw new ForbiddenException('Target organization is not a participant in the target deal');
    }

    return this.access.requestAccess(user, {
      ...input,
      targetTenantId: scope.tenant_id,
    }, correlationId);
  }
}

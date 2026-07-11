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

export type StaffDealScopeRow = {
  tenant_id: string;
  seller_organization_id: string;
  buyer_organization_id: string;
};

@Injectable()
export class StaffAccessRequestService {
  constructor(
    private readonly repository: StaffAccessRepository,
    private readonly access: StaffAccessService,
  ) {}

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

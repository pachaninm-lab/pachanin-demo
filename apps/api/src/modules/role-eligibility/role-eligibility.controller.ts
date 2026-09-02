import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { StaffAccessGuard } from '../staff-access/staff-access.guard';
import { StaffAccessModes } from '../staff-access/staff-access-modes.decorator';
import { StaffPermissions } from '../staff-access/staff-permissions.decorator';
import { StaffAccessMode, StaffPermission, type StaffAccessContext } from '../staff-access/staff-access.types';
import { RoleEligibilityService } from './role-eligibility.service';
import { RoleEligibilitySourceHealthService } from './role-eligibility-source-health.service';

type ReviewerRequest = {
  user: RequestUser;
  staffAccess?: StaffAccessContext;
};

@Controller('role-eligibility')
@UseGuards(StaffAccessGuard)
@StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
export class RoleEligibilityController {
  constructor(
    private readonly eligibility: RoleEligibilityService,
    private readonly sourceHealth: RoleEligibilitySourceHealthService,
  ) {}

  @Get('application/:id')
  @StaffPermissions(StaffPermission.STAFF_REQUEST_READ)
  @RateLimit({ name: 'role_eligibility_application_read', scope: 'user', limit: 120, windowSeconds: 60, includeParams: ['id'] })
  application(@Req() request: ReviewerRequest, @Param('id') id: string) {
    return this.eligibility.application(id, this.requireAccess(request));
  }

  @Get('application/:id/evidence')
  @StaffPermissions(StaffPermission.STAFF_REQUEST_READ)
  @RateLimit({ name: 'role_eligibility_evidence_read', scope: 'user', limit: 120, windowSeconds: 60, includeParams: ['id'] })
  evidence(@Req() request: ReviewerRequest, @Param('id') id: string) {
    return this.eligibility.evidence(id, this.requireAccess(request));
  }

  @Post('application/:id/recheck')
  @StaffPermissions(StaffPermission.STAFF_REQUEST_APPROVE)
  @RateLimit({ name: 'role_eligibility_recheck', scope: 'user', limit: 30, windowSeconds: 900, includeParams: ['id'] })
  recheck(
    @Req() request: ReviewerRequest,
    @Param('id') id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.eligibility.recheck(id, this.requireAccess(request), correlationId || randomUUID());
  }

  @Get('sources/health')
  @StaffPermissions(StaffPermission.DIAGNOSTIC_READ)
  @RateLimit({ name: 'role_eligibility_source_health', scope: 'user', limit: 120, windowSeconds: 60 })
  sourceHealthSnapshot() {
    return this.sourceHealth.list();
  }

  private requireAccess(request: ReviewerRequest): StaffAccessContext {
    if (!request.staffAccess) throw new Error('ROLE_ELIGIBILITY_STAFF_ACCESS_CONTEXT_MISSING');
    return request.staffAccess;
  }
}

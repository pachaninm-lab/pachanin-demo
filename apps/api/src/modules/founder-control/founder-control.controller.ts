import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RequestUser } from '../../common/types/request-user';
import { StaffAccessGuard } from '../staff-access/staff-access.guard';
import { StaffAccessModes } from '../staff-access/staff-access-modes.decorator';
import { StaffPermissions } from '../staff-access/staff-permissions.decorator';
import { StaffWorkspaceAuditInterceptor } from '../staff-access/staff-workspace-audit.interceptor';
import {
  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
} from '../staff-access/staff-access.types';
import { FounderControlService } from './founder-control.service';

type FounderRequest = {
  user: RequestUser;
  staffAccess?: StaffAccessContext;
};

function parseLimit(value: string | undefined): number {
  if (value === undefined || value === '') return 50;
  if (!/^\d+$/.test(value)) throw new BadRequestException('limit must be an integer between 1 and 100');
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new BadRequestException('limit must be an integer between 1 and 100');
  }
  return parsed;
}

// Founder reads are SENSITIVE_READ staff endpoints: every route is registered in
// STAFF_ENDPOINT_POLICIES with its own mode/permission metadata, and every
// successful read is written to the hash-chained staff audit by the shared
// workspace audit interceptor (actor, staff role, access session, grant, route).
@Controller('staff/founder-control')
@UseGuards(StaffAccessGuard)
@UseInterceptors(StaffWorkspaceAuditInterceptor)
export class FounderControlController {
  constructor(private readonly founderControl: FounderControlService) {}

  @Get('overview')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.FOUNDER_CONTROL_READ)
  @RateLimit({ name: 'founder_control_overview', scope: 'user', limit: 60, windowSeconds: 60 })
  overview(
    @Req() request: FounderRequest,
    @Query('decisionLimit') decisionLimit?: string,
  ) {
    return this.founderControl.overview(request.user, parseLimit(decisionLimit));
  }

  @Get('company-health')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.FOUNDER_CONTROL_READ)
  @RateLimit({ name: 'founder_control_health', scope: 'user', limit: 60, windowSeconds: 60 })
  companyHealth(@Req() request: FounderRequest) {
    return this.founderControl.companyHealth(request.user);
  }

  @Get('decision-queue')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.FOUNDER_CONTROL_READ)
  @RateLimit({ name: 'founder_control_decision_queue', scope: 'user', limit: 60, windowSeconds: 60 })
  decisionQueue(
    @Req() request: FounderRequest,
    @Query('limit') limit?: string,
  ) {
    return this.founderControl.decisionQueue(request.user, parseLimit(limit));
  }

  @Get('metrics/:metricId/drill-down')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.FOUNDER_CONTROL_READ)
  @RateLimit({ name: 'founder_control_metric_drilldown', scope: 'user', limit: 60, windowSeconds: 60 })
  metricDrillDown(
    @Req() request: FounderRequest,
    @Param('metricId') metricId: string,
    @Query('limit') limit?: string,
  ) {
    return this.founderControl.metricDrillDown(request.user, metricId, parseLimit(limit));
  }
}

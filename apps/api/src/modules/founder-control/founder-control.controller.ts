import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RequestUser } from '../../common/types/request-user';
import { StaffAccessGuard } from '../staff-access/staff-access.guard';
import { StaffAccessModes } from '../staff-access/staff-access-modes.decorator';
import { StaffPermissions } from '../staff-access/staff-permissions.decorator';
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

@Controller('staff/founder-control')
@UseGuards(StaffAccessGuard)
@StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
@StaffPermissions(StaffPermission.FOUNDER_CONTROL_READ)
export class FounderControlController {
  constructor(private readonly founderControl: FounderControlService) {}

  @Get('overview')
  @RateLimit({ name: 'founder_control_overview', scope: 'user', limit: 60, windowSeconds: 60 })
  overview(
    @Req() request: FounderRequest,
    @Query('decisionLimit') decisionLimit?: string,
  ) {
    return this.founderControl.overview(request.user, parseLimit(decisionLimit));
  }

  @Get('company-health')
  @RateLimit({ name: 'founder_control_health', scope: 'user', limit: 60, windowSeconds: 60 })
  companyHealth(@Req() request: FounderRequest) {
    return this.founderControl.companyHealth(request.user);
  }

  @Get('decision-queue')
  @RateLimit({ name: 'founder_control_decision_queue', scope: 'user', limit: 60, windowSeconds: 60 })
  decisionQueue(
    @Req() request: FounderRequest,
    @Query('limit') limit?: string,
  ) {
    return this.founderControl.decisionQueue(request.user, parseLimit(limit));
  }

  @Get('metrics/:metricId/drill-down')
  @RateLimit({ name: 'founder_control_metric_drilldown', scope: 'user', limit: 60, windowSeconds: 60 })
  metricDrillDown(
    @Req() request: FounderRequest,
    @Param('metricId') metricId: string,
    @Query('limit') limit?: string,
  ) {
    return this.founderControl.metricDrillDown(request.user, metricId, parseLimit(limit));
  }
}

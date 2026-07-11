import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { RequestUser } from '../../common/types/request-user';
import {
  ActivateBreakGlassDto,
  ConsumeCriticalActionDto,
  CreateStaffAssignmentDto,
  DecideCriticalActionDto,
  DecideStaffAccessDto,
  EndStaffSessionDto,
  RequestCriticalActionDto,
  RequestStaffAccessDto,
  RevokeStaffAssignmentDto,
} from './staff-access.dto';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessModes } from './staff-access-modes.decorator';
import { StaffAccessRequestService } from './staff-access-request.service';
import { StaffAccessService } from './staff-access.service';
import { StaffAssignmentService } from './staff-assignment.service';
import { StaffAuditQuery, StaffAuditService } from './staff-audit.service';
import { StaffDelegatedAccessGuard } from './staff-delegated-access.guard';
import { StaffEmergencyService } from './staff-emergency.service';
import { StaffPermissions } from './staff-permissions.decorator';
import { StaffProjectionService } from './staff-projection.service';
import {
  StaffAccessContext,
  StaffAccessMode,
  StaffPermission,
} from './staff-access.types';

type StaffRequest = {
  user: RequestUser;
  staffAccess?: StaffAccessContext;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

@Controller('staff')
export class StaffAccessController {
  constructor(
    private readonly access: StaffAccessService,
    private readonly accessRequests: StaffAccessRequestService,
    private readonly assignments: StaffAssignmentService,
    private readonly audit: StaffAuditService,
    private readonly emergency: StaffEmergencyService,
    private readonly projection: StaffProjectionService,
  ) {}

  @Get('assignments/me')
  myAssignments(@Req() request: StaffRequest) {
    return this.access.listMyAssignments(request.user);
  }

  @Get('assignments')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_ASSIGNMENT_READ)
  listAssignments(@Req() request: StaffRequest) {
    return this.assignments.list(request.user);
  }

  @Post('assignments')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_ASSIGNMENT_WRITE)
  createAssignment(
    @Req() request: StaffRequest,
    @Body() body: CreateStaffAssignmentDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.assignments.create(request.user, body, correlationId);
  }

  @Post('assignments/:id/revoke')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_ASSIGNMENT_WRITE)
  revokeAssignment(
    @Req() request: StaffRequest,
    @Param('id') id: string,
    @Body() body: RevokeStaffAssignmentDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.assignments.revoke(request.user, id, body.reason, correlationId);
  }

  @Get('access/requests')
  listRequests(@Req() request: StaffRequest) {
    return this.accessRequests.listRequests(request.user);
  }

  @Get('access/requests/review')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_REQUEST_READ)
  reviewRequests(@Req() request: StaffRequest) {
    return this.access.listReviewRequests(request.user);
  }

  @Post('access/requests')
  requestAccess(
    @Req() request: StaffRequest,
    @Body() body: RequestStaffAccessDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.accessRequests.requestAccess(request.user, body, correlationId);
  }

  @Post('access/requests/:id/decision')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_REQUEST_APPROVE)
  decideRequest(
    @Req() request: StaffRequest,
    @Param('id') id: string,
    @Body() body: DecideStaffAccessDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.access.decideRequest(request.user, id, body, correlationId);
  }

  @Post('access/grants/:id/activate')
  activateGrant(
    @Req() request: StaffRequest,
    @Param('id') id: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-forwarded-for') forwardedFor?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.access.activateGrant(
      request.user,
      id,
      userAgent,
      String(forwardedFor || request.ip || '').split(',')[0]?.trim(),
      correlationId,
    );
  }

  @Get('access/sessions')
  listSessions(@Req() request: StaffRequest) {
    return this.access.listActiveSessions(request.user);
  }

  @Get('access/sessions/review')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_SESSION_READ)
  reviewSessions(@Req() request: StaffRequest) {
    return this.access.listAllActiveSessions(request.user);
  }

  @Post('access/sessions/:id/revoke')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_SESSION_REVOKE)
  revokeSession(
    @Req() request: StaffRequest,
    @Param('id') id: string,
    @Body() body: EndStaffSessionDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.access.revokeSession(request.user, id, body.reason, correlationId);
  }

  @Post('access/sessions/:id/end')
  endSession(
    @Req() request: StaffRequest,
    @Param('id') id: string,
    @Body() body: EndStaffSessionDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.access.endSession(request.user, id, body.reason, correlationId);
  }

  @Post('break-glass/activate')
  activateBreakGlass(
    @Req() request: StaffRequest,
    @Body() body: ActivateBreakGlassDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.access.activateBreakGlass(request.user, body, correlationId);
  }

  @Get('break-glass/active')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_SESSION_READ)
  activeBreakGlass(@Req() request: StaffRequest) {
    return this.emergency.listActive(request.user);
  }

  @Post('break-glass/:id/end')
  endBreakGlass(
    @Req() request: StaffRequest,
    @Param('id') id: string,
    @Body() body: EndStaffSessionDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.emergency.end(
      request.user,
      id,
      body.reason || 'Emergency access ended by staff actor',
      correlationId,
    );
  }

  @Post('critical-actions')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(
    StaffAccessMode.ASSISTED,
    StaffAccessMode.OPERATIONS,
    StaffAccessMode.JIT_PRIVILEGED,
  )
  @StaffPermissions(StaffPermission.CRITICAL_ACTION_REQUEST)
  requestCriticalAction(
    @Req() request: StaffRequest,
    @Body() body: RequestCriticalActionDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.access.requestCriticalAction(
      request.user,
      this.requireAccessContext(request),
      body,
      correlationId,
    );
  }

  @Post('critical-actions/:id/decision')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.CRITICAL_ACTION_APPROVE)
  approveCriticalAction(
    @Req() request: StaffRequest,
    @Param('id') id: string,
    @Body() body: DecideCriticalActionDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.access.approveCriticalAction(request.user, id, body, correlationId);
  }

  @Post('critical-actions/:id/consume')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(
    StaffAccessMode.ASSISTED,
    StaffAccessMode.OPERATIONS,
    StaffAccessMode.JIT_PRIVILEGED,
  )
  @StaffPermissions(StaffPermission.CRITICAL_ACTION_REQUEST)
  consumeCriticalAction(
    @Req() request: StaffRequest,
    @Param('id') id: string,
    @Body() body: ConsumeCriticalActionDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.access.consumeCriticalAction(
      request.user,
      this.requireAccessContext(request),
      id,
      body.payload,
      correlationId,
    );
  }

  @Get('organizations')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.ORGANIZATION_LIST)
  organizations(@Req() request: StaffRequest) {
    return this.projection.organizationDirectory(request.user);
  }

  @Get('organizations/:organizationId/users')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.USER_LIST)
  organizationUsers(
    @Req() request: StaffRequest,
    @Param('organizationId') organizationId: string,
  ) {
    return this.projection.organizationUsers(request.user, organizationId);
  }

  @Get('organizations/:organizationId/cabinet/:role')
  @UseGuards(StaffAccessGuard, StaffDelegatedAccessGuard)
  @StaffAccessModes(StaffAccessMode.VIEW_AS)
  @StaffPermissions(StaffPermission.CABINET_VIEW_AS)
  cabinetProjection(
    @Req() request: StaffRequest,
    @Param('organizationId') organizationId: string,
    @Param('role') role: string,
  ) {
    return this.projection.cabinetProjection(
      request.user,
      this.requireAccessContext(request),
      organizationId,
      role,
    );
  }

  @Get('audit/events')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.AUDIT_READ)
  auditEvents(
    @Req() request: StaffRequest,
    @Query() query: StaffAuditQuery,
  ) {
    return this.audit.search(request.user, query);
  }

  @Get('audit/actors/:actorUserId/verify')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.AUDIT_READ)
  verifyAuditActor(
    @Req() request: StaffRequest,
    @Param('actorUserId') actorUserId: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.verifyActorChain(request.user, actorUserId, limit);
  }

  private requireAccessContext(request: StaffRequest): StaffAccessContext {
    if (!request.staffAccess) {
      throw new UnauthorizedException('X-Staff-Access-Session is required');
    }
    return request.staffAccess;
  }
}

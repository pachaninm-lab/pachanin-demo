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
  CreateStaffAssignmentDto,
  DecideCriticalActionDto,
  EndStaffSessionDto,
  RequestCriticalActionDto,
  RevokeStaffAssignmentDto,
} from './staff-access.dto';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessModes } from './staff-access-modes.decorator';
import { StaffAccessService } from './staff-access.service';
import { StaffAssignmentService } from './staff-assignment.service';
import { StaffAuditService } from './staff-audit.service';
import { StaffEmergencyService } from './staff-emergency.service';
import { StaffPermissions } from './staff-permissions.decorator';
import { StaffProjectionService } from './staff-projection.service';
import { StaffAccessContext, StaffAccessMode, StaffPermission } from './staff-access.types';
import { StaffWorkspaceService } from './staff-workspace.service';

type StaffRequest = {
  user: RequestUser;
  staffAccess?: StaffAccessContext;
};

@Controller('staff/workspaces')
@UseGuards(StaffAccessGuard)
export class StaffWorkspaceController {
  constructor(
    private readonly workspaces: StaffWorkspaceService,
    private readonly assignments: StaffAssignmentService,
    private readonly projection: StaffProjectionService,
    private readonly emergency: StaffEmergencyService,
    private readonly audit: StaffAuditService,
    private readonly access: StaffAccessService,
  ) {}

  @Get('support')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.SUPPORT_CASE_READ)
  support(@Req() request: StaffRequest) {
    return this.workspaces.supportQueue(request.user);
  }

  @Get('operations')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE, StaffAccessMode.OPERATIONS)
  @StaffPermissions(StaffPermission.DEAL_LIST)
  operations(@Req() request: StaffRequest) {
    return this.workspaces.operationsQueue(request.user);
  }

  @Get('finance')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE, StaffAccessMode.JIT_PRIVILEGED)
  @StaffPermissions(StaffPermission.PAYMENT_METADATA_READ)
  finance(@Req() request: StaffRequest) {
    return this.workspaces.financeQueue(request.user);
  }

  @Get('diagnostics')
  @StaffAccessModes(
    StaffAccessMode.CONTROL_PLANE,
    StaffAccessMode.JIT_PRIVILEGED,
    StaffAccessMode.BREAK_GLASS,
  )
  @StaffPermissions(StaffPermission.DIAGNOSTIC_READ)
  diagnostics(@Req() request: StaffRequest) {
    return this.workspaces.diagnostics(request.user);
  }

  @Get('critical-actions')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.CRITICAL_ACTION_APPROVE)
  criticalActions(@Req() request: StaffRequest) {
    return this.workspaces.criticalActions(request.user);
  }

  @Post('critical-actions')
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
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.CRITICAL_ACTION_APPROVE)
  decideCriticalAction(
    @Req() request: StaffRequest,
    @Param('id') id: string,
    @Body() body: DecideCriticalActionDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.access.approveCriticalAction(request.user, id, body, correlationId);
  }

  @Get('assignments')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_ASSIGNMENT_READ)
  listAssignments(@Req() request: StaffRequest) {
    return this.assignments.list(request.user);
  }

  @Post('assignments')
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

  @Get('organizations/:organizationId/users')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.USER_LIST)
  organizationUsers(
    @Req() request: StaffRequest,
    @Param('organizationId') organizationId: string,
  ) {
    return this.projection.organizationUsers(request.user, organizationId);
  }

  @Get('break-glass')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_SESSION_READ)
  activeBreakGlass(@Req() request: StaffRequest) {
    return this.emergency.listActive(request.user);
  }

  @Post('break-glass/:id/end')
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE, StaffAccessMode.BREAK_GLASS)
  @StaffPermissions(StaffPermission.BREAK_GLASS_ACTIVATE)
  endBreakGlass(
    @Req() request: StaffRequest,
    @Param('id') id: string,
    @Body() body: EndStaffSessionDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.emergency.end(
      request.user,
      id,
      body.reason || 'Emergency access ended from Staff Control Center',
      correlationId,
    );
  }

  @Get('audit/actors/:actorUserId/verify')
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
    if (!request.staffAccess) throw new UnauthorizedException('X-Staff-Access-Session is required');
    return request.staffAccess;
  }
}

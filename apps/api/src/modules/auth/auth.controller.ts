import { randomUUID } from 'crypto';
import { Body, Controller, Get, Headers, HttpCode, Ip, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequestUser, Role } from '../../common/types/request-user';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { RegistrationApplicationService } from './registration-application.service';
import { RegistrationDecisionService } from './registration-decision.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { RevokeUserSessionsDto } from './dto/revoke-user-sessions.dto';
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto';
import { RegistrationAdditionalInformationDto, ResendRegistrationEmailDto, VerifyRegistrationEmailDto } from './dto/registration-application.dto';
import { OrganizationTeamService } from './organization-team.service';
import { MembershipSelectDto } from './dto/membership-select.dto';
import { OrganizationInvitationService } from './organization-invitation.service';
import {
  AcceptOrganizationInvitationDto,
  ConfirmMfaRecoveryDto,
  CreateOrganizationInvitationDto,
  OrganizationInvitationCommandDto,
  OrganizationJoinDecisionDto,
  OrganizationMembershipRevokeDto,
  OrganizationMembershipRoleDto,
} from './dto/organization-access.dto';

@UseGuards(RolesGuard)
@Roles('ANY_AUTHENTICATED')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly organizationTeamService: OrganizationTeamService,
    private readonly passwordReset: PasswordResetService,
    private readonly registrationApplications: RegistrationApplicationService,
    private readonly registrationDecisions: RegistrationDecisionService,
    private readonly organizationInvitations: OrganizationInvitationService,
  ) {}

  @Public()
  @RateLimit({ name: 'auth_login', scope: 'ip', limit: 8, windowSeconds: 60, limitEnv: 'RATE_LIMIT_AUTH_LOGIN', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('login')
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.authService.login(dto, userAgent, ip);
  }

  @Public()
  @RateLimit({ name: 'auth_membership_select', scope: 'ip', limit: 10, windowSeconds: 300, limitEnv: 'RATE_LIMIT_AUTH_MEMBERSHIP_SELECT', windowEnv: 'RATE_LIMIT_AUTH_MEMBERSHIP_SELECT_WINDOW_SECONDS' })
  @Post('membership/select')
  selectMembership(
    @Body() dto: MembershipSelectDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.authService.selectMembership(dto, userAgent, ip);
  }

  @Public()
  @HttpCode(202)
  @RateLimit({ name: 'auth_password_reset_request', scope: 'ip', limit: 5, windowSeconds: 900, limitEnv: 'RATE_LIMIT_AUTH_PASSWORD_RESET', windowEnv: 'RATE_LIMIT_AUTH_PASSWORD_RESET_WINDOW_SECONDS' })
  @Post('password-reset/request')
  requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
    @Headers('x-password-reset-delivery-key') deliveryKey?: string,
    @Ip() ip?: string,
  ) {
    return this.passwordReset.request(dto.email, ip, deliveryKey);
  }

  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'auth_password_reset_confirm', scope: 'ip', limit: 8, windowSeconds: 900, limitEnv: 'RATE_LIMIT_AUTH_PASSWORD_RESET_CONFIRM', windowEnv: 'RATE_LIMIT_AUTH_PASSWORD_RESET_WINDOW_SECONDS' })
  @Post('password-reset/confirm')
  confirmPasswordReset(
    @Body() dto: ConfirmPasswordResetDto,
    @Headers('x-password-reset-delivery-key') deliveryKey?: string,
    @Ip() ip?: string,
  ) {
    return this.passwordReset.confirm(dto.token, dto.newPassword, ip, deliveryKey);
  }

  @Public()
  @HttpCode(202)
  @RateLimit({ name: 'auth_register', scope: 'ip', limit: 5, windowSeconds: 300, limitEnv: 'RATE_LIMIT_AUTH_REGISTER', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-registration-delivery-key') deliveryKey?: string,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.registrationApplications.submit(dto, {
      idempotencyKey,
      correlationId: correlationId || randomUUID(),
      deliveryKey,
      userAgent,
      ip,
    });
  }

  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'auth_registration_email_verify', scope: 'ip', limit: 10, windowSeconds: 900, limitEnv: 'RATE_LIMIT_AUTH_REGISTRATION_VERIFY', windowEnv: 'RATE_LIMIT_AUTH_REGISTRATION_VERIFY_WINDOW_SECONDS' })
  @Post('registration/email/verify')
  verifyRegistrationEmail(
    @Body() dto: VerifyRegistrationEmailDto,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-registration-delivery-key') deliveryKey?: string,
  ) {
    return this.registrationApplications.verifyEmail(dto.token, correlationId || randomUUID(), deliveryKey);
  }

  @Public()
  @HttpCode(202)
  @RateLimit({ name: 'auth_registration_email_resend', scope: 'ip', limit: 5, windowSeconds: 900, limitEnv: 'RATE_LIMIT_AUTH_REGISTRATION_RESEND', windowEnv: 'RATE_LIMIT_AUTH_REGISTRATION_RESEND_WINDOW_SECONDS' })
  @Post('registration/email/resend')
  resendRegistrationEmail(
    @Body() dto: ResendRegistrationEmailDto,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-registration-delivery-key') deliveryKey?: string,
  ) {
    return this.registrationApplications.resendEmail(dto.email, correlationId || randomUUID(), deliveryKey);
  }

  @Public()
  @RateLimit({ name: 'auth_registration_status', scope: 'ip', limit: 30, windowSeconds: 60, limitEnv: 'RATE_LIMIT_AUTH_REGISTRATION_STATUS', windowEnv: 'RATE_LIMIT_AUTH_REGISTRATION_STATUS_WINDOW_SECONDS' })
  @Get('registration/status')
  registrationStatus(@Query('token') token?: string) {
    return this.registrationApplications.status(String(token || ''));
  }

  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'auth_registration_additional_information', scope: 'ip', limit: 8, windowSeconds: 900, limitEnv: 'RATE_LIMIT_AUTH_REGISTRATION_INFORMATION', windowEnv: 'RATE_LIMIT_AUTH_REGISTRATION_INFORMATION_WINDOW_SECONDS' })
  @Post('registration/additional-information')
  registrationAdditionalInformation(
    @Body() dto: RegistrationAdditionalInformationDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.registrationApplications.provideAdditionalInformation(
      dto.statusToken,
      dto.response,
      correlationId || randomUUID(),
    );
  }

  @Get('organization-join-requests')
  @RateLimit({ name: 'auth_organization_join_request_list', scope: 'user', limit: 60, windowSeconds: 60 })
  organizationJoinRequests(@CurrentUser() reviewer: RequestUser) {
    return this.registrationDecisions.listOrganizationJoinRequests(reviewer);
  }

  @Post('organization-join-requests/:applicationId/decision')
  @RateLimit({ name: 'auth_organization_join_request_decision', scope: 'user', limit: 20, windowSeconds: 900, includeParams: ['applicationId'] })
  organizationJoinDecision(
    @Param('applicationId') applicationId: string,
    @Body() dto: OrganizationJoinDecisionDto,
    @CurrentUser() reviewer: RequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-registration-delivery-key') deliveryKey?: string,
  ) {
    return this.registrationDecisions.decideOrganizationJoin(
      applicationId,
      dto.decision,
      dto.reason,
      reviewer,
      String(idempotencyKey || ''),
      correlationId || randomUUID(),
      deliveryKey,
    );
  }

  @Public()
  @RateLimit({ name: 'auth_refresh', scope: 'ip', limit: 20, windowSeconds: 60, limitEnv: 'RATE_LIMIT_AUTH_REFRESH', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.authService.refresh(dto, userAgent, ip);
  }

  @Public()
  @RateLimit({ name: 'auth_mfa_verify', scope: 'ip', limit: 10, windowSeconds: 60, limitEnv: 'RATE_LIMIT_AUTH_MFA_VERIFY', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  @Post('mfa/verify')
  verifyMfa(@Body() dto: MfaVerifyDto, @Headers('user-agent') userAgent?: string, @Ip() ip?: string) {
    return this.authService.verifyMfa(dto, userAgent, ip);
  }

  @RateLimit({ name: 'auth_mfa_step_up_start', scope: 'user', limit: 5, windowSeconds: 300 })
  @Post('mfa/step-up/start')
  startMfaStepUp(
    @CurrentUser() user: RequestUser,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.authService.startMfaStepUp(user, userAgent, ip);
  }

  @RateLimit({ name: 'auth_mfa_step_up_verify', scope: 'user', limit: 10, windowSeconds: 300 })
  @Post('mfa/step-up/verify')
  verifyMfaStepUp(
    @Body() dto: MfaVerifyDto,
    @CurrentUser() user: RequestUser,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.authService.verifyMfaStepUp(user, dto, userAgent, ip);
  }

  @Post('logout')
  @Public()
  @RateLimit({ name: 'auth_logout', scope: 'ip', limit: 30, windowSeconds: 60, limitEnv: 'RATE_LIMIT_AUTH_LOGOUT', windowEnv: 'RATE_LIMIT_WINDOW_SECONDS' })
  logout(@Body() dto: LogoutDto, @CurrentUser() user: RequestUser) {
    return this.authService.logout(dto, user?.sessionId);
  }

  @Post('sessions/revoke-user')
  @Roles(Role.ADMIN)
  revokeUserSessions(@Body() dto: RevokeUserSessionsDto) {
    return this.authService.revokeUserSessions(dto.userId, dto.reason || 'ADMIN_REVOKE');
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user);
  }

  @Get('organization-team')
  organizationTeam(@CurrentUser() user: RequestUser) {
    return this.organizationTeamService.readFor(user);
  }

  @Get('organization-invitations')
  @RateLimit({ name: 'auth_organization_invitation_list', scope: 'user', limit: 60, windowSeconds: 60 })
  organizationInvitationList(@CurrentUser() user: RequestUser) {
    return this.organizationInvitations.list(user);
  }

  @Post('organization-invitations')
  @RateLimit({ name: 'auth_organization_invitation_create', scope: 'user', limit: 10, windowSeconds: 900 })
  createOrganizationInvitation(
    @Body() dto: CreateOrganizationInvitationDto,
    @CurrentUser() user: RequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-organization-invitation-delivery-key') deliveryKey?: string,
  ) {
    return this.organizationInvitations.create(
      user,
      dto.email,
      dto.role,
      String(idempotencyKey || ''),
      correlationId || randomUUID(),
      deliveryKey,
    );
  }

  @Post('organization-invitations/:invitationId/resend')
  @RateLimit({ name: 'auth_organization_invitation_resend', scope: 'user', limit: 5, windowSeconds: 900, includeParams: ['invitationId'] })
  resendOrganizationInvitation(
    @Param('invitationId') invitationId: string,
    @Body() dto: OrganizationInvitationCommandDto,
    @CurrentUser() user: RequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-organization-invitation-delivery-key') deliveryKey?: string,
  ) {
    return this.organizationInvitations.resend(
      user,
      invitationId,
      dto.reason,
      String(idempotencyKey || ''),
      correlationId || randomUUID(),
      deliveryKey,
    );
  }

  @Post('organization-invitations/:invitationId/revoke')
  @RateLimit({ name: 'auth_organization_invitation_revoke', scope: 'user', limit: 20, windowSeconds: 900, includeParams: ['invitationId'] })
  revokeOrganizationInvitation(
    @Param('invitationId') invitationId: string,
    @Body() dto: OrganizationInvitationCommandDto,
    @CurrentUser() user: RequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.organizationInvitations.revoke(
      user,
      invitationId,
      dto.reason,
      String(idempotencyKey || ''),
      correlationId || randomUUID(),
    );
  }

  @Public()
  @RateLimit({ name: 'auth_organization_invitation_accept', scope: 'ip', limit: 8, windowSeconds: 900, limitEnv: 'RATE_LIMIT_AUTH_INVITATION_ACCEPT', windowEnv: 'RATE_LIMIT_AUTH_INVITATION_ACCEPT_WINDOW_SECONDS' })
  @Post('organization-invitations/accept')
  acceptOrganizationInvitation(
    @Body() dto: AcceptOrganizationInvitationDto,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.organizationInvitations.accept(dto, correlationId || randomUUID(), ip, userAgent);
  }

  @Post('organization-memberships/:membershipId/role')
  @RateLimit({ name: 'auth_organization_membership_role', scope: 'user', limit: 20, windowSeconds: 900, includeParams: ['membershipId'] })
  changeOrganizationMembershipRole(
    @Param('membershipId') membershipId: string,
    @Body() dto: OrganizationMembershipRoleDto,
    @CurrentUser() user: RequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.organizationInvitations.changeMembershipRole(
      user,
      membershipId,
      dto.role,
      BigInt(dto.version),
      dto.reason,
      String(idempotencyKey || ''),
      correlationId || randomUUID(),
    );
  }

  @Post('organization-memberships/:membershipId/revoke')
  @RateLimit({ name: 'auth_organization_membership_revoke', scope: 'user', limit: 20, windowSeconds: 900, includeParams: ['membershipId'] })
  revokeOrganizationMembership(
    @Param('membershipId') membershipId: string,
    @Body() dto: OrganizationMembershipRevokeDto,
    @CurrentUser() user: RequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.organizationInvitations.revokeMembership(
      user,
      membershipId,
      BigInt(dto.version),
      dto.reason,
      String(idempotencyKey || ''),
      correlationId || randomUUID(),
    );
  }

  @Post('organization-memberships/:membershipId/mfa-reset')
  @RateLimit({ name: 'auth_organization_membership_mfa_reset', scope: 'user', limit: 5, windowSeconds: 900, includeParams: ['membershipId'] })
  resetOrganizationMembershipMfa(
    @Param('membershipId') membershipId: string,
    @Body() dto: OrganizationMembershipRevokeDto,
    @CurrentUser() user: RequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-organization-invitation-delivery-key') deliveryKey?: string,
  ) {
    return this.organizationInvitations.resetMembershipMfa(
      user,
      membershipId,
      BigInt(dto.version),
      dto.reason,
      String(idempotencyKey || ''),
      correlationId || randomUUID(),
      deliveryKey,
    );
  }

  @Public()
  @RateLimit({ name: 'auth_mfa_recovery_confirm', scope: 'ip', limit: 8, windowSeconds: 900 })
  @Post('mfa-recovery/confirm')
  confirmMfaRecovery(
    @Body() dto: ConfirmMfaRecoveryDto,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-organization-invitation-delivery-key') deliveryKey?: string,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.organizationInvitations.confirmMfaRecovery(
      dto,
      correlationId || randomUUID(),
      deliveryKey,
      ip,
      userAgent,
    );
  }

  @Public()
  @Get('sber-business/start')
  sberBusinessStart(@Query() query: { returnPath?: string; orgType?: string; inn?: string; legalName?: string; fullName?: string; email?: string }) {
    return this.authService.sberBusinessStart(query);
  }

  @Public()
  @Get('sber-business/callback')
  sberBusinessCallback(
    @Query() query: { code?: string; state?: string },
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.authService.sberBusinessCallback(query, userAgent, ip);
  }

  @Public()
  @Get('oidc/providers')
  oidcProviders() {
    return this.authService.oidcProviders();
  }

  @Public()
  @Get('oidc/authorization-url')
  oidcAuthorizationUrl() {
    return this.authService.oidcAuthorizationUrl();
  }

  @Get('me/data-export')
  dataExport(@CurrentUser() user: RequestUser) {
    return this.authService.getUserData(user.id);
  }

  @HttpCode(200)
  @Post('me/anonymize')
  anonymize(@CurrentUser() user: RequestUser) {
    return this.authService.anonymizeUser(user.id);
  }
}

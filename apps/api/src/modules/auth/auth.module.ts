import { Module } from '@nestjs/common';
import { AuthMailModule } from '../auth-mail/auth-mail.module';
import { BusinessReputationModule } from '../business-reputation/business-reputation.module';
import { AuthController } from './auth.controller';
import { AuthPrismaService } from './auth-prisma.service';
import { AuthService } from './auth.service';
import { GektaRegistrationController } from './gekta-registration.controller';
import { GektaRegistrationService } from './gekta-registration.service';
import './legacy-admin-identity-boundary';
import { OrganizationTeamService } from './organization-team.service';
import { OrganizationInvitationService } from './organization-invitation.service';
import { PasswordResetRepository } from './password-reset.repository';
import { PasswordResetService } from './password-reset.service';
import { PersistentAuthRepository } from './persistent-auth.repository';
import { ProductSessionService } from './product-session.service';
import { RegistrationApplicationService } from './registration-application.service';
import { RegistrationDecisionService } from './registration-decision.service';

@Module({
  imports: [BusinessReputationModule, AuthMailModule],
  controllers: [AuthController, GektaRegistrationController],
  providers: [
    AuthPrismaService,
    {
      provide: PersistentAuthRepository,
      inject: [AuthPrismaService],
      useFactory: (prisma: AuthPrismaService) => new PersistentAuthRepository(prisma),
    },
    PasswordResetRepository,
    PasswordResetService,
    RegistrationApplicationService,
    RegistrationDecisionService,
    AuthService,
    ProductSessionService,
    GektaRegistrationService,
    OrganizationTeamService,
    OrganizationInvitationService,
  ],
  exports: [
    AuthService,
    ProductSessionService,
    GektaRegistrationService,
    OrganizationTeamService,
    OrganizationInvitationService,
    PasswordResetService,
    RegistrationApplicationService,
    RegistrationDecisionService,
    PersistentAuthRepository,
    AuthPrismaService,
  ],
})
export class AuthModule {}

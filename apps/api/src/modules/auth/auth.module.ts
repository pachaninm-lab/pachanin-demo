import { Module } from '@nestjs/common';
import { BusinessReputationModule } from '../business-reputation/business-reputation.module';
import { AuthController } from './auth.controller';
import { AuthPrismaService } from './auth-prisma.service';
import { AuthService } from './auth.service';
import { OrganizationTeamService } from './organization-team.service';
import { PasswordResetRepository } from './password-reset.repository';
import { PasswordResetService } from './password-reset.service';
import { PersistentAuthRepository } from './persistent-auth.repository';
import { RegistrationApplicationService } from './registration-application.service';
import { RegistrationDecisionService } from './registration-decision.service';

@Module({
  imports: [BusinessReputationModule],
  controllers: [AuthController],
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
    OrganizationTeamService,
  ],
  exports: [
    AuthService,
    OrganizationTeamService,
    PasswordResetService,
    RegistrationApplicationService,
    RegistrationDecisionService,
    PersistentAuthRepository,
    AuthPrismaService,
  ],
})
export class AuthModule {}

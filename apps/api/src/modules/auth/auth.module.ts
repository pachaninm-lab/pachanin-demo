import { Module } from '@nestjs/common';
import { BusinessReputationModule } from '../business-reputation/business-reputation.module';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [BusinessReputationModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionService, PasswordResetService],
  exports: [AuthService, AuthSessionService, PasswordResetService],
})
export class AuthModule {}

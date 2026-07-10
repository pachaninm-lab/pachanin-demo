import { Module } from '@nestjs/common';
import { BusinessReputationModule } from '../business-reputation/business-reputation.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PersistentAuthSessionService } from './persistent-auth-session.service';

@Module({
  imports: [BusinessReputationModule],
  controllers: [AuthController],
  providers: [AuthService, PersistentAuthSessionService],
  exports: [AuthService, PersistentAuthSessionService],
})
export class AuthModule {}

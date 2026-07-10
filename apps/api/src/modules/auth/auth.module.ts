import { Module } from '@nestjs/common';
import { BusinessReputationModule } from '../business-reputation/business-reputation.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PersistentAuthRepository } from './persistent-auth.repository';

@Module({
  imports: [BusinessReputationModule],
  controllers: [AuthController],
  providers: [PersistentAuthRepository, AuthService],
  exports: [AuthService, PersistentAuthRepository],
})
export class AuthModule {}

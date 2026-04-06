import { Module } from '@nestjs/common';
import { BusinessReputationModule } from '../business-reputation/business-reputation.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [BusinessReputationModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}

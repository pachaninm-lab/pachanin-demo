import { Module } from '@nestjs/common';
import { BusinessReputationModule } from '../business-reputation/business-reputation.module';
import { AuthController } from './auth.controller';
import { AuthPrismaService } from './auth-prisma.service';
import { AuthService } from './auth.service';
import { PasswordResetRepository } from './password-reset.repository';
import { PasswordResetService } from './password-reset.service';
import { PersistentAuthRepository } from './persistent-auth.repository';

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
    AuthService,
  ],
  exports: [
    AuthService,
    PasswordResetService,
    PersistentAuthRepository,
    AuthPrismaService,
  ],
})
export class AuthModule {}

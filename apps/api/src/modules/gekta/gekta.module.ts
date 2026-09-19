import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { GektaAccessService } from './gekta-access.service';
import { GektaOperatorService } from './gekta-operator.service';
import { GektaPhoneService } from './gekta-phone.service';
import { GektaWorkspaceService } from './gekta-workspace.service';
import { GektaOperatorGuard } from './gekta-operator.guard';
import { GektaSessionGuard } from './gekta-session.guard';
import { GektaController, GektaOperatorController } from './gekta.controller';
import { AuthModule } from '../auth/auth.module';
import { StaffAccessModule } from '../staff-access/staff-access.module';
import { StaffAccessService } from '../staff-access/staff-access.service';
import { Reflector } from '@nestjs/core';
import { RateLimitModule } from '../../common/security/rate-limit.module';
import { GektaAnonymousAdmissionController } from './gekta-anonymous-admission.controller';
import { GektaAnonymousAdmissionService } from './gekta-anonymous-admission.service';

/**
 * Гекта переиспользует существующие PostgreSQL, Prisma и identity платформы.
 * Второй контур аутентификации или базы данных не создаётся.
 *
 * Штатные роли берутся из StaffAccessService — того же источника, которым
 * платформа пользуется на своих служебных маршрутах. Отдельного хранилища
 * ролей у продукта нет.
 */
@Module({
  imports: [PrismaModule, RateLimitModule, AuthModule, StaffAccessModule],
  controllers: [GektaController, GektaOperatorController, GektaAnonymousAdmissionController],
  providers: [
    GektaSessionGuard,
    GektaAccessService,
    GektaOperatorService,
    GektaPhoneService,
    GektaWorkspaceService,
    GektaAnonymousAdmissionService,
    {
      provide: GektaOperatorGuard,
      inject: [Reflector, StaffAccessService],
      useFactory: (reflector: Reflector, staffAccess: StaffAccessService) => new GektaOperatorGuard(reflector, staffAccess),
    },
  ],
  exports: [GektaAccessService, GektaOperatorService, GektaPhoneService, GektaWorkspaceService],
})
export class GektaModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { GektaAccessService } from './gekta-access.service';
import { GektaOperatorService } from './gekta-operator.service';
import { GektaPhoneService } from './gekta-phone.service';
import { GektaWorkspaceService } from './gekta-workspace.service';
import { GektaOperatorGuard } from './gekta-operator.guard';

/**
 * Гекта переиспользует существующие PostgreSQL, Prisma и identity платформы.
 * Второй контур аутентификации или базы данных не создаётся.
 */
@Module({
  imports: [PrismaModule],
  providers: [GektaAccessService, GektaOperatorService, GektaPhoneService, GektaWorkspaceService, GektaOperatorGuard],
  exports: [GektaAccessService, GektaOperatorService, GektaPhoneService, GektaWorkspaceService],
})
export class GektaModule {}

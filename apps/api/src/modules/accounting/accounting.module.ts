import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccountingController } from './accounting.controller';
import { AccountingDocumentVersionRepository } from './accounting-document-version.repository';
import { AccountingSourceSnapshotRepository } from './accounting-source-snapshot.repository';
import { AccountingPeriodRepository } from './accounting-period.repository';
import { DocumentTransmissionRepository } from './document-transmission.repository';
import { WorkTaskDeriver } from './work-task.deriver';
import { WorkTaskRepository } from './work-task.repository';

/**
 * The accounting contour, wired.
 *
 * Deliberately small. It provides the two repositories that carry the
 * transactional guarantees — assembling a snapshot atomically and writing a
 * version under one transaction with it — and nothing else. The policies stay
 * pure functions: they are decisions, and a decision that needs injecting is a
 * decision somebody can swap out at runtime.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AccountingController],
  providers: [
    AccountingSourceSnapshotRepository,
    AccountingDocumentVersionRepository,
    WorkTaskRepository,
    WorkTaskDeriver,
    AccountingPeriodRepository,
    DocumentTransmissionRepository,
  ],
  exports: [
    AccountingSourceSnapshotRepository,
    AccountingDocumentVersionRepository,
    WorkTaskRepository,
    WorkTaskDeriver,
    AccountingPeriodRepository,
    DocumentTransmissionRepository,
  ],
})
export class AccountingModule {}

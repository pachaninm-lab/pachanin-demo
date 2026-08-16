import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccountingController } from './accounting.controller';
import { AccountingDocumentVersionRepository } from './accounting-document-version.repository';
import { AccountingSourceSnapshotRepository } from './accounting-source-snapshot.repository';

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
  ],
  exports: [
    AccountingSourceSnapshotRepository,
    AccountingDocumentVersionRepository,
  ],
})
export class AccountingModule {}

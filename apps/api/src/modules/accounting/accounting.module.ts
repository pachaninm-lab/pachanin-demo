import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccountingController } from './accounting.controller';
import { AccountingDocumentVersionRepository } from './accounting-document-version.repository';
import { AccountingSourceSnapshotRepository } from './accounting-source-snapshot.repository';
import { AdvanceRepository } from './advance.repository';
import { DealServiceRepository } from './deal-service.repository';
import { PaymentRepository } from './payment.repository';
import { ConnectionAttestationRepository } from './connection-attestation.repository';
import { ConnectionCenterRepository } from './connection-center.repository';
import { OneCRuntimeRepository } from './one-c-runtime.repository';
import { ReconciliationRepository } from './reconciliation.repository';
import { AccountingPeriodRepository } from './accounting-period.repository';
import { DocumentTransmissionRepository } from './document-transmission.repository';
import { WorkTaskDeriver } from './work-task.deriver';
import { WorkTaskRepository } from './work-task.repository';

/**
 * The accounting contour, wired.
 *
 * Deliberately small. It provides the repositories that carry the transactional
 * guarantees — including the bounded 1C installation/binding/pairing authority
 * — and nothing else. The policies stay pure functions: they are decisions, and
 * a decision that needs injecting is a decision somebody can swap at runtime.
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
    AdvanceRepository,
    DealServiceRepository,
    PaymentRepository,
    ReconciliationRepository,
    ConnectionCenterRepository,
    ConnectionAttestationRepository,
    OneCRuntimeRepository,
  ],
  exports: [
    AccountingSourceSnapshotRepository,
    AccountingDocumentVersionRepository,
    WorkTaskRepository,
    WorkTaskDeriver,
    AccountingPeriodRepository,
    DocumentTransmissionRepository,
    AdvanceRepository,
    DealServiceRepository,
    PaymentRepository,
    ReconciliationRepository,
    ConnectionCenterRepository,
    ConnectionAttestationRepository,
    OneCRuntimeRepository,
  ],
})
export class AccountingModule {}

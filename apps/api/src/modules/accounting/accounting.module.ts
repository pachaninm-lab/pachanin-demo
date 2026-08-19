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
import { OneCConnectionManagementController } from './one-c-connection-management.controller';
import { OneCConnectorController } from './one-c-connector.controller';
import {
  OneCConnectorHeartbeatController,
  OneCHeartbeatManagementController,
} from './one-c-heartbeat.controller';
import { OneCHeartbeatRepository } from './one-c-heartbeat.repository';
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
 * and machine-authenticated heartbeat state — plus the narrow HTTP surfaces
 * needed to bootstrap and observe that authority. The policies stay pure
 * functions: they are decisions, and a decision that needs injecting is a
 * decision somebody can swap at runtime.
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    AccountingController,
    OneCConnectionManagementController,
    OneCConnectorController,
    OneCConnectorHeartbeatController,
    OneCHeartbeatManagementController,
  ],
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
    OneCHeartbeatRepository,
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
    OneCHeartbeatRepository,
  ],
})
export class AccountingModule {}

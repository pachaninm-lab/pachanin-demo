import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { LabsController } from './labs.controller';
import { LabsService } from './labs.service';
import { PrismaLabRepository } from './prisma-lab.repository';
import { AuthorizedPrismaLabRepository } from './authorized-prisma-lab.repository';
import { LAB_REPOSITORY } from './lab.repository';
import { LabAuthorityService } from './lab-authority.service';
import { LabEvidenceUploadService } from './lab-evidence-upload.service';

/**
 * Production laboratory operations are PostgreSQL-authoritative by construction.
 * RuntimeCore, repository factories, optional Prisma dependencies and simulated
 * external laboratory providers are absent from this dependency graph.
 *
 * AuthorizedPrismaLabRepository performs fail-fast operation-specific actor and
 * evidence checks; PostgreSQL triggers repeat those checks atomically and remain
 * the final authority. Evidence purpose is derived by LabEvidenceUploadService
 * and persisted before object upload; the public storage endpoint cannot author
 * laboratory purpose metadata.
 */
@Module({
  imports: [StorageModule],
  controllers: [LabsController],
  providers: [
    LabsService,
    LabAuthorityService,
    LabEvidenceUploadService,
    PrismaLabRepository,
    AuthorizedPrismaLabRepository,
    { provide: LAB_REPOSITORY, useExisting: AuthorizedPrismaLabRepository },
  ],
  exports: [
    LabsService,
    LabAuthorityService,
    LabEvidenceUploadService,
    PrismaLabRepository,
    AuthorizedPrismaLabRepository,
  ],
})
export class LabsModule {}

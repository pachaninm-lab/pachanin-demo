import { Module } from '@nestjs/common';
import { LabsController } from './labs.controller';
import { LabsService } from './labs.service';
import { PrismaLabRepository } from './prisma-lab.repository';
import { AuthorizedPrismaLabRepository } from './authorized-prisma-lab.repository';
import { LAB_REPOSITORY } from './lab.repository';
import { LabAuthorityService } from './lab-authority.service';

/**
 * Production laboratory operations are PostgreSQL-authoritative by construction.
 * RuntimeCore, repository factories, optional Prisma dependencies and simulated
 * external laboratory providers are absent from this dependency graph.
 *
 * AuthorizedPrismaLabRepository performs fail-fast operation-specific actor and
 * evidence checks; PostgreSQL triggers repeat those checks atomically and remain
 * the final authority.
 */
@Module({
  controllers: [LabsController],
  providers: [
    LabsService,
    LabAuthorityService,
    PrismaLabRepository,
    AuthorizedPrismaLabRepository,
    { provide: LAB_REPOSITORY, useExisting: AuthorizedPrismaLabRepository },
  ],
  exports: [
    LabsService,
    LabAuthorityService,
    PrismaLabRepository,
    AuthorizedPrismaLabRepository,
  ],
})
export class LabsModule {}

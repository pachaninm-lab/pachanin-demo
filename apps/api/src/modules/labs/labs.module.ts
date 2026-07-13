import { Module } from '@nestjs/common';
import { LabsController } from './labs.controller';
import { LabsService } from './labs.service';
import { LAB_REPOSITORY } from './lab.repository';
import { PrismaLabRepository } from './prisma-lab.repository';

/**
 * Production laboratory execution is PostgreSQL-authoritative by construction.
 * RuntimeCore, repository factories and optional Prisma dependencies are absent
 * from this dependency graph. External LIMS/accreditation providers are not
 * activated by this module.
 */
@Module({
  controllers: [LabsController],
  providers: [
    LabsService,
    PrismaLabRepository,
    { provide: LAB_REPOSITORY, useExisting: PrismaLabRepository },
  ],
  exports: [LabsService],
})
export class LabsModule {}

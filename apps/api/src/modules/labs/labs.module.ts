import { Module } from '@nestjs/common';
import { LabsController } from './labs.controller';
import { LabsService } from './labs.service';
import { PrismaLabRepository } from './prisma-lab.repository';
import { LAB_REPOSITORY } from './lab.repository';

/**
 * Production laboratory operations are PostgreSQL-authoritative by construction.
 * RuntimeCore, repository factories, optional Prisma dependencies and simulated
 * external laboratory providers are absent from this dependency graph.
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

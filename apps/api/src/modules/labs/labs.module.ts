import { Module } from '@nestjs/common';
import { AccessScopeService } from '../../common/security/access.service';
import { AuditModule } from '../audit/audit.module';
import { LabsController } from './labs.controller';
import { LabsService } from './labs.service';
import { LAB_REPOSITORY } from './lab.repository';
import { PrismaLabRepository } from './prisma-lab.repository';

/**
 * Production laboratory operations are PostgreSQL-authoritative by construction.
 * RuntimeCore, repository factories and optional Prisma dependencies are absent
 * from this dependency graph.
 */
@Module({
  imports: [AuditModule],
  controllers: [LabsController],
  providers: [
    LabsService,
    AccessScopeService,
    PrismaLabRepository,
    { provide: LAB_REPOSITORY, useExisting: PrismaLabRepository },
  ],
  exports: [LabsService],
})
export class LabsModule {}

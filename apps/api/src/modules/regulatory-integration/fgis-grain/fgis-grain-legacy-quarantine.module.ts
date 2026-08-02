import { Module } from '@nestjs/common';
import { FgisLegacyQuarantineAuditService } from './fgis-grain-legacy-quarantine.audit';

/**
 * Supplies the durable audit authority to every module that still exposes a
 * retired ФГИС «Зерно» path. Imported explicitly rather than made global: the
 * set of modules holding a quarantined route is exactly the set that should
 * shrink as later slices replace those routes, and an explicit import makes
 * that set visible.
 *
 * `PrismaService` comes from the global `PrismaModule`.
 */
@Module({
  providers: [FgisLegacyQuarantineAuditService],
  exports: [FgisLegacyQuarantineAuditService],
})
export class FgisLegacyQuarantineModule {}

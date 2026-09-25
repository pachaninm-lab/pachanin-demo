import { Module } from '@nestjs/common';
import { FnsEgrulFileImportService } from './fns-egrul-file-import.service';

@Module({
  providers: [FnsEgrulFileImportService],
  exports: [FnsEgrulFileImportService],
})
export class RoleEligibilityFnsEgrulImportModule {}

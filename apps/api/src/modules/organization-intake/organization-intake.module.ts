import { Module } from '@nestjs/common';
import { OrganizationIntakeController } from './organization-intake.controller';
import { OrganizationIntakeService } from './organization-intake.service';

@Module({
  controllers: [OrganizationIntakeController],
  providers: [OrganizationIntakeService],
  exports: [OrganizationIntakeService],
})
export class OrganizationIntakeModule {}

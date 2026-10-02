import { Module } from '@nestjs/common';
import { OrganizationIntakeModule } from '../organization-intake/organization-intake.module';
import { OrganizationCapabilityController } from './organization-capability.controller';
import { OrganizationCapabilityRepository } from './organization-capability.repository';
import { OrganizationCapabilityService } from './organization-capability.service';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';

@Module({
  imports: [OrganizationIntakeModule],
  providers: [
    OrganizationsService,
    OrganizationCapabilityRepository,
    OrganizationCapabilityService,
  ],
  controllers: [OrganizationsController, OrganizationCapabilityController],
  exports: [OrganizationsService, OrganizationCapabilityService],
})
export class OrganizationsModule {}

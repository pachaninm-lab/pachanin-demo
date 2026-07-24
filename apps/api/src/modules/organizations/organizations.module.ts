import { Module } from '@nestjs/common';
import { OrganizationIntakeModule } from '../organization-intake/organization-intake.module';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';

@Module({
  imports: [OrganizationIntakeModule],
  providers: [OrganizationsService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}

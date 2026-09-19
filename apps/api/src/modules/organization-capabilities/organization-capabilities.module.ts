import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { OrganizationCapabilitiesController } from './organization-capabilities.controller';
import { OrganizationCapabilityRepository } from './organization-capability.repository';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationCapabilitiesController],
  providers: [OrganizationCapabilityRepository],
  exports: [OrganizationCapabilityRepository],
})
export class OrganizationCapabilitiesModule {}

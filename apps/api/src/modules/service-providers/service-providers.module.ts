import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ProviderRegistryRepository } from './provider-registry.repository';
import { IntegrationBindingRepository } from './integration-binding.repository';
import { IntegrationBindingsController } from './integration-bindings.controller';
import { ServiceProvidersController } from './service-providers.controller';
import { ServiceProvidersService } from './service-providers.service';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceProvidersController, IntegrationBindingsController],
  providers: [ProviderRegistryRepository, IntegrationBindingRepository, ServiceProvidersService],
  exports: [ProviderRegistryRepository, IntegrationBindingRepository, ServiceProvidersService],
})
export class ServiceProvidersModule {}

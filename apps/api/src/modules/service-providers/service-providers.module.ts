import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ProviderRegistryRepository } from './provider-registry.repository';
import { ServiceProvidersController } from './service-providers.controller';
import { ServiceProvidersService } from './service-providers.service';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceProvidersController],
  providers: [ProviderRegistryRepository, ServiceProvidersService],
  exports: [ProviderRegistryRepository, ServiceProvidersService],
})
export class ServiceProvidersModule {}

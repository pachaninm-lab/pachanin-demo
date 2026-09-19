import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ServiceMarketplaceController } from './service-marketplace.controller';
import { ServiceMarketplaceRepository } from './service-marketplace.repository';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceMarketplaceController],
  providers: [ServiceMarketplaceRepository],
  exports: [ServiceMarketplaceRepository],
})
export class ServiceMarketplaceModule {}

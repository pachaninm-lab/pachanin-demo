import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CommercialRulesController } from './commercial-rules.controller';
import { CommercialRulesRepository } from './commercial-rules.repository';

@Module({
  imports: [PrismaModule],
  controllers: [CommercialRulesController],
  providers: [CommercialRulesRepository],
  exports: [CommercialRulesRepository],
})
export class CommercialRulesModule {}

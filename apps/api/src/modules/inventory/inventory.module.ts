import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';

@Module({ imports: [PrismaModule], controllers: [InventoryController], providers: [InventoryRepository], exports: [InventoryRepository] })
export class InventoryModule {}

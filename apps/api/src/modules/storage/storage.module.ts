import { Module, type Provider } from '@nestjs/common';
import {
  OBJECT_STORAGE_ADAPTER,
  createObjectStorageAdapterFromEnv,
} from './object-storage.adapter';
import { StoragePrismaService } from '../../common/prisma/storage-prisma.service';
import { StorageController } from './storage.controller';
import { StorageFinalizationRepository } from './storage-finalization.repository';
import { StorageService } from './storage.service';

const objectStorageAdapterProvider: Provider = {
  provide: OBJECT_STORAGE_ADAPTER,
  useFactory: () => createObjectStorageAdapterFromEnv(),
};

@Module({
  controllers: [StorageController],
  providers: [
    objectStorageAdapterProvider,
    StoragePrismaService,
    StorageFinalizationRepository,
    StorageService,
  ],
  exports: [StorageService, OBJECT_STORAGE_ADAPTER],
})
export class StorageModule {}

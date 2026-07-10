import { Module, type Provider } from '@nestjs/common';
import {
  OBJECT_STORAGE_ADAPTER,
  createObjectStorageAdapterFromEnv,
} from './object-storage.adapter';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

const objectStorageAdapterProvider: Provider = {
  provide: OBJECT_STORAGE_ADAPTER,
  useFactory: () => createObjectStorageAdapterFromEnv(),
};

@Module({
  controllers: [StorageController],
  providers: [objectStorageAdapterProvider, StorageService],
  exports: [StorageService, OBJECT_STORAGE_ADAPTER],
})
export class StorageModule {}

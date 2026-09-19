import { Module } from '@nestjs/common';
import { RuntimeSnapshotController, RuntimeStreamController } from './runtime-snapshot.controller';

@Module({
  controllers: [RuntimeSnapshotController, RuntimeStreamController],
})
export class RuntimeSnapshotModule {}

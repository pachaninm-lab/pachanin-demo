import { Module } from '@nestjs/common';
import { DatabaseSeedService } from './database-seed.service';

@Module({
  providers: [DatabaseSeedService],
})
export class DatabaseModule {}

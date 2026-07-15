import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OutboxPrismaService } from './outbox-prisma.service';

@Module({
  providers: [
    { provide: PrismaService, useClass: OutboxPrismaService },
  ],
  exports: [PrismaService],
})
export class OutboxPrismaModule {}

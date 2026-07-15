import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { OutboxPrismaService } from './outbox-prisma.service';

@Module({
  providers: [
    OutboxPrismaService,
    { provide: PrismaService, useExisting: OutboxPrismaService },
  ],
  exports: [PrismaService, OutboxPrismaService],
})
export class OutboxPrismaModule {}

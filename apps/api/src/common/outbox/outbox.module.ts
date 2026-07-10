import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboxRepository } from './outbox.repository';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxService } from './outbox.service';

@Module({
  imports: [PrismaModule, KafkaModule],
  providers: [OutboxRepository, OutboxService, OutboxRelayService],
  exports: [OutboxRepository, OutboxService, OutboxRelayService],
})
export class OutboxModule {}

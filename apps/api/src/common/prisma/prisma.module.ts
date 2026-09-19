import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RlsTransactionService } from './rls-transaction.service';

@Global()
@Module({
  providers: [PrismaService, RlsTransactionService],
  exports: [PrismaService, RlsTransactionService],
})
export class PrismaModule {}

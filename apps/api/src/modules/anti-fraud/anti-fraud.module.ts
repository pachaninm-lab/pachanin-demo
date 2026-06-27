import { Module } from '@nestjs/common';
import { AntiFraudService } from './anti-fraud.service';
import { AntiFraudController } from './anti-fraud.controller';

@Module({
  providers: [AntiFraudService],
  controllers: [AntiFraudController],
  exports: [AntiFraudService],
})
export class AntiFraudModule {}

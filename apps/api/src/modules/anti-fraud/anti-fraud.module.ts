import { Module } from '@nestjs/common';
import { MlClientModule } from '../ml-client/ml-client.module';
import { AntiFraudService } from './anti-fraud.service';
import { AntiFraudController } from './anti-fraud.controller';

@Module({
  imports: [MlClientModule],
  providers: [AntiFraudService],
  controllers: [AntiFraudController],
  exports: [AntiFraudService],
})
export class AntiFraudModule {}

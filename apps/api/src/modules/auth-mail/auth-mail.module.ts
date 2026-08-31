import { Global, Module } from '@nestjs/common';
import { AuthMailOutboxService } from './auth-mail-outbox.service';

@Global()
@Module({
  providers: [AuthMailOutboxService],
  exports: [AuthMailOutboxService],
})
export class AuthMailModule {}

import {
  Body,
  Controller,
  Header,
  Headers,
  HttpCode,
  Ip,
  Post,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Public } from '../../common/decorators/public.decorator';
import { CreateOrganizationIntakeDto } from './organization-intake.dto';
import { OrganizationIntakeService } from './organization-intake.service';

@Controller('organization-intake')
export class OrganizationIntakeController {
  constructor(private readonly intake: OrganizationIntakeService) {}

  @Public()
  @Post('requests')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('X-Content-Type-Options', 'nosniff')
  create(
    @Body() dto: CreateOrganizationIntakeDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Ip() sourceIp: string | undefined,
  ) {
    return this.intake.create(dto, {
      idempotencyKey: String(idempotencyKey ?? ''),
      correlationId: String(correlationId ?? randomUUID()),
      sourceIp: String(sourceIp ?? ''),
    });
  }
}

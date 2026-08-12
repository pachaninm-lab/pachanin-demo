import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { PublicInquiryService, type PublicInquiryInput } from './public-inquiry.service';

@Controller('public-inquiries')
export class PublicInquiryController {
  constructor(private readonly inquiries: PublicInquiryService) {}

  @Public()
  @HttpCode(202)
  @Post()
  @RateLimit({
    name: 'public_inquiry_submit',
    scope: 'ip',
    limit: 5,
    windowSeconds: 300,
    limitEnv: 'RATE_LIMIT_PUBLIC_INQUIRY',
    windowEnv: 'RATE_LIMIT_PUBLIC_INQUIRY_WINDOW_SECONDS',
  })
  submit(
    @Body() body: PublicInquiryInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.inquiries.submit(
      body,
      String(idempotencyKey || ''),
      String(correlationId || randomUUID()),
    );
  }
}

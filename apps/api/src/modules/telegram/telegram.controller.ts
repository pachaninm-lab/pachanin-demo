import { Controller, Post, Body, Headers, ForbiddenException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Public()
  @Post('webhook')
  handleWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
  ) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected && secret !== expected) {
      throw new ForbiddenException('Invalid webhook secret');
    }
    this.telegram.handleUpdate(update);
    return { ok: true };
  }
}

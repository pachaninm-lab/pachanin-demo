import { Body, Controller, Post, Req } from '@nestjs/common';
import { AiInsightsService, InsightRequest } from './ai-insights.service';

@Controller('api/ai')
export class AiInsightsController {
  constructor(private readonly svc: AiInsightsService) {}

  @Post('insight')
  insight(@Body() dto: InsightRequest, @Req() req: Record<string, unknown>) {
    const user = req['user'] as Parameters<typeof this.svc.getInsight>[1];
    return this.svc.getInsight(dto, user);
  }
}

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DealsModule } from '../deals/deals.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiInsightsService } from './ai-insights.service';
import { AiInsightsController } from './ai-insights.controller';

@Module({
  imports: [DealsModule, AuditModule],
  providers: [AiAssistantService, AiInsightsService],
  controllers: [AiAssistantController, AiInsightsController],
  exports: [AiAssistantService, AiInsightsService],
})
export class AiInsightsModule {
  // The assistant remains a role-scoped façade over Deal Core; it is not an
  // independent source of truth or an autonomous command authority.
}

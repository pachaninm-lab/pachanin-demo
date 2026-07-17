import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import {
  AiAssistantService,
  type AssistantChatRequest,
  type AssistantChatResponse,
} from './ai-assistant.service';

@UseGuards(RolesGuard)
@Roles('ANY_AUTHENTICATED')
@Controller('ai-assistant')
export class AiAssistantController {
  constructor(private readonly assistant: AiAssistantService) {}

  @Get('catalog')
  catalog() {
    return this.assistant.catalog();
  }

  @Post('chat')
  @RateLimit({
    name: 'ai_assistant_chat',
    scope: 'user',
    limit: 30,
    windowSeconds: 60,
    limitEnv: 'RATE_LIMIT_AI_ASSISTANT_CHAT',
    windowEnv: 'RATE_LIMIT_AI_ASSISTANT_CHAT_WINDOW_SECONDS',
  })
  chat(
    @Body() request: AssistantChatRequest,
    @CurrentUser() user: RequestUser,
  ): Promise<AssistantChatResponse> {
    return this.assistant.chat(request, user);
  }
}

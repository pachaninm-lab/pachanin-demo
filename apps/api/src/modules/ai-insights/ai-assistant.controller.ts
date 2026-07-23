import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import {
  assertAssistantResponseContract,
  buildAssistantStreamEvents,
  encodeAssistantStreamEvent,
  resolveAdmittedRuntimeReadiness,
} from './ai-assistant-stream.contract';
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

  @Get('readiness')
  async readiness() {
    const runtime = await resolveAdmittedRuntimeReadiness();
    return {
      status: runtime ? 'READY' : 'DISABLED',
      mode: 'read_only',
      actionAllowed: false,
      runtime,
    } as const;
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
  async chat(
    @Body() request: AssistantChatRequest,
    @CurrentUser() user: RequestUser,
  ): Promise<AssistantChatResponse> {
    const runtime = await resolveAdmittedRuntimeReadiness();
    const response = await this.assistant.chat(request, user);
    return assertAssistantResponseContract(response, runtime);
  }

  @Post('chat/stream')
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('X-Accel-Buffering', 'no')
  @RateLimit({
    name: 'ai_assistant_chat_stream',
    scope: 'user',
    limit: 30,
    windowSeconds: 60,
    limitEnv: 'RATE_LIMIT_AI_ASSISTANT_CHAT',
    windowEnv: 'RATE_LIMIT_AI_ASSISTANT_CHAT_WINDOW_SECONDS',
  })
  async stream(
    @Body() request: AssistantChatRequest,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const runtime = await resolveAdmittedRuntimeReadiness();
    const response = assertAssistantResponseContract(
      await this.assistant.chat(request, user),
      runtime,
    );
    const body = buildAssistantStreamEvents(response, runtime)
      .map(encodeAssistantStreamEvent);
    return new StreamableFile(Readable.from(body), {
      type: 'text/event-stream; charset=utf-8',
      disposition: 'inline',
    });
  }
}

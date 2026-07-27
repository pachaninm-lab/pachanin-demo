import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import {
  GatewayStreamWriter,
  absoluteCitationUri,
  chunkAnswer,
  resolveAdmission,
  type GatewayMode,
} from './ai-assistant-stream.contract';
import { readAdmissionManifest } from './ai-assistant-admission.manifest';
import {
  AiAssistantService,
  type AssistantChatRequest,
  type AssistantChatResponse,
} from './ai-assistant.service';

/**
 * Minimal shapes of the response and request objects the stream endpoint needs.
 * Declared locally so the controller does not take an express type dependency
 * for two methods and two events.
 */
export interface StreamResponse {
  setHeader(name: string, value: string): unknown;
  flushHeaders?(): unknown;
  write(chunk: string): unknown;
  end(): unknown;
}

export interface StreamRequest {
  on(event: 'close', listener: () => void): unknown;
}

/**
 * Which model, if any, this deployment is allowed to generate with.
 *
 * Admission is not a word in the environment: it is the C.04 decision document,
 * verified by recomputing the digest the admission authority took over the whole
 * decision. The environment only says which document to read and which model this
 * process intends to serve; it cannot say "admitted".
 *
 * Read on every request rather than cached: admission is withdrawn by replacing
 * the document, and a cached "admitted" would keep generating after withdrawal.
 */
export function readAdmission(env: NodeJS.ProcessEnv = process.env) {
  const verdict = readAdmissionManifest(env);
  return {
    ...resolveAdmission({
      featureEnabled: (env.TAI_GATEWAY_STREAM_ENABLED || '').trim() === 'true',
      modelIdentity: verdict.modelIdentity,
      admissionStatus: verdict.admitted ? 'ADMITTED' : null,
    }),
    // The identity travels with the verdict rather than being read from the
    // environment again: what `meta` announces must be the model the decision
    // admitted, not whatever a variable happens to say alongside it.
    modelIdentity: verdict.modelIdentity,
  };
}

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

  /**
   * The private read-only stream.
   *
   * Every frame goes through the shared contract before it reaches the socket,
   * so this endpoint cannot invent an event, cannot echo the caller's tenant or
   * role back to the browser, and cannot present a half-finished answer as a
   * finished one. Identity stays where the session put it: the frames carry
   * none of it, and the answer is produced for `user` as the guard resolved it.
   */
  @Post('stream')
  @RateLimit({
    name: 'ai_assistant_stream',
    scope: 'user',
    limit: 30,
    windowSeconds: 60,
    limitEnv: 'RATE_LIMIT_AI_ASSISTANT_STREAM',
    windowEnv: 'RATE_LIMIT_AI_ASSISTANT_STREAM_WINDOW_SECONDS',
  })
  async stream(
    @Body() request: AssistantChatRequest,
    @CurrentUser() user: RequestUser,
    @Res() response: StreamResponse,
    @Req() httpRequest: StreamRequest,
  ): Promise<void> {
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    const streamId = randomUUID();
    const stream = new GatewayStreamWriter((chunk) => response.write(chunk), 'private' as GatewayMode, streamId);
    const admission = readAdmission();

    // A client that goes away mid-answer must not leave a stream that merely
    // stopped: the answer is abandoned explicitly so nothing downstream can read
    // the tokens already sent as a conclusion the assistant reached.
    let clientGone = false;
    httpRequest.on('close', () => {
      clientGone = true;
      stream.abandon();
    });

    stream.emit({
      event: 'meta',
      mode: 'private',
      modelIdentity: admission.allowed ? admission.modelIdentity : null,
    });

    if (!admission.allowed) {
      stream.fail(
        admission.refusal ?? 'UPSTREAM_ERROR',
        admission.refusal === 'FEATURE_DISABLED'
          ? 'The read-only assistant stream is not enabled in this deployment.'
          : 'No admitted model is bound to this deployment, so nothing is generated.',
      );
      response.end();
      return;
    }

    let answer: AssistantChatResponse;
    try {
      answer = await this.assistant.chat(request, user);
    } catch {
      // The refusal carries no upstream detail: an error string from a model
      // host or a database is not something the browser needs, and it is the
      // usual way internals reach a public contour.
      stream.fail('UPSTREAM_ERROR', 'The assistant could not complete the answer.');
      response.end();
      return;
    }

    if (clientGone || stream.state.sealed) {
      response.end();
      return;
    }

    const base = (process.env.PUBLIC_APP_BASE_URL || '').trim() || null;
    for (const citation of answer.citations) {
      const uri = absoluteCitationUri(citation.href, base);
      if (!uri) continue;
      if (!stream.emit({ event: 'citation', sourceId: citation.source, title: citation.label, uri })) break;
    }

    for (const chunk of chunkAnswer(answer.answer)) {
      if (!stream.emit({ event: 'token', text: chunk })) break;
    }

    if (answer.decision.summary.trim().length > 0) {
      stream.emit({
        event: 'assessment',
        summary: answer.decision.summary,
        operationalStatus: 'NOT_ATTESTED',
      });
    }

    stream.complete();
    response.end();
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { GatewayStreamWriter } from './ai-assistant-stream.contract';
import { Public } from '../../common/decorators/public.decorator';
import { stripInternalModelTrace } from './restricted-public-qwen.internal-trace';
import {
  RestrictedPublicQwenService,
  type RestrictedPublicQwenResponse,
} from './restricted-public-qwen.service';

// Re-exported so callers and tests keep one import site for the removal rule.
export { stripInternalModelTrace };

const SIGNATURE_VERSION = 'tai-public-qwen.v1';
const MAX_CLOCK_SKEW_SECONDS = 90;
const INTERNAL_PATH = '/internal/tai/public-generate';
export const INTERNAL_STREAM_PATH = '/internal/tai/public-generate-stream';
const PRIVATE_PUBLIC_SOURCE = /^\/platform-v7\/(?:deals|staff|admin|operator|buyer|seller|bank|logistics|driver|elevator|laboratory|surveyor|compliance|arbitrator|executive)(?:\/|$)/u;

type HeaderMap = Record<string, string | string[] | undefined>;

@Controller('internal/tai')
export class RestrictedPublicQwenController {
  constructor(private readonly qwen: RestrictedPublicQwenService) {}

  @Public()
  @Post('public-generate')
  generate(
    @Body() body: unknown,
    @Headers() headers: HeaderMap,
  ): Promise<RestrictedPublicQwenResponse> {
    verifyInternalSignature(body, headers);
    verifyPublicSourceBoundary(body);
    return this.qwen.generate(body).then(redactPublicModelInternals);
  }

  /**
   * The incremental form of the same answer.
   *
   * It speaks the gateway stream contract rather than an internal dialect of its
   * own, so the boundary that relays it validates frames with the same function
   * that produced them. A second "almost the same" wire format between these two
   * processes is how a field the public contour forbids eventually crosses it.
   */
  @Public()
  @Post('public-generate-stream')
  async generateStream(
    @Body() body: unknown,
    @Headers() headers: HeaderMap,
    @Res() response: InternalStreamResponse,
    @Req() request: InternalStreamRequest,
  ): Promise<void> {
    const streamId = randomUUID();
    let authorized = false;
    try {
      verifyInternalSignature(body, headers, Math.floor(Date.now() / 1_000), process.env, INTERNAL_STREAM_PATH);
      verifyPublicSourceBoundary(body);
      authorized = true;
    } catch (error) {
      // Authorization failures answer with a status, not a stream: an
      // unauthenticated caller must not learn the shape of the contour by
      // reading refusal frames off a 200.
      const status = error instanceof UnauthorizedException ? 401
        : error instanceof BadRequestException ? 400
          : 503;
      response.status(status);
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.write(JSON.stringify({ message: 'Restricted public stream refused the request.' }));
      response.end();
    }
    if (!authorized) return;

    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    const writer = new GatewayStreamWriter((chunk) => response.write(chunk), 'public', streamId);
    const aborter = new AbortController();
    // IncomingMessage 'close' means the request body completed on modern Node;
    // it is not a reliable client-disconnect signal. Aborting there races with
    // normal POST completion and can kill a healthy llama.cpp stream before its
    // first token. The underlying socket closing is the actual transport loss.
    const onClientDisconnect = () => {
      aborter.abort();
      writer.abandon();
    };
    request.socket.on('close', onClientDisconnect);

    try {
      for await (const event of this.qwen.generateStream(body, aborter.signal)) {
        if (writer.state.sealed) break;
        if (event.type === 'meta') {
          if (!writer.emit({ event: 'meta', mode: 'public', modelIdentity: event.modelIdentity })) break;
          continue;
        }
        if (event.type === 'delta') {
          // A late removal pass over each committed block. The gate already
          // stripped internal traces; this refuses to forward anything that
          // survived rather than trusting a single boundary.
          const text = stripInternalModelTrace(event.text);
          if (!text) continue;
          if (!writer.emit({ event: 'token', text })) break;
          continue;
        }
        writer.emit({
          event: 'assessment',
          summary: JSON.stringify({
            modelIdentity: event.modelIdentity,
            answerMode: event.answerMode,
            latencyMs: event.latencyMs,
            promptTokens: event.promptTokens,
            completionTokens: event.completionTokens,
            finishReason: event.finishReason,
            truncated: event.truncated,
            safetyFlags: event.safetyFlags,
          }),
          operationalStatus: 'NOT_ATTESTED',
        });
        writer.complete();
      }
      // A generator that ended without a `done` event never reached a complete
      // answer, so the stream is invalidated rather than left looking finished.
      if (!writer.state.sealed) writer.fail('UPSTREAM_ERROR', 'The restricted public stream ended without an answer.');
    } catch (error) {
      writer.fail(
        aborter.signal.aborted ? 'CANCELLED' : 'UPSTREAM_ERROR',
        error instanceof ServiceUnavailableException || error instanceof BadRequestException
          ? 'The restricted public model could not complete the answer.'
          : 'The restricted public stream failed.',
      );
    } finally {
      request.socket.off('close', onClientDisconnect);
      aborter.abort();
      response.end();
    }
  }
}

/** The two response members the streaming endpoint needs, declared locally. */
export interface InternalStreamResponse {
  status(code: number): unknown;
  setHeader(name: string, value: string): unknown;
  flushHeaders?(): unknown;
  write(chunk: string): unknown;
  end(): unknown;
}

export interface InternalStreamRequest {
  socket: {
    on(event: 'close', listener: () => void): unknown;
    off(event: 'close', listener: () => void): unknown;
  };
}


export function redactPublicModelInternals(
  response: RestrictedPublicQwenResponse,
): RestrictedPublicQwenResponse {
  const answer = stripInternalModelTrace(response.answer);
  if (!answer) {
    throw new ServiceUnavailableException('Restricted public model returned only internal reasoning content.');
  }
  if (answer === response.answer) return response;

  const safetyFlags = Array.isArray(response.safetyFlags) ? response.safetyFlags : [];
  return Object.freeze({
    ...response,
    answer,
    safetyFlags: Object.freeze([...new Set([...safetyFlags, 'INTERNAL_REASONING_REMOVED'])]),
  });
}

export function verifyInternalSignature(
  body: unknown,
  headers: HeaderMap,
  nowSeconds: number = Math.floor(Date.now() / 1_000),
  environment: NodeJS.ProcessEnv = process.env,
  path: string = INTERNAL_PATH,
): void {
  const secret = (environment.TAI_PUBLIC_GATEWAY_HMAC_SECRET || '').trim();
  if (secret.length < 32) {
    throw new ServiceUnavailableException('TAI public gateway HMAC authority is not configured.');
  }

  const version = singleHeader(headers, 'x-tai-signature-version');
  const timestampText = singleHeader(headers, 'x-tai-timestamp');
  const signature = singleHeader(headers, 'x-tai-signature');
  if (version !== SIGNATURE_VERSION || !/^\d{10}$/u.test(timestampText) || !/^[a-f0-9]{64}$/u.test(signature)) {
    throw new UnauthorizedException('Invalid TAI public gateway signature headers.');
  }

  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    throw new UnauthorizedException('TAI public gateway signature is outside the accepted time window.');
  }

  const bodyHash = createHash('sha256').update(canonicalJson(body), 'utf8').digest('hex');
  const signed = [SIGNATURE_VERSION, 'POST', path, timestampText, bodyHash].join('\n');
  const expected = createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new UnauthorizedException('Invalid TAI public gateway signature.');
  }
}

export function verifyPublicSourceBoundary(body: unknown): void {
  const row = asRecord(body);
  const grounding = asRecord(row?.grounding);
  const sources = Array.isArray(grounding?.sources) ? grounding.sources : [];
  for (const source of sources) {
    const sourceRow = asRecord(source);
    const href = typeof sourceRow?.href === 'string' ? sourceRow.href.trim() : '';
    if (
      !/^\/platform-v7(?:\/|$)/u.test(href)
      || href.includes('..')
      || href.includes('://')
      || PRIVATE_PUBLIC_SOURCE.test(href)
    ) {
      throw new BadRequestException('A source is outside the approved public platform contour.');
    }
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new UnauthorizedException('Non-finite numbers are not signable.');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (typeof value !== 'object') throw new UnauthorizedException('Unsupported value in signed payload.');
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function singleHeader(headers: HeaderMap, name: string): string {
  const value = headers[name];
  if (Array.isArray(value)) {
    throw new UnauthorizedException(`Multiple ${name} headers are not allowed.`);
  }
  return typeof value === 'string' ? value.trim() : '';
}

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
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Public } from '../../common/decorators/public.decorator';
import {
  RestrictedPublicQwenService,
  type RestrictedPublicQwenResponse,
  type TaiStreamEvent,
} from './restricted-public-qwen.service';

const SIGNATURE_VERSION = 'tai-public-qwen.v1';
const MAX_CLOCK_SKEW_SECONDS = 90;
const INTERNAL_PATH = '/internal/tai/public-generate';
const PRIVATE_PUBLIC_SOURCE = /^\/platform-v7\/(?:deals|staff|admin|operator|buyer|seller|bank|logistics|driver|elevator|laboratory|surveyor|compliance|arbitrator|executive)(?:\/|$)/u;
const INTERNAL_TAG_BLOCK = /<\s*(think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/giu;
const INTERNAL_TAG_TAIL = /<\s*(?:think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b[^>]*>[\s\S]*$/iu;
const INTERNAL_FENCE_BLOCK = /```[ \t]*(?:think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b[^\n]*\n[\s\S]*?```/giu;
const INTERNAL_CHANNEL_WITH_FINAL = /<\|channel\|>\s*(?:analysis|reasoning|commentary|tool)\s*<\|message\|>[\s\S]*?(?=<\|channel\|>\s*final\s*<\|message\|>)/giu;
const INTERNAL_CHANNEL_TAIL = /<\|channel\|>\s*(?:analysis|reasoning|commentary|tool)\s*<\|message\|>[\s\S]*$/iu;

const INTERNAL_MARKER = /(?:<\s*\/?\s*(?:think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b|```[ \t]*(?:think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b|<\|channel\|>\s*(?:analysis|reasoning|commentary|tool|final)\b)/iu;

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
   * Server-sent stream of normalized model events.
   *
   * Only the four typed events cross this boundary. The provider's own frames
   * stop inside the parser, and the safety buffer has already screened every
   * delta, so what reaches the BFF is text that was cleared for a browser — not
   * model output awaiting inspection.
   */
  @Public()
  @Post('public-stream')
  async stream(
    @Body() body: unknown,
    @Headers() headers: HeaderMap,
    @Res() response: ServerResponse,
    @Req() request: IncomingMessage,
  ): Promise<void> {
    verifyInternalSignature(body, headers);
    verifyPublicSourceBoundary(body);

    const traceId = readTraceId(headers);
    const controller = new AbortController();
    // A client that goes away must not leave the provider generating: the abort
    // travels to generateStream, which aborts the upstream request in its finally.
    const onClose = () => controller.abort();
    request.on('close', onClose);

    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform, max-age=0',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
      ...(traceId ? { 'x-tai-trace-id': traceId } : {}),
    });

    let terminal = false;
    const emit = (event: TaiStreamEvent) => {
      // Terminal uniqueness is enforced here rather than trusted from upstream:
      // a second terminal frame would let a client believe a failed answer
      // finished, or a finished one failed.
      const isTerminal = event.kind !== 'delta';
      if (terminal) return;
      if (isTerminal) terminal = true;
      response.write(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    try {
      for await (const event of this.qwen.generateStream(body, controller.signal)) {
        if (event.kind === 'delta' && INTERNAL_MARKER.test(event.text)) {
          // The safety buffer should have removed this. If a marker still
          // arrives, the buffer's guarantee is broken and the honest response is
          // to fail the stream, not to strip it here and hide the defect.
          emit({ kind: 'error', errorClass: 'safety_internal_marker' });
          break;
        }
        emit(event);
        if (terminal) break;
      }
      if (!terminal) emit({ kind: 'error', errorClass: 'provider_transport' });
    } catch {
      if (!terminal) emit({ kind: 'error', errorClass: 'internal' });
    } finally {
      request.off('close', onClose);
      if (!controller.signal.aborted) controller.abort();
      response.end();
    }
  }
}

/** Correlation id only; it names nothing and grants nothing. */
function readTraceId(headers: HeaderMap): string | null {
  const raw = headers['x-tai-trace-id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && /^[0-9a-f]{32}$/u.test(value.trim().toLowerCase())
    ? value.trim().toLowerCase()
    : null;
}

export function stripInternalModelTrace(value: string): string {
  let result = typeof value === 'string' ? value : '';
  if (!result || !INTERNAL_MARKER.test(result)) return result.trim();

  for (let pass = 0; pass < 4; pass += 1) {
    const next = result.replace(INTERNAL_TAG_BLOCK, ' ');
    if (next === result) break;
    result = next;
  }

  result = result
    .replace(INTERNAL_FENCE_BLOCK, ' ')
    .replace(INTERNAL_CHANNEL_WITH_FINAL, ' ')
    .replace(INTERNAL_CHANNEL_TAIL, ' ')
    .replace(INTERNAL_TAG_TAIL, ' ')
    .replace(/<\|channel\|>\s*final\s*<\|message\|>/giu, ' ')
    .replace(/<\|[^|>\r\n]{1,64}\|>/gu, ' ')
    .replace(/<\s*\/?\s*(?:think(?:ing)?|analysis|reasoning|scratchpad|tool(?:[_ -]?(?:call|calls|trace))?|debug)\b[^>]*>/giu, ' ')
    .replace(/[ \t]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();

  return result;
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
  nowSeconds = Math.floor(Date.now() / 1_000),
  environment: NodeJS.ProcessEnv = process.env,
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
  const signed = [SIGNATURE_VERSION, 'POST', INTERNAL_PATH, timestampText, bodyHash].join('\n');
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

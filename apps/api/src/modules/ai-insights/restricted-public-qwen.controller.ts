import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Public } from '../../common/decorators/public.decorator';
import {
  RestrictedPublicQwenService,
  type RestrictedPublicQwenResponse,
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

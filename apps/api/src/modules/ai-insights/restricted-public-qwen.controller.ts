import {
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
    return this.qwen.generate(body);
  }
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

function singleHeader(headers: HeaderMap, name: string): string {
  const value = headers[name];
  if (Array.isArray(value)) {
    throw new UnauthorizedException(`Multiple ${name} headers are not allowed.`);
  }
  return typeof value === 'string' ? value.trim() : '';
}

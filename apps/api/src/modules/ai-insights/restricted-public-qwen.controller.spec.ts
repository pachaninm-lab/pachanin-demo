import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import {
  RestrictedPublicQwenController,
  canonicalJson,
  verifyInternalSignature,
  verifyPublicSourceBoundary,
} from './restricted-public-qwen.controller';
import type { RestrictedPublicQwenService } from './restricted-public-qwen.service';

const SECRET = 's'.repeat(64);
const NOW = 1_785_283_200;
const BODY = {
  question: 'Как работает платформа?',
  locale: 'ru',
  grounding: {
    title: 'Платформа',
    answer: 'Публичное описание.',
    sources: [{ label: 'Как это работает', href: '/platform-v7/how-it-works' }],
  },
};

function signedHeaders(body: unknown, timestamp = NOW) {
  const timestampText = String(timestamp);
  const bodyHash = createHash('sha256').update(canonicalJson(body), 'utf8').digest('hex');
  const signed = ['tai-public-qwen.v1', 'POST', '/internal/tai/public-generate', timestampText, bodyHash].join('\n');
  return {
    'x-tai-signature-version': 'tai-public-qwen.v1',
    'x-tai-timestamp': timestampText,
    'x-tai-signature': createHmac('sha256', SECRET).update(signed, 'utf8').digest('hex'),
  };
}

describe('restricted public Qwen HMAC authority', () => {
  it('accepts the exact canonical body inside the time window', () => {
    expect(() => verifyInternalSignature(BODY, signedHeaders(BODY), NOW, {
      TAI_PUBLIC_GATEWAY_HMAC_SECRET: SECRET,
    } as NodeJS.ProcessEnv)).not.toThrow();
  });

  it('rejects body tampering', () => {
    expect(() => verifyInternalSignature(
      { ...BODY, question: 'Изменённый вопрос' },
      signedHeaders(BODY),
      NOW,
      { TAI_PUBLIC_GATEWAY_HMAC_SECRET: SECRET } as NodeJS.ProcessEnv,
    )).toThrow(UnauthorizedException);
  });

  it('rejects stale signatures', () => {
    expect(() => verifyInternalSignature(
      BODY,
      signedHeaders(BODY, NOW - 91),
      NOW,
      { TAI_PUBLIC_GATEWAY_HMAC_SECRET: SECRET } as NodeJS.ProcessEnv,
    )).toThrow(UnauthorizedException);
  });

  it('fails closed when the server-side authority is absent', () => {
    expect(() => verifyInternalSignature(BODY, signedHeaders(BODY), NOW, {} as NodeJS.ProcessEnv))
      .toThrow(ServiceUnavailableException);
  });

  it('accepts approved public sources but rejects Deal and staff routes', () => {
    expect(() => verifyPublicSourceBoundary(BODY)).not.toThrow();
    expect(() => verifyPublicSourceBoundary({
      ...BODY,
      grounding: {
        ...BODY.grounding,
        sources: [{ label: 'Public logistics', href: '/platform-v7/grain-logistics' }],
      },
    })).not.toThrow();
    for (const href of [
      '/platform-v7/deals/DEAL-1',
      '/platform-v7/staff/control-center',
      '/platform-v7/bank',
      'https://example.test/platform-v7',
      '/platform-v7/../staff',
    ]) {
      expect(() => verifyPublicSourceBoundary({
        ...BODY,
        grounding: {
          ...BODY.grounding,
          sources: [{ label: 'Forbidden', href }],
        },
      })).toThrow(BadRequestException);
    }
  });

  it('invokes the model service only after signature and source verification', async () => {
    const generate = jest.fn().mockResolvedValue({ answer: 'ok' });
    const controller = new RestrictedPublicQwenController({ generate } as unknown as RestrictedPublicQwenService);
    const original = process.env.TAI_PUBLIC_GATEWAY_HMAC_SECRET;
    process.env.TAI_PUBLIC_GATEWAY_HMAC_SECRET = SECRET;
    jest.spyOn(Date, 'now').mockReturnValue(NOW * 1_000);

    try {
      await expect(controller.generate(BODY, signedHeaders(BODY))).resolves.toEqual({ answer: 'ok' });
      expect(generate).toHaveBeenCalledWith(BODY);
      expect(() => controller.generate(BODY, {
        ...signedHeaders(BODY),
        'x-tai-signature': '0'.repeat(64),
      })).toThrow(UnauthorizedException);
      expect(generate).toHaveBeenCalledTimes(1);

      const privateBody = {
        ...BODY,
        grounding: {
          ...BODY.grounding,
          sources: [{ label: 'Private Deal', href: '/platform-v7/deals/DEAL-1' }],
        },
      };
      expect(() => controller.generate(privateBody, signedHeaders(privateBody)))
        .toThrow(BadRequestException);
      expect(generate).toHaveBeenCalledTimes(1);
    } finally {
      if (original === undefined) delete process.env.TAI_PUBLIC_GATEWAY_HMAC_SECRET;
      else process.env.TAI_PUBLIC_GATEWAY_HMAC_SECRET = original;
      jest.restoreAllMocks();
    }
  });
});

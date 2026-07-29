import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import {
  RestrictedPublicQwenController,
  canonicalJson,
  verifyInternalSignature,
} from './restricted-public-qwen.controller';
import type { RestrictedPublicQwenService } from './restricted-public-qwen.service';

const SECRET = 's'.repeat(64);
const NOW = 1_785_283_200;
const BODY = {
  question: 'Как работает платформа?',
  locale: 'ru',
  grounding: { title: 'Платформа', answer: 'Публичное описание.' },
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

  it('invokes the model service only after signature verification', async () => {
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
    } finally {
      if (original === undefined) delete process.env.TAI_PUBLIC_GATEWAY_HMAC_SECRET;
      else process.env.TAI_PUBLIC_GATEWAY_HMAC_SECRET = original;
      jest.restoreAllMocks();
    }
  });
});

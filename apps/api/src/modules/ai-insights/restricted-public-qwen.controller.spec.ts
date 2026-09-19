import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import {
  RestrictedPublicQwenController,
  canonicalJson,
  redactPublicModelInternals,
  stripInternalModelTrace,
  verifyInternalSignature,
  verifyPublicSourceBoundary,
} from './restricted-public-qwen.controller';
import type {
  RestrictedPublicQwenResponse,
  RestrictedPublicQwenService,
} from './restricted-public-qwen.service';

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

function modelResponse(answer: string): RestrictedPublicQwenResponse {
  return {
    answer,
    provider: 'openai-compatible',
    modelIdentity: 'tai-qwen3-8b-q4km',
    latencyMs: 12,
    promptTokens: 10,
    completionTokens: 20,
    operationalStatus: 'NOT_ATTESTED',
    mode: 'read_only',
    answerMode: 'general_agro',
    finishReason: 'stop',
    truncated: false,
    safetyFlags: [],
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

  it('removes tagged reasoning, fenced tool traces and channel analysis', () => {
    const raw = [
      '<think>Внутренние рассуждения и служебный план.</think>',
      '```tool_trace',
      '{"tool":"internal","status":"debug"}',
      '```',
      '<|channel|>analysis<|message|>Скрытая служебная проверка.<|channel|>final<|message|>',
      'На цену зерна влияют качество, базис поставки, логистика и рыночный баланс.',
    ].join('\n');

    const visible = stripInternalModelTrace(raw);

    expect(visible).toBe('На цену зерна влияют качество, базис поставки, логистика и рыночный баланс.');
    expect(visible).not.toContain('рассуждения');
    expect(visible).not.toContain('tool_trace');
    expect(visible).not.toContain('analysis');
    expect(visible).not.toContain('{"tool"');
  });

  it('cuts an unclosed internal block without deleting the completed visible answer', () => {
    expect(stripInternalModelTrace(
      'Проверенный ответ для пользователя.\n<thinking>Незавершённый внутренний процесс',
    )).toBe('Проверенный ответ для пользователя.');
  });

  it('records redaction and fails closed when no public answer remains', () => {
    const result = redactPublicModelInternals(modelResponse(
      '<reasoning>Скрытый разбор.</reasoning>\nГотовый публичный ответ.',
    ));

    expect(result.answer).toBe('Готовый публичный ответ.');
    expect(result.safetyFlags).toContain('INTERNAL_REASONING_REMOVED');
    expect(() => redactPublicModelInternals(modelResponse(
      '<analysis>Только внутренняя логика.</analysis>',
    ))).toThrow(ServiceUnavailableException);
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

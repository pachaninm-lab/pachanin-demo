import { describe, expect, it, vi } from 'vitest';
import {
  AiGatewayStreamError,
  consumeAiGatewayStream,
} from '@/lib/platform-v7/ai-gateway-stream';

const requestId = 'request-1';
const correlationId = 'correlation-1';
const generatedAt = '2026-07-22T00:00:10.000Z';
const citations = [{
  source: 'platform' as const,
  label: 'Как работает платформа',
  href: '/platform-v7/how-it-works',
  asOf: '2026-07-22T00:00:00.000Z',
}];
const decision = {
  summary: 'Проверенный ответ',
  reason: null,
  nextAction: null,
  ownerRole: 'seller',
  deadlineAt: null,
  moneyAtRiskKopecks: null,
  confidence: 'high' as const,
  actionAllowed: false as const,
  actionKind: 'NONE' as const,
  intent: 'platform_help',
  evidence: [],
  followUps: [],
  dataFreshnessAt: '2026-07-22T00:00:00.000Z',
};

function event(type: string, sequence: number, extra: Record<string, unknown>) {
  const payload = {
    schema: 'tai.ai-assistant.stream.v1',
    type,
    sequence,
    requestId,
    correlationId,
    ...extra,
  };
  return `id: ${requestId}:${sequence}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function validStream(overrides: { sequence?: number; actionAllowed?: boolean; citationHref?: string } = {}) {
  const answer = 'Проверенный ответ.';
  const finalCitations = overrides.citationHref
    ? [{ ...citations[0], href: overrides.citationHref }]
    : citations;
  return [
    event('meta', 1, {
      generatedAt,
      mode: 'read_only',
      actionAllowed: overrides.actionAllowed ?? false,
      provider: 'openai-compatible',
      runtime: null,
    }),
    event('token', overrides.sequence ?? 2, { delta: 'Проверенный ' }),
    event('token', 3, { delta: 'ответ.' }),
    event('citations', 4, { citations: finalCitations }),
    event('decision', 5, { decision }),
    event('done', 6, {
      response: {
        requestId,
        answer,
        provider: 'openai-compatible',
        mode: 'read_only',
        dataMode: 'authoritative',
        role: 'seller',
        dealId: null,
        generatedAt,
        citations: finalCitations,
        limitations: ['read-only'],
        decision,
      },
    }),
  ].join('');
}

function response(body: string, contentType = 'text/event-stream; charset=utf-8') {
  return new Response(body, { status: 200, headers: { 'Content-Type': contentType } });
}

describe('TAI Gateway SSE parser', () => {
  it('accepts the exact read-only event sequence and emits progressive callbacks', async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const result = await consumeAiGatewayStream(response(validStream()), { onToken, onDone });

    expect(result.done).toBe(true);
    expect(result.answer).toBe('Проверенный ответ.');
    expect(result.citations).toEqual(citations);
    expect(result.decision?.actionAllowed).toBe(false);
    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('rejects sequence gaps and correlation substitution', async () => {
    await expect(consumeAiGatewayStream(response(validStream({ sequence: 7 })))).rejects.toMatchObject({
      code: 'AI_GATEWAY_STREAM_SEQUENCE_REJECTED',
      retryable: false,
    });

    const substituted = validStream().replace('"correlationId":"correlation-1"', '"correlationId":"other"');
    await expect(consumeAiGatewayStream(response(substituted))).rejects.toBeInstanceOf(AiGatewayStreamError);
  });

  it('rejects write capability, ungrounded citations and wrong content type', async () => {
    await expect(consumeAiGatewayStream(response(validStream({ actionAllowed: true })))).rejects.toMatchObject({
      code: 'AI_GATEWAY_STREAM_WRITE_CAPABILITY_REJECTED',
    });
    await expect(consumeAiGatewayStream(response(validStream({ citationHref: 'https://evil.example' })))).rejects.toMatchObject({
      code: 'AI_GATEWAY_STREAM_CITATION_HREF_REJECTED',
    });
    await expect(consumeAiGatewayStream(response(validStream(), 'application/json'))).rejects.toMatchObject({
      code: 'AI_GATEWAY_STREAM_CONTENT_TYPE_REQUIRED',
    });
  });

  it('rejects incomplete streams instead of manufacturing a final answer', async () => {
    const incomplete = `${validStream()
      .split('\n\n')
      .filter((frame) => frame && !frame.includes('event: done'))
      .join('\n\n')}\n\n`;
    await expect(consumeAiGatewayStream(response(incomplete))).rejects.toMatchObject({
      code: 'AI_GATEWAY_STREAM_INCOMPLETE',
      retryable: true,
    });
  });
});

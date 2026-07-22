import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const route = read('apps/web/app/api/public-platform-assistant/route.ts');
const assistant = read('apps/web/components/platform-v7/PublicPlatformAssistant.tsx');
const parser = read('apps/web/lib/platform-v7/ai-gateway-stream.ts');
const resilience = read('apps/web/lib/platform-v7/install-public-assistant-fetch-resilience.ts');

describe('public assistant admitted read-only transport', () => {
  it('requires an admitted runtime before model execution', () => {
    expect(route).toContain('AI_ASSISTANT_RUNTIME_MODE');
    expect(route).toContain('admitted-read-only');
    expect(route).toContain('READ_ONLY_ADMITTED');
    expect(route).toContain('AI_ASSISTANT_EXPECTED_MODEL_SHA256');
    expect(route).toContain('AI_ASSISTANT_EXPECTED_RUNTIME_DIGEST');
    expect(route).toContain('AI_ASSISTANT_EXPECTED_ADMISSION_SHA256');
  });

  it('uses the real OpenAI-compatible model and never returns a static answer on POST', () => {
    expect(route).toContain('AI_ASSISTANT_BASE_URL');
    expect(route).toContain('chat/completions');
    expect(route).toContain("provider: 'openai-compatible'");
    expect(route).toContain('PUBLIC_ASSISTANT_RUNTIME_UNAVAILABLE');
    expect(route).not.toContain("provider: 'local-deterministic'");
    expect(route).not.toContain('return localResponse');
  });

  it('streams one strict read-only Gateway contract to the browser', () => {
    expect(route).toContain('text/event-stream; charset=utf-8');
    expect(route).toContain('AI_GATEWAY_STREAM_SCHEMA');
    expect(route).toContain('actionAllowed: false');
    expect(assistant).toContain('consumeAiGatewayStream');
    expect(assistant).toContain("Accept: 'text/event-stream'");
    expect(assistant).toContain('onToken:');
    expect(assistant).toContain('onDone:');
    expect(assistant).toContain("data-ai-transport='sse-read-only'");
  });

  it('supports cancellation, retry and progressive rendering without client authority', () => {
    expect(assistant).toContain('new AbortController()');
    expect(assistant).toContain('abortRef.current?.abort()');
    expect(assistant).toContain('lastQuestion');
    expect(assistant).toContain('void submit(lastQuestion)');
    expect(assistant).not.toContain('/api/proxy/ai-assistant');
    expect(assistant).not.toContain('localStorage');
  });

  it('cannot mistake the legacy JSON resilience response for a live AI stream', () => {
    expect(resilience).toContain("'Content-Type': 'application/json; charset=utf-8'");
    expect(parser).toContain("includes('text/event-stream')");
    expect(parser).toContain('AI_GATEWAY_STREAM_CONTENT_TYPE_REQUIRED');
    expect(assistant).toContain('AiGatewayStreamError');
  });
});

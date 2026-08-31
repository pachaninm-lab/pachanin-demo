import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Negative evidence that the production-active TAI paths do not simulate
 * progress.
 *
 * A screenshot of text appearing gradually proves nothing: a finished answer
 * released on a timer looks exactly the same. What can be checked mechanically
 * is that the model paths hold no whole answer to release — that they ask the
 * runtime to stream, forward frames as they arrive, and never route model output
 * through the framing helper that exists for already-final text.
 *
 * These assertions are deliberately source-level. They fail when someone
 * reintroduces the shortcut, which is the moment worth catching.
 */

const ROOT = path.resolve(__dirname, '../../../..');

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), 'utf8');
}

const MODEL_PATHS = [
  'apps/web/app/api/agro-chat/route.ts',
  'apps/web/app/api/restricted-public-platform-assistant/route.ts',
] as const;

describe('no fake streaming on the active model paths', () => {
  it.each(MODEL_PATHS)('%s relays frames instead of slicing a finished answer', (file) => {
    const source = read(file);

    expect(source).toContain('streamInternalModel');
    expect(source).toContain("for await (const event of streamInternalModel(");
    // The buffered call that used to produce a whole answer here is gone.
    expect(source).not.toContain('callInternalModel');
    expect(source).not.toMatch(/frameText\(\s*answer\.answer\s*\)/u);
  });

  it.each(MODEL_PATHS)('%s never delays or replays model output', (file) => {
    const source = read(file);

    expect(source).not.toMatch(/setTimeout|setInterval/u);
    expect(source).not.toMatch(/typewriter|simulateStream|mockStream|fakeStream/iu);
  });

  it('the runtime is asked for a streamed completion, not a finished one', () => {
    const service = read('apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts');

    expect(service).toContain('stream: true');
    expect(service).toContain('callProviderStream');
    // The buffered generator still exists for the non-streaming endpoint, so
    // `stream: false` is expected exactly once, in that call.
    expect(service.match(/stream: false/gu) ?? []).toHaveLength(1);
  });

  it('the private authenticated assistant streams from its provider too', () => {
    const service = read('apps/api/src/modules/ai-insights/ai-assistant.service.ts');
    const controller = read('apps/api/src/modules/ai-insights/ai-assistant.controller.ts');

    expect(service).toContain('async *chatStream');
    expect(service).toContain('streamOpenAiCompatible');
    expect(service).toContain('response.body.getReader()');
    // The buffered `chat` remains for the non-streaming endpoint, so exactly one
    // `stream: false` is expected — in that call and nowhere else.
    expect(service.match(/^\s+stream: false,$/gmu) ?? []).toHaveLength(1);
    expect(service.match(/^\s+stream: true,$/gmu) ?? []).toHaveLength(1);

    expect(controller).toContain('this.assistant.chatStream(request, user, aborter.signal)');
    expect(controller).not.toMatch(/await\s+this\.assistant\.chat\(/u);
    expect(controller).not.toMatch(/setTimeout|setInterval/u);
  });

  it('the boundary never accumulates the answer before forwarding it', () => {
    const relay = read('apps/web/lib/platform-v7/tai-internal-stream.ts');

    expect(relay).toContain('response.body.getReader()');
    expect(relay).not.toMatch(/await\s+response\.text\(\)/u);
    expect(relay).not.toMatch(/await\s+response\.json\(\)/u);
  });

  it('the framing helper is documented as framing and used only for final text', () => {
    const contract = read('apps/api/src/modules/ai-insights/ai-assistant-stream.contract.ts');

    expect(contract).toContain('export function frameText');
    expect(contract).toContain('This is framing, not streaming');
    // The old name carried the claim that slicing was progressive rendering.
    expect(contract).not.toContain('chunkAnswer');
  });

  it('the browser renders streamed text rather than withholding it until done', () => {
    const client = read('apps/web/lib/platform-v7/ai-gateway-stream.ts');
    const streamingBranch = client.slice(
      client.indexOf("if (snapshot.status === 'streaming')"),
      client.indexOf('const text = stripPublicAssistantInternalArtifacts'),
    );

    expect(streamingBranch).toContain('stripPublicAssistantInternalArtifacts');
    expect(streamingBranch).not.toMatch(/text:\s*''/u);
  });
});

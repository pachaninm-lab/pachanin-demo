import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const route = fs.readFileSync(path.join(root, 'apps/web/app/api/restricted-public-platform-assistant/route.ts'), 'utf8');
const acceptance = fs.readFileSync(path.join(root, 'scripts/tai-live-public-ai-acceptance.mjs'), 'utf8');
const stream = fs.readFileSync(path.join(root, 'apps/web/lib/platform-v7/ai-gateway-stream.ts'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'apps/web/components/platform-v7/UnifiedModalSheetFullscreenController.tsx'), 'utf8');

describe('real public Qwen exact-main acceptance', () => {
  it('removes the hidden eight-second cutoff and preserves the 120/130/145 second deadline hierarchy', () => {
    expect(route).not.toContain('FAST_FALLBACK_TIMEOUT_MS');
    expect(route).not.toContain('Math.min(runtimeConfig.timeoutMs');
    expect(route).toContain('const DEFAULT_TIMEOUT_MS = 130_000');
    expect(route).toContain('runtimeConfig.timeoutMs');
    expect(route).toContain('5_000, 150_000');
    expect(stream).toContain('PUBLIC_STREAM_TIMEOUT_MS = 145_000');
    expect(controller).toContain('PUBLIC_ASSISTANT_TIMEOUT_MS = 145_000');
  });

  it('never substitutes platform grounding for a failed general-agro generation', () => {
    expect(route).toContain("if (answerMode === 'verified_platform')");
    expect(route).toContain("writer.fail('UPSTREAM_ERROR', modelUnavailableCopy(locale))");
    expect(route).toContain("'MODEL_RUNTIME_FALLBACK'");
    expect(route).not.toContain("'MODEL_FAST_FALLBACK'");
  });

  it('requires real multilingual Qwen assessment, identity and semantic relevance before acceptance', () => {
    for (const fragment of [
      "assessment.source !== 'local_qwen'",
      "assessment.modelIdentity !== 'tai-qwen3-8b-q4km'",
      "assessment.answerMode !== 'general_agro'",
      'sse_fallback_flag_present',
      'sse_topic_relevance_invalid',
      'sse_language_invalid',
      "['ru', 'Что влияет на цену зерна?']",
      "['en', 'What affects grain prices?']",
      "['zh', '哪些因素影响粮食价格？']",
      'multilingualQwen = await verifyRealQwenSse()',
    ]) expect(acceptance).toContain(fragment);
  });

  it('keeps exact-main, UI, privacy and failure evidence gates intact', () => {
    for (const fragment of [
      'manifestSha !== targetSha',
      'native_fullscreen_dom_count_invalid',
      'mobile_fullscreen_control_visible',
      'ui_alert_present',
      'ui_overflow',
      'public-ai-window-failure.json',
      'public-ai-window-failure-390x844.png',
      'AI_ASSISTANT_API_KEY',
      'TAI_PUBLIC_GATEWAY_HMAC_SECRET',
    ]) expect(acceptance).toContain(fragment);
  });
});

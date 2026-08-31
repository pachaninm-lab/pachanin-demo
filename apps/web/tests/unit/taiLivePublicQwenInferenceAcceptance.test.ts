import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const route = fs.readFileSync(path.join(root, 'apps/web/app/api/restricted-public-platform-assistant/route.ts'), 'utf8');
const acceptance = fs.readFileSync(path.join(root, 'scripts/tai-live-public-ai-acceptance.mjs'), 'utf8');
// The assessment rules moved out of the script and into a module both hosted
// acceptance scripts import, so the guarantees below are pinned where they now
// live. They are the same guarantees, checked once instead of twice.
const contract = fs.readFileSync(path.join(root, 'scripts/tai-public-assessment-contract.mjs'), 'utf8');
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

  it('requires real multilingual Qwen assessment and semantic relevance before acceptance', () => {
    for (const fragment of [
      "assessment.source !== REAL_QWEN_SOURCE",
      "assessment.answerMode !== 'general_agro' || assessment.currentDataRequired !== false",
      // Added with real streaming: a buffered route cannot satisfy these.
      'assessment.streaming !== INCREMENTAL_STREAMING',
      'sse_upstream_assessment_missing',
      "upstream.finishReason !== 'stop'",
      'upstream.truncated !== false',
      'sse_fallback_flag_present',
      'sse_no_token_frames',
    ]) expect(contract).toContain(fragment);

    for (const fragment of [
      'sse_topic_relevance_invalid',
      'sse_language_invalid',
      "['ru', 'Что влияет на цену зерна?']",
      "['en', 'What affects grain prices?']",
      "['zh', '哪些因素影响粮食价格？']",
      'multilingualQwen = await verifyRealQwenSse()',
      'assertRealGeneralQwen',
    ]) expect(acceptance).toContain(fragment);
  });

  /**
   * Identity is asserted where it can be enforced, not where it is convenient.
   *
   * This used to require the acceptance script to compare the assessment's
   * model identity against a constant. The public contour publishes no identity
   * — `meta` carries null by design — so that comparison could only ever fail,
   * and it did, on the live run. The guarantee itself did not go away: the relay
   * refuses any upstream stream whose identity is not the admitted one, and
   * protected activation verifies the binding before hosted acceptance runs.
   * What is pinned now is that the public stream must carry no identity, and
   * that no acceptance script writes one into evidence from a constant.
   */
  it('refuses a public model identity instead of restating one', () => {
    expect(contract).toContain('sse_public_model_identity_exposed');
    expect(contract).toContain("'modelIdentity' in assessment && assessment.modelIdentity !== null");
    expect(contract).toContain('meta.modelIdentity !== null');
    expect(contract).toContain("IDENTITY_AUTHORITY = 'protected_activation_dependency'");

    // No acceptance reader may name the model, in a check or in evidence.
    expect(contract).not.toContain('tai-qwen3-8b-q4km');
    expect(acceptance).not.toContain('tai-qwen3-8b-q4km');
    expect(acceptance).toContain('publicModelIdentityExposed: false');
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
    ]) expect(acceptance).toContain(fragment);

    // Private material stays forbidden; the list moved with the assertion.
    for (const fragment of [
      'AI_ASSISTANT_API_KEY',
      'TAI_PUBLIC_GATEWAY_HMAC_SECRET',
      'sse_forbidden_material',
    ]) expect(contract).toContain(fragment);
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
// The contract is plain ESM, shared verbatim with the acceptance scripts that
// run on the hosted runner — the tests exercise the same file production does.
import {
  IDENTITY_AUTHORITY,
  assertRealGeneralQwen,
  normalizePublicQwenAssessment,
} from '../../../../scripts/tai-public-assessment-contract.mjs';

/**
 * The acceptance readers and the route that feeds them, pinned together.
 *
 * Production ran a green activation and still could not be confirmed: the route
 * emitted the real streaming assessment while the hosted acceptance script read
 * the flattened pre-streaming one, so the run died on
 * `sse_model_identity_invalid:ru` — an error that names the model runtime for
 * what was a schema disagreement between two files in this repository.
 *
 * These tests exercise the reader directly, with no browser and no production,
 * so the disagreement is caught in CI rather than in a release window.
 */

const ROOT = path.resolve(__dirname, '../../../..');
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8');

/** Exactly what `apps/web/app/api/agro-chat/route.ts` emits for a real answer. */
function liveAssessment(overrides: Record<string, unknown> = {}) {
  return {
    source: 'local_qwen',
    answerMode: 'general_agro',
    currentDataRequired: false,
    streaming: 'incremental',
    upstream: { finishReason: 'stop', truncated: false, safetyFlags: [] },
    ...overrides,
  };
}

function liveFrames(text = 'Цена зерна зависит от качества, логистики и спроса.') {
  return [
    { event: 'meta', mode: 'public', modelIdentity: null },
    { event: 'token', text: text.slice(0, 20) },
    { event: 'token', text: text.slice(20) },
    { event: 'assessment', summary: JSON.stringify(liveAssessment()) },
    { event: 'done', complete: true },
  ];
}

function liveResponse(overrides: Record<string, unknown> = {}) {
  const answer = 'Цена зерна зависит от качества, логистики и спроса.';
  return {
    id: 'ru',
    text: liveFrames(answer).map((frame) => `data: ${JSON.stringify(frame)}`).join('\n\n'),
    frames: liveFrames(answer),
    assessment: liveAssessment(),
    done: { event: 'done', complete: true },
    answer,
    minimumAnswerCharacters: 20,
    ...overrides,
  };
}

describe('the live production assessment is accepted', () => {
  it('passes on the exact shape the streaming route emits', () => {
    const verified = assertRealGeneralQwen(liveResponse());

    expect(verified.source).toBe('local_qwen');
    expect(verified.streaming).toBe('incremental');
    expect(verified.finishReason).toBe('stop');
    expect(verified.truncated).toBe(false);
    expect(verified.safetyFlags).toEqual([]);
    expect(verified.tokenFrames).toBe(2);
  });

  it('records identity as a dependency, never as an observed value', () => {
    const verified = assertRealGeneralQwen(liveResponse());

    expect(verified.identityAuthority).toBe(IDENTITY_AUTHORITY);
    expect(verified.publicModelIdentityExposed).toBe(false);
    // Nothing in the verified record may carry a model name — an evidence file
    // must not be able to restate an identity it never observed.
    expect(JSON.stringify(verified)).not.toContain('qwen3');
  });
});

describe('a degraded answer is refused', () => {
  it('rejects a missing upstream record', () => {
    expect(() => normalizePublicQwenAssessment(liveAssessment({ upstream: null }), 'ru'))
      .toThrow('sse_upstream_assessment_missing:ru');
  });

  it('rejects an assessment with no streaming claim — the buffered shape', () => {
    const { streaming: _streaming, ...withoutStreaming } = liveAssessment();
    expect(() => normalizePublicQwenAssessment(withoutStreaming, 'ru'))
      .toThrow('sse_streaming_contract_invalid:ru:undefined');
  });

  it('rejects grounded fallback text posing as a model answer', () => {
    // `verified_knowledge` is a legitimate route outcome and an illegitimate
    // proof that a model generated anything.
    expect(() => normalizePublicQwenAssessment(liveAssessment({ source: 'verified_knowledge' }), 'ru'))
      .toThrow('sse_source_invalid:ru:verified_knowledge');
  });

  it('rejects a fallback safety flag', () => {
    const assessment = liveAssessment({
      upstream: { finishReason: 'stop', truncated: false, safetyFlags: ['MODEL_RUNTIME_FALLBACK'] },
    });
    expect(() => normalizePublicQwenAssessment(assessment, 'ru'))
      .toThrow('sse_fallback_flag_present:ru:MODEL_RUNTIME_FALLBACK');
  });

  it('rejects a runtime-unavailable safety flag', () => {
    const assessment = liveAssessment({
      upstream: { finishReason: 'stop', truncated: false, safetyFlags: ['MODEL_RUNTIME_UNAVAILABLE'] },
    });
    expect(() => normalizePublicQwenAssessment(assessment, 'zh'))
      .toThrow('sse_fallback_flag_present:zh:MODEL_RUNTIME_UNAVAILABLE');
  });

  it('rejects a truncated answer', () => {
    const assessment = liveAssessment({
      upstream: { finishReason: 'length', truncated: true, safetyFlags: [] },
    });
    expect(() => normalizePublicQwenAssessment(assessment, 'en')).toThrow('sse_finish_reason_invalid:en:length');
  });

  it('rejects truncation even when the finish reason claims a clean stop', () => {
    const assessment = liveAssessment({
      upstream: { finishReason: 'stop', truncated: true, safetyFlags: [] },
    });
    expect(() => normalizePublicQwenAssessment(assessment, 'en')).toThrow('sse_answer_truncated:en');
  });

  it('rejects an unterminated stream', () => {
    expect(() => assertRealGeneralQwen(liveResponse({ done: { event: 'done', complete: false } })))
      .toThrow('sse_incomplete:ru');
  });

  it('rejects a stream that emitted no tokens — the observed zero-character run', () => {
    const frames = liveFrames().filter((frame) => frame.event !== 'token');
    expect(() => assertRealGeneralQwen(liveResponse({ frames, answer: '' })))
      .toThrow('sse_no_token_frames:ru');
  });

  it('rejects a public meta frame that names the model', () => {
    const frames = liveFrames().map((frame) => (
      frame.event === 'meta' ? { ...frame, modelIdentity: 'tai-qwen3-8b-q4km' } : frame
    ));
    expect(() => assertRealGeneralQwen(liveResponse({ frames })))
      .toThrow('sse_public_model_identity_exposed:ru:tai-qwen3-8b-q4km');
  });

  it('rejects a public assessment that names the model', () => {
    expect(() => normalizePublicQwenAssessment(liveAssessment({ modelIdentity: 'tai-qwen3-8b-q4km' }), 'ru'))
      .toThrow('sse_public_model_identity_exposed:ru:tai-qwen3-8b-q4km');
  });
});

describe('the acceptance scripts read the current contract', () => {
  const scripts = [
    'scripts/tai-live-public-ai-acceptance.mjs',
    'scripts/tai-potato-mobile-live-acceptance.mjs',
  ] as const;

  it.each(scripts)('%s carries no stale pre-streaming reads', (script) => {
    const source = read(script);

    // The three fields the flattened schema had and the streaming one does not.
    expect(source).not.toContain("assessment.modelIdentity !== 'tai-qwen3-8b-q4km'");
    expect(source).not.toContain('assessment.latencyMs');
    expect(source).not.toContain('assessment.safetyFlags');
    expect(source).not.toContain('sse_model_identity_invalid');
  });

  it.each(scripts)('%s validates through the shared contract', (script) => {
    expect(read(script)).toContain("from './tai-public-assessment-contract.mjs'");
  });

  it('publishes no model identity into hosted evidence', () => {
    const source = read('scripts/tai-live-public-ai-acceptance.mjs');

    expect(source).toContain('identityAuthority: IDENTITY_AUTHORITY');
    expect(source).toContain('publicModelIdentityExposed: false');
    // An identity written from a constant would be an invention, not evidence.
    expect(source).not.toContain('tai-qwen3-8b-q4km');
  });

  it('rebuilds images when an acceptance reader changes', () => {
    const workflow = read('.github/workflows/docker-publish.yml');

    for (const script of [...scripts, 'scripts/tai-public-assessment-contract.mjs']) {
      expect(workflow).toContain(`- "${script}"`);
    }
  });
});

describe('the browser assistant reads the same two layers', () => {
  const component = read('apps/web/components/platform-v7/PublicPlatformAssistant.tsx');

  it('resolves the model outcome from the upstream record', () => {
    expect(component).toContain('const outcome = upstream ?? row;');
    expect(component).toContain('truncated: outcome.truncated === true');
    expect(component).toContain("finishReason: typeof outcome.finishReason === 'string' ? outcome.finishReason : null");
    expect(component).toContain('Array.isArray(outcome.safetyFlags)');
  });

  it('still reads grounded answers at the top level', () => {
    // `policy` and `verified_knowledge` have no upstream model, so `outcome`
    // must fall back to the row itself rather than losing their fields.
    expect(component).toContain('row.upstream !== null');
    expect(component).toContain("typeof row.upstream === 'object'");
  });

  it('never displays a model identity on the public contour', () => {
    expect(component).toContain('modelIdentity: null,\n      latencyMs: null,');
    expect(component).not.toContain("typeof row.modelIdentity === 'string' ? row.modelIdentity : null");
  });
});

describe('the guarantees this contract depends on stay in force', () => {
  it('the relay still refuses an unadmitted upstream identity', () => {
    const relay = read('apps/web/lib/platform-v7/tai-internal-stream.ts');

    expect(relay).toContain("throw new Error('restricted_runtime_identity_mismatch');");
    expect(relay).toContain('frame.modelIdentity !== null && frame.modelIdentity !== config.identity');
  });

  it('the hosted acceptance job still runs only after a successful activation', () => {
    const workflow = read('.github/workflows/tai-restricted-qwen-reg-ru-activation.yml');
    const job = workflow.slice(workflow.indexOf('\n  acceptance:'), workflow.indexOf('\n  finalize:'));

    expect(job).toContain('needs: [image_authority, activate]');
    expect(job).toContain("if: needs.activate.result == 'success'");
  });

  it('the hosted job carries the contract module beside the scripts that import it', () => {
    // The scripts are copied into a scratch directory and run from there, so a
    // relative import resolves against that directory, not the checkout.
    const workflow = read('.github/workflows/tai-restricted-qwen-reg-ru-activation.yml');

    expect(workflow).toContain(
      'cp "$GITHUB_WORKSPACE/scripts/tai-public-assessment-contract.mjs" "$work/tai-public-assessment-contract.mjs"',
    );
    expect(workflow).toContain('node --check scripts/tai-public-assessment-contract.mjs');
  });
});

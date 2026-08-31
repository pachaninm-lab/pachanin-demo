import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const route = fs.readFileSync(path.join(root, 'apps/web/app/api/agro-chat/route.ts'), 'utf8');
const qwenService = fs.readFileSync(
  path.join(root, 'apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts'),
  'utf8',
);
const relay = fs.readFileSync(path.join(root, 'apps/web/lib/platform-v7/tai-internal-stream.ts'), 'utf8');
const nextConfig = fs.readFileSync(path.join(root, 'apps/web/next.config.js'), 'utf8');
const liveAcceptance = fs.readFileSync(path.join(root, 'scripts/tai-live-public-ai-acceptance.mjs'), 'utf8');

describe('P0 model-first agricultural chat', () => {
  it('binds the public assistant endpoint to the model-first route', () => {
    expect(nextConfig).toContain("{ source: '/api/public-platform-assistant', destination: '/api/agro-chat' }");
    expect(nextConfig).not.toContain("{ source: '/api/public-platform-assistant', destination: '/api/restricted-public-platform-assistant' }");
  });

  it('does not require a lexical knowledge-base match before inference', () => {
    expect(route).toContain('A lexical miss must never prevent a legitimate domain question');
    expect(route).toContain("return 'general_agro';");
    expect(route).toContain('grounding = generalAgroGrounding(locale);');
    expect(route).not.toContain("outcome.decision === 'REDIRECT_UNRELATED'");
  });

  it('keeps a self-contained agro question out of stale platform follow-up mode', () => {
    expect(route).toContain("if (outcome.signals.includes('agro_term')) return 'general_agro';");
    expect(route.indexOf("outcome.signals.includes('agro_term')"))
      .toBeLessThan(route.indexOf('compactFollowUp && context.previousTopic'));
    expect(liveAcceptance).toContain('Как хранить зерно после уборки?');
  });

  it('downgrades missing platform knowledge to general expertise instead of a thematic redirect', () => {
    expect(route).toContain('let answerMode = resolveAnswerMode');
    expect(route).toContain("if (grounding.resolution === 'redirected') {");
    expect(route).toContain("answerMode = 'general_agro';");
    expect(route).not.toContain("grounding.resolution === 'redirected' && answerMode === 'verified_platform'");
  });

  it('uses one agro-first fail-open policy for agriculture, adjacent business and safe general questions', () => {
    for (const fragment of [
      'agro-first, fail-open content policy',
      'Any plausible connection to crop production, livestock, machinery and equipment',
      'Safe general questions outside agriculture may be answered normally and concisely',
      'Medium confidence, a missing keyword, or a missing platform module, button or integration is never a reason to refuse',
      'Do not reject a safe question merely because it is outside agriculture',
      'inherit the active crop, animal, machine, farm, document, deal or corporate system',
      'Give a useful preliminary answer, the main factors, limitations and risks',
      'Separate knowledge from execution',
    ]) expect(qwenService).toContain(fragment);
    expect(qwenService).not.toContain('do not solve the unrelated request in substance');
  });

  it('keeps Transparent Price claims on verified public grounding while allowing domain explanation', () => {
    expect(route).toContain("if (answerMode === 'verified_platform') {");
    expect(route).toContain('const groundingResponse = await knowledgePost');
    expect(route).toContain("source: 'verified_knowledge'");
    expect(route).toContain('emitSources(writer, grounding.sources)');
    expect(qwenService).toContain('For facts about Transparent Price, use the supplied verified public grounding as the authority');
    expect(qwenService).toContain('The absence of a button, module, connector or knowledge article does not limit your ability to explain the subject');
  });

  it('preserves fail-closed safety, current-evidence and signed runtime boundaries', () => {
    for (const fragment of [
      "outcome.decision === 'BLOCK_SAFETY'",
      'SAFETY_BOUNDARY_BLOCKED',
      'SENSITIVE_INPUT_BLOCKED',
      "grounding.resolution === 'refused'",
      'requiresCurrentEvidence(envelope.question)',
      'TAI_PUBLIC_GATEWAY_HMAC_SECRET',
      'TAI_INTERNAL_API_ALLOWED_HOSTS',
      "operationalStatus: 'NOT_ATTESTED'",
    ]) expect(route).toContain(fragment);

    // Request signing moved into the shared relay when the route stopped
    // buffering answers; the boundary it protects is unchanged, so it is
    // asserted where it now lives rather than dropped.
    for (const fragment of [
      "export const SIGNATURE_VERSION = 'tai-public-qwen.v1'",
      "export const INTERNAL_STREAM_PATH = '/internal/tai/public-generate-stream'",
      'createHmac',
      'createHash',
    ]) expect(relay).toContain(fragment);

    for (const fragment of [
      'Do not invent machinery specifications',
      'Do not invent agronomic norms, product doses, medicines or veterinary diagnoses',
      'Do not bypass equipment protection',
      'Do not claim to execute, modify, sign, pay, transfer, approve or confirm anything',
    ]) expect(qwenService).toContain(fragment);
  });

  it('pins RU, EN and ZH live examples for safe general admission and missing-function explanation', () => {
    for (const fragment of [
      'safe_general_excel_ru',
      'safe_general_excel_en',
      'safe_general_excel_zh',
      'underspecified_farm_costs',
      'missing_platform_module_explanation',
      'assertNoThematicRefusal',
    ]) expect(liveAcceptance).toContain(fragment);
  });
});

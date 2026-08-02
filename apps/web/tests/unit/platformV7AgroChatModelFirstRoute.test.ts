import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const route = fs.readFileSync(path.join(root, 'apps/web/app/api/agro-chat/route.ts'), 'utf8');
const nextConfig = fs.readFileSync(path.join(root, 'apps/web/next.config.js'), 'utf8');

describe('P0 model-first agricultural chat', () => {
  it('binds the public assistant endpoint to the model-first route', () => {
    expect(nextConfig).toContain("{ source: '/api/public-platform-assistant', destination: '/api/agro-chat' }");
    expect(nextConfig).not.toContain("{ source: '/api/public-platform-assistant', destination: '/api/restricted-public-platform-assistant' }");
  });

  it('does not require a lexical knowledge-base match before general agricultural inference', () => {
    expect(route).toContain('A lexical miss must never prevent a legitimate domain question');
    expect(route).toContain("return 'general_agro';");
    expect(route).toContain('grounding = generalAgroGrounding(locale);');
    expect(route).not.toContain("outcome.decision === 'REDIRECT_UNRELATED'");
  });

  it('keeps Transparent Price claims on verified public grounding', () => {
    expect(route).toContain("if (answerMode === 'verified_platform') {");
    expect(route).toContain('const groundingResponse = await knowledgePost');
    expect(route).toContain("source: 'verified_knowledge'");
    expect(route).toContain('emitSources(writer, grounding.sources)');
  });

  it('preserves read-only safety, current-evidence and signed runtime boundaries', () => {
    for (const fragment of [
      'SENSITIVE_INPUT_BLOCKED',
      'requiresCurrentEvidence(envelope.question)',
      "const SIGNATURE_VERSION = 'tai-public-qwen.v1'",
      "const INTERNAL_PATH = '/internal/tai/public-generate'",
      'createHmac',
      'TAI_PUBLIC_GATEWAY_HMAC_SECRET',
      'TAI_INTERNAL_API_ALLOWED_HOSTS',
      "operationalStatus: 'NOT_ATTESTED'",
      "mode: 'read_only'",
    ]) expect(route).toContain(fragment);
  });

  it('keeps RU, EN and ZH conversational entry and safe off-domain handling in the model system prompt', () => {
    for (const fragment of [
      'GREETING_PATTERNS',
      "locale === 'en'",
      "locale === 'zh'",
      'generalAgroGrounding',
      'history: envelope.history',
      'currentDataRequired',
    ]) expect(route).toContain(fragment);
  });
});

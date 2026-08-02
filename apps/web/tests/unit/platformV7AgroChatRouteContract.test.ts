import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const nextConfig = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/api/agro-chat/route.ts'), 'utf8');

describe('public agricultural chat route authority', () => {
  it('routes the public assistant endpoint through the agricultural chat authority', () => {
    expect(nextConfig).toContain("{ source: '/api/public-platform-assistant', destination: '/api/agro-chat' }");
  });

  it('keeps verified platform questions on the governed platform route', () => {
    expect(route).toContain('isVerifiedPlatformQuestion(question)');
    expect(route).toContain('return verifiedPost(rebuildRequest(request, normalizedBody));');
  });

  it('binds general agricultural generation to the current question', () => {
    expect(route).toContain('question: envelope.question');
    expect(route).toContain('originalQuestion: envelope.question');
    expect(route).toContain('history: envelope.history');
    expect(route).toContain('currentTurnBound: true');
  });

  it('uses the existing signed local Qwen authority without a paid external API', () => {
    expect(route).toContain("const SIGNATURE_VERSION = 'tai-public-qwen.v1'");
    expect(route).toContain("const INTERNAL_PATH = '/internal/tai/public-generate'");
    expect(route).toContain("new URL('internal/tai/public-generate', base)");
    expect(route).not.toMatch(/api\.openai\.com|anthropic|gemini/iu);
  });
});

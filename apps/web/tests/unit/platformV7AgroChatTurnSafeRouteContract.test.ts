import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const nextConfig = fs.readFileSync(path.join(root, 'apps/web/next.config.js'), 'utf8');
const route = fs.readFileSync(path.join(root, 'apps/web/app/api/agro-chat-turn-safe/route.ts'), 'utf8');
const context = fs.readFileSync(path.join(root, 'apps/web/lib/platform-v7/agro-chat-turn-context.ts'), 'utf8');

describe('public TAI turn-safe route authority', () => {
  it('binds the public endpoint to the turn-safe layer before the model-first route', () => {
    expect(nextConfig).toContain("{ source: '/api/public-platform-assistant', destination: '/api/agro-chat-turn-safe' }");
    expect(route).toContain("POST as agroChatPost");
    expect(route).toContain('selectTurnSafeAgroHistory(question, row.history)');
  });

  it('clears history for complete questions and carries it only for explicit follow-ups', () => {
    expect(context).toContain('if (!isExplicitAgroFollowUp(question) || !Array.isArray(value)) return Object.freeze([])');
    expect(context).toContain('FOLLOW_UP_PREFIX');
    expect(context).toContain('FOLLOW_UP_REFERENCE');
    expect(context).toContain('BARE_FOLLOW_UP');
  });

  it('preserves the accepted model-first, signed, read-only agricultural route', () => {
    expect(route).toContain("from '../agro-chat/route'");
    expect(route).not.toContain('AI_ASSISTANT_BASE_URL');
    expect(route).not.toContain('openai.com');
    expect(route).not.toContain('tenantId');
    expect(route).not.toContain('role:');
  });
});
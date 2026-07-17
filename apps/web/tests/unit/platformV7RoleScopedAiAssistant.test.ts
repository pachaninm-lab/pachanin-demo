import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const panel = read('apps/web/components/platform-v7/AiAssistantPanel.tsx');
const contextual = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const hydration = read('apps/web/components/platform-v7/HydrationSafeChatSupport.tsx');
const assistantPage = read('apps/web/app/platform-v7/assistant/page.tsx');
const proxy = read('apps/web/app/api/proxy/[...path]/route.ts');
const routes = read('apps/web/lib/platform-v7/routes.ts');
const apiService = read('apps/api/src/modules/ai-insights/ai-assistant.service.ts');
const apiController = read('apps/api/src/modules/ai-insights/ai-assistant.controller.ts');
const legacyInsights = read('apps/api/src/modules/ai-insights/ai-insights.service.ts');

describe('platform-v7 role-scoped AI assistant', () => {
  it('mounts the assistant only in private platform workspaces and preserves public support', () => {
    expect(hydration).toContain('ContextualSupportOrAssistant');
    expect(contextual).toContain("<AiAssistantPanel variant='floating' />");
    expect(contextual).toContain('<ChatSupportWidget />');
    expect(contextual).toContain("'/platform-v7/login'");
    expect(contextual).toContain("'/platform-v7/how-it-works'");
  });

  it('uses the real backend for real sessions and an explicitly labelled role-scoped synthetic mode only for demo tokens', () => {
    expect(panel).toContain("fetch('/api/proxy/ai-assistant/chat'");
    expect(proxy).toContain("function isAssistantPath(path: string)");
    expect(proxy).toContain("const demoToken = token.startsWith('demo.')");
    expect(proxy).toContain("const strictRealPath = requiresRealBackend(path) || (isAssistantPath(path) && !demoToken)");
    expect(proxy).toContain("dataMode: 'synthetic_demo'");
    expect(proxy).toContain('Используются только синтетические демонстрационные данные.');
    expect(proxy).toContain('AI_ASSISTANT_DEAL_NOT_AVAILABLE');
    expect(proxy).toContain('demoDealsFor(role, email)');
    expect(proxy).not.toContain('Подмена реальных данных демонстрационными разрешена');
  });

  it('keeps deal data out of browser persistence and exposes a mobile-safe full workspace', () => {
    expect(panel).not.toContain('localStorage');
    expect(panel).not.toContain('sessionStorage');
    expect(panel).toContain("data-ai-mode='read-only'");
    expect(panel).toContain("href='/platform-v7/assistant'");
    expect(panel).toContain('@media(max-width:720px)');
    expect(assistantPage).toContain("robots: { index: false, follow: false }");
    expect(assistantPage).toContain("<AiAssistantPanel variant='workspace' />");
    expect(routes).toContain("export const PLATFORM_V7_AI_ROUTE = '/platform-v7/assistant';");
  });

  it('derives role and deal scope on the server for every real query', () => {
    expect(apiController).toContain("@Roles('ANY_AUTHENTICATED')");
    expect(apiController).toContain("@Controller('ai-assistant')");
    expect(apiController).toContain("name: 'ai_assistant_chat'");
    expect(apiService).toContain('this.registry.listAccessible({ limit: 20 }, user)');
    expect(apiService).toContain('this.deals.workspace(selectedDeal.id, user)');
    expect(apiService).toContain("code: 'AI_ASSISTANT_DEAL_NOT_AVAILABLE'");
    expect(apiService).toContain("action: 'AI_ASSISTANT_QUERY'");
    expect(apiService).toContain("mode: 'read_only'");
  });

  it('supports zero-cost local operation and a host-allowlisted OpenAI-compatible provider', () => {
    expect(apiService).toContain("process.env.AI_ASSISTANT_PROVIDER || 'local'");
    expect(apiService).toContain("'local-deterministic'");
    expect(apiService).toContain('AI_ASSISTANT_ALLOWED_HOSTS');
    expect(apiService).toContain("'127.0.0.1,localhost'");
    expect(apiService).toContain("new URL('chat/completions'");
  });

  it('removes the direct foreign SaaS call and fabricated operational metrics from the compatibility endpoint', () => {
    expect(legacyInsights).not.toContain('api.anthropic.com');
    expect(legacyInsights).not.toContain('ANTHROPIC_API_KEY');
    expect(legacyInsights).not.toContain('Dispute rate 4.2%');
    expect(legacyInsights).not.toContain('2 активных спора');
    expect(legacyInsights).toContain('Runtime role always comes from RequestUser');
  });
});

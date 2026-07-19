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
  it('mounts one role-scoped assistant inside the shared contact dock in private workspaces', () => {
    expect(hydration).toContain('ContextualSupportOrAssistant');
    expect(hydration).toContain('structured');
    expect(hydration).toContain('decision cards');
    expect(contextual).toContain("<AiAssistantPanel variant='floating' />");
    expect(contextual).toContain('<ChatSupportWidget />');
    expect(contextual).toContain("'/platform-v7/login'");
    expect(contextual).toContain("'/platform-v7/how-it-works'");
    expect(contextual).toContain("<PublicContactDock assistantContext='private' />");
    expect(contextual).toContain("<PublicContactDock assistantContext='workspace' />");
  });

  it('uses the real backend for real sessions and an explicitly labelled role-scoped synthetic mode only for demo tokens', () => {
    expect(panel).toContain("fetch('/api/proxy/ai-assistant/chat'");
    expect(panel).toContain("fetch('/api/proxy/ai-assistant/catalog'");
    expect(proxy).toContain('function isAssistantPath(path: string)');
    expect(proxy).toContain("const demoToken = token.startsWith('demo.')");
    expect(proxy).toContain('const strictRealPath = requiresRealBackend(path) || (isAssistantPath(path) && !demoToken)');
    expect(proxy).toContain("dataMode: 'synthetic_demo'");
    expect(proxy).toContain('Используются только синтетические демонстрационные данные.');
    expect(proxy).toContain('AI_ASSISTANT_DEAL_NOT_AVAILABLE');
    expect(proxy).toContain('demoDealsFor(role, email)');
    expect(proxy).toContain('decision: demoDecision(selected, deals, role, locale, generatedAt)');
    expect(proxy).not.toContain('Подмена реальных данных демонстрационными разрешена');
  });

  it('provides a live conversational feel without claiming to be a human', () => {
    expect(panel).toContain('timeGreeting(locale)');
    expect(panel).toContain('p7-ai-presence');
    expect(panel).toContain('Проверяю доступ…');
    expect(panel).toContain('Собираю факты сделки…');
    expect(panel).toContain('Формирую ответ…');
    expect(panel).toContain('AbortController');
    expect(panel).toContain('const stop = () =>');
    expect(panel).toContain('p7-ai-typing');
    expect(apiService).toContain("personality: 'professional_conversational'");
    expect(apiService).toContain("transparency: 'AI assistant; not a human employee'");
    expect(apiService).toContain('Be conversational, attentive and natural, but never pretend to be a human.');
    expect(assistantPage).toContain('Он остаётся ИИ, а не человеком');
  });

  it('returns and renders a machine-readable decision contract with evidence and safe follow-ups', () => {
    expect(apiService).toContain('export type AssistantDecision');
    expect(apiService).toContain("responseContract: 'assistant_decision_v2'");
    expect(apiService).toContain('actionAllowed: false');
    expect(apiService).toContain("actionKind: 'NONE'");
    expect(apiService).toContain("dataMode: 'authoritative'");
    expect(apiService).toContain('followUpsFor(intent, request.locale');
    expect(panel).toContain('function DecisionCard');
    expect(panel).toContain('decision.reason');
    expect(panel).toContain('decision.nextAction');
    expect(panel).toContain('decision.ownerRole');
    expect(panel).toContain('decision.deadlineAt');
    expect(panel).toContain('decision.moneyAtRiskKopecks');
    expect(panel).toContain('decision.evidence');
    expect(panel).toContain('decision.followUps');
  });

  it('keeps deal data out of browser persistence and exposes a mobile-safe full workspace', () => {
    expect(panel).not.toContain('localStorage');
    expect(panel).not.toContain('sessionStorage');
    expect(panel).toContain("data-ai-mode='read-only'");
    expect(panel).toContain('data-ai-data-mode={dataMode}');
    expect(panel).toContain("href='/platform-v7/assistant'");
    expect(panel).toContain('@media(max-width:720px)');
    expect(panel).toContain('@media(prefers-reduced-motion:reduce)');
    expect(assistantPage).toContain("robots: { index: false, follow: false }");
    expect(assistantPage).toContain("<AiAssistantPanel variant='workspace' />");
    expect(routes).toContain("export const PLATFORM_V7_AI_ROUTE = '/platform-v7/assistant';");
    expect(routes).toContain("export const PLATFORM_V7_AI_COMPATIBILITY_ROUTE = '/platform-v7/ai';");
  });

  it('derives role and deal scope on the server for every real query', () => {
    expect(apiController).toContain("@Roles('ANY_AUTHENTICATED')");
    expect(apiController).toContain("@Controller('ai-assistant')");
    expect(apiController).toContain("name: 'ai_assistant_chat'");
    expect(apiController).toContain('Promise<AssistantChatResponse>');
    expect(apiService).toContain('this.registry.listAccessible({ limit: 30 }, user)');
    expect(apiService).toContain('this.deals.workspace(selectedDeal.id, user)');
    expect(apiService).toContain("code: 'AI_ASSISTANT_DEAL_NOT_AVAILABLE'");
    expect(apiService).toContain("action: 'AI_ASSISTANT_QUERY'");
    expect(apiService).toContain("mode: 'read_only'");
    expect(apiService).toContain('minimizeWorkspace(workspace)');
  });

  it('supports zero-cost local operation and a host-allowlisted OpenAI-compatible provider', () => {
    expect(apiService).toContain("process.env.AI_ASSISTANT_PROVIDER || 'local'");
    expect(apiService).toContain("'local-deterministic'");
    expect(apiService).toContain('AI_ASSISTANT_ALLOWED_HOSTS');
    expect(apiService).toContain("'127.0.0.1,localhost'");
    expect(apiService).toContain("new URL('chat/completions'");
  });

  it('removes direct foreign SaaS use and routes legacy hints to the canonical assistant', () => {
    expect(legacyInsights).not.toContain('api.anthropic.com');
    expect(legacyInsights).not.toContain('ANTHROPIC_API_KEY');
    expect(legacyInsights).not.toContain('Dispute rate 4.2%');
    expect(legacyInsights).not.toContain('2 активных спора');
    expect(legacyInsights).toContain('Runtime role always comes from RequestUser');
    expect(legacyInsights).toContain("canonicalAssistantRoute: '/ai-assistant/chat'");
    expect(legacyInsights).toContain("responseContract: 'legacy_insight_v1'");
  });
});

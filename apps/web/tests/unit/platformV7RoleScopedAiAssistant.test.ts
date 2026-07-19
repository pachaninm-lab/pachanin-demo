import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const panel = read('apps/web/components/platform-v7/AiAssistantPanel.tsx');
const contextual = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const hydration = read('apps/web/components/platform-v7/HydrationSafeChatSupport.tsx');
const cabinetDock = read('apps/web/components/platform-v7/CabinetContactDock.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const assistantPage = read('apps/web/app/platform-v7/assistant/page.tsx');
const proxy = read('apps/web/app/api/proxy/[...path]/route.ts');
const apiService = read('apps/api/src/modules/ai-insights/ai-assistant.service.ts');
const apiController = read('apps/api/src/modules/ai-insights/ai-assistant.controller.ts');

describe('platform-v7 role-scoped AI assistant', () => {
  it('mounts one assistant runtime and one verified-role dock in every private cabinet', () => {
    expect(hydration).toContain('verifiedRole?: PlatformRole');
    expect(hydration).toContain('renderDock?: boolean');
    expect(contextual).toContain("<AiAssistantPanel variant='floating' />");
    expect(contextual).toContain('<ChatSupportWidget />');
    expect(contextual).toContain("<CabinetContactDock role={verifiedRole} assistantContext='private' />");
    expect(contextual).toContain("<CabinetContactDock role={verifiedRole} assistantContext='workspace' />");
    expect(protectedRuntime).toContain('<CabinetContactDock role={verifiedRole} assistantContext={assistantContext} />');
    expect(protectedRuntime).toContain('<HydrationSafeChatSupport verifiedRole={verifiedRole} renderDock={false} />');
    expect(cabinetDock).toContain('data-cabinet-role={role}');
  });

  it('keeps the assistant role and deal authority on the server', () => {
    expect(panel).toContain("fetch('/api/proxy/ai-assistant/chat'");
    expect(panel).toContain("fetch('/api/proxy/ai-assistant/catalog'");
    expect(proxy).toContain('const strictRealPath = requiresRealBackend(path)');
    expect(apiController).toContain("@Roles('ANY_AUTHENTICATED')");
    expect(apiController).toContain("@Controller('ai-assistant')");
    expect(apiService).toContain('this.registry.listAccessible({ limit: 30 }, user)');
    expect(apiService).toContain('this.deals.workspace(selectedDeal.id, user)');
    expect(apiService).toContain("action: 'AI_ASSISTANT_QUERY'");
    expect(apiService).toContain("mode: 'read_only'");
  });

  it('renders the decision contract and clear read-only boundaries', () => {
    expect(apiService).toContain('export type AssistantDecision');
    expect(apiService).toContain("responseContract: 'assistant_decision_v2'");
    expect(apiService).toContain('actionAllowed: false');
    expect(panel).toContain('function DecisionCard');
    expect(panel).toContain('decision.nextAction');
    expect(panel).toContain('decision.ownerRole');
    expect(panel).toContain('decision.evidence');
    expect(panel).toContain("data-ai-mode='read-only'");
    expect(panel).toContain('data-ai-data-mode={dataMode}');
  });

  it('keeps a natural but explicitly non-human conversational surface', () => {
    expect(panel).toContain('timeGreeting(locale)');
    expect(panel).toContain('p7-ai-presence');
    expect(panel).toContain('Проверяю доступ…');
    expect(panel).toContain('AbortController');
    expect(panel).toContain('const stop = () =>');
    expect(apiService).toContain("personality: 'professional_conversational'");
    expect(apiService).toContain('never pretend to be a human');
    expect(assistantPage).toContain('Он остаётся ИИ, а не человеком');
  });

  it('keeps browser persistence free of deal and assistant content', () => {
    expect(panel).not.toContain('localStorage');
    expect(panel).not.toContain('sessionStorage');
    expect(panel).toContain("href='/platform-v7/assistant'");
    expect(panel).toContain('@media(max-width:720px)');
    expect(assistantPage).toContain("<AiAssistantPanel variant='workspace' />");
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
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

  it('does not eagerly import legacy dictionaries on locale-native public pages', () => {
    expect(hydration).not.toMatch(/import\s*\{[^}]*\bPlatformV7TranslationRuntimeBridge\b[^}]*\}\s*from/u);
    expect(hydration).not.toContain('dictionaries.json');
    expect(hydration).not.toContain('manual-dictionary-overrides');
    const start = hydration.indexOf('const PlatformV7TranslationRuntimeBridge = dynamic(');
    const end = hydration.indexOf('const ContextualSupportOrAssistant = dynamic<');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const loader = hydration.slice(start, end);
    expect(loader).toContain("() => import('@/components/platform-v7/PlatformV7TranslationRuntimeBridge')");
    expect(loader).toContain('.then((module) => module.PlatformV7TranslationRuntimeBridge)');
    expect(loader).toContain('ssr: false');
    expect(loader).toContain('loading: () => null');
  });

  it('keeps existing translation routes and the immediate single chat mount unchanged', () => {
    expect(hydration).toContain("return clean === '/platform-v7/deal-flow' || clean === '/platform-v7/demo';");
    expect(hydration).toContain("return clean === '/platform-v7' || clean === '/pc-public-entry/platform-v7';");
    expect(hydration).toContain('loadLegacyPublicPolish = legacyPublicPolish ?? !isStrategicHomepage(pathname)');
    expect(hydration).toContain('{loadTranslationBridge ? <PlatformV7TranslationRuntimeBridge /> : null}');
    expect(hydration.match(/<ContextualSupportOrAssistant\s+\{\.\.\.supportProps\}\s*\/>/gu)).toHaveLength(1);
    // The viewport authority now travels with the on-demand public assistant chunk.
    expect(hydration).not.toContain('<PublicAssistantMobileLayoutAuthority />');
    expect(contextual).toContain('<PublicAssistantMobileLayoutAuthority />');
    for (const deferredChatMechanism of ['requestIdleCallback', 'setTimeout(', 'IntersectionObserver', 'pointerdown']) {
      expect(hydration).not.toContain(deferredChatMechanism);
    }
  });
});


describe('public assistant bootstrap boundaries', () => {
  it('loads private-only assistant components only through their existing branches', () => {
    expect(contextual).toContain("import dynamic from 'next/dynamic'");
    for (const name of ['AiAssistantPanel', 'CabinetContactDock']) {
      expect(contextual).not.toContain(`import { ${name} } from './${name}'`);
      const start = contextual.indexOf(`const ${name} = dynamic(`);
      expect(start).toBeGreaterThanOrEqual(0);
      const loader = contextual.slice(start, contextual.indexOf('\n);', start) + 3);
      expect(loader).toContain(`() => import('./${name}').then((module) => module.${name})`);
      expect(loader).toContain('ssr: false');
      expect(loader).toContain('loading: () => null');
    }
    for (const name of ['PublicPlatformAssistant', 'PublicAssistantAttachmentBridge', 'ChatSupportWidget']) {
      expect(contextual).toContain(`import { ${name} } from './${name}'`);
      expect(contextual).not.toContain(`const ${name} = dynamic(`);
    }
    for (const forbidden of ['requestIdleCallback', 'setTimeout(', 'IntersectionObserver']) {
      expect(contextual).not.toContain(forbidden);
    }
  });

  it('selects public chat for the three canonical pages without opening private prefixes', () => {
    const start = contextual.indexOf('const ASSISTANT_WORKSPACE');
    const end = contextual.indexOf('export function ContextualSupportOrAssistant');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const source = `${contextual.slice(start, end)}\nexports.isPrivateWorkspace = isPrivateWorkspace;`;
    const context = { exports: {} as { isPrivateWorkspace: (pathname: string) => boolean } };
    runInNewContext(transpileModule(source, {
      compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.CommonJS },
    }).outputText, context, { timeout: 1000 });

    for (const prefix of ['', '/pc-public-entry']) {
      for (const suffix of ['', '/', '?lang=ru', '?lang=en', '?lang=zh']) {
        for (const page of ['market', 'capabilities', 'gekta', 'login', 'register', 'how-it-works', 'ai-in-action']) {
          expect(context.exports.isPrivateWorkspace(`${prefix}/platform-v7/${page}${suffix}`)).toBe(false);
        }
        for (const page of ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'staff', 'assistant', 'deals/private', 'market/private', 'capabilities/private', 'gekta/private']) {
          expect(context.exports.isPrivateWorkspace(`${prefix}/platform-v7/${page}${suffix}`)).toBe(true);
        }
      }
    }
  });
});

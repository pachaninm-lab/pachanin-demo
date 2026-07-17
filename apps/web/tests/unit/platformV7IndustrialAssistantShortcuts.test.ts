import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const contextual = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const publicAssistant = read('apps/web/components/platform-v7/PublicPlatformAssistant.tsx');
const privateShortcut = read('apps/web/components/platform-v7/PrivateAssistantShortcutLabel.tsx');
const publicRoute = read('apps/web/app/api/public-platform-assistant/route.ts');
const knowledge = read('apps/web/lib/platform-v7/public-assistant-knowledge.ts');
const publicStyles = read('apps/web/styles/platform-v7-public-assistant.css');
const privateStyles = read('apps/web/components/platform-v7/PrivateAssistantShortcutLabel.module.css');

describe('platform-v7 industrial assistant shortcuts', () => {
  it('keeps public knowledge and private Deal assistance as separate surfaces', () => {
    expect(contextual).toContain("if (path === PUBLIC_HOME)");
    expect(contextual).toContain('<PublicPlatformAssistant />');
    expect(contextual).toContain('<ChatSupportWidget />');
    expect(contextual).toContain('<PrivateAssistantShortcutLabel />');
    expect(contextual).toContain("<AiAssistantPanel variant='floating' />");
    expect(contextual).toContain('separate no-account-data knowledge assistant');
    expect(publicAssistant).not.toContain('/api/proxy/ai-assistant');
    expect(privateShortcut).toContain("href='/platform-v7/assistant'");
  });

  it('exposes a visible RU EN ZH private shortcut without claiming unverified Deal context', () => {
    expect(privateShortcut).toContain('Помощник сделки');
    expect(privateShortcut).toContain('Deal assistant');
    expect(privateShortcut).toContain('交易助手');
    expect(privateShortcut).toContain('Ролевой контекст ЛК');
    expect(privateShortcut).not.toContain('?deal=');
    expect(privateStyles).toContain('min-height: 54px');
    expect(privateStyles).toContain('env(safe-area-inset-bottom)');
    expect(privateStyles).toContain('@media (forced-colors: active)');
  });

  it('uses a stateless public knowledge API with bounded input and no external model call', () => {
    expect(publicRoute).toContain('MAX_MESSAGE_LENGTH = 1_200');
    expect(publicRoute).toContain('MAX_BODY_BYTES = 8_192');
    expect(publicRoute).toContain("dataMode: 'public_knowledge'");
    expect(publicRoute).toContain("mode: 'read_only'");
    expect(publicRoute).toContain('PUBLIC_ASSISTANT_CROSS_SITE_DENIED');
    expect(publicRoute).toContain("'Cache-Control': 'no-store, max-age=0'");
    expect(publicRoute).not.toContain('openai');
    expect(publicRoute).not.toContain('gigachat');
    expect(publicRoute).not.toContain('fetch(');
  });

  it('localizes source labels for RU EN ZH without changing canonical source routes', () => {
    expect(publicRoute).toContain('SOURCE_LABELS');
    expect(publicRoute).toContain("'/platform-v7/how-it-works': 'How the Deal works'");
    expect(publicRoute).toContain("'/platform-v7/how-it-works': '交易如何运作'");
    expect(publicRoute).toContain('sources: localizedSources(answer.sources, locale)');
  });

  it('publishes versioned platform knowledge and fail-safe maturity boundaries', () => {
    expect(knowledge).toContain("PUBLIC_ASSISTANT_KNOWLEDGE_VERSION = 'public-platform-knowledge-2026-07-17.v1'");
    expect(knowledge).toContain('actionAllowed: false');
    expect(knowledge).toContain('По умолчанию внешние интеграции считаются NOT_CONNECTED');
    expect(knowledge).toContain('Модель не получает прямой доступ к базе данных');
    expect(knowledge).toContain('Ни один помощник не выпускает деньги');
    expect(knowledge).toContain("id: 'money'");
    expect(knowledge).toContain("id: 'integrations'");
    expect(knowledge).toContain("id: 'security'");
    expect(knowledge).toContain("id: 'assistant'");
  });

  it('does not persist public questions and remains accessible on mobile', () => {
    expect(publicAssistant).toContain("fetch('/api/public-platform-assistant'");
    expect(publicAssistant).toContain("trackEvent('public_platform_assistant_opened'");
    expect(publicAssistant).toContain("role='dialog'");
    expect(publicAssistant).toContain("aria-modal='true'");
    expect(publicAssistant).toContain('AbortController');
    expect(publicAssistant).not.toContain('localStorage');
    expect(publicAssistant).not.toContain('sessionStorage');
    expect(publicStyles).toContain('@media (max-width: 720px)');
    expect(publicStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(publicStyles).toContain('@media (forced-colors: active)');
    expect(publicStyles).toContain('env(safe-area-inset-left)');
  });
});

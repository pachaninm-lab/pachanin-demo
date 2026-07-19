import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const assistant = read('apps/web/components/platform-v7/PublicPlatformAssistant.tsx');
const support = read('apps/web/components/platform-v7/ChatSupportWidget.tsx');
const modalCss = read('apps/web/styles/platform-v7-unified-modal-fullscreen.css');

describe('platform-v7 public assistant and support UX', () => {
  it('preserves the verified public assistant and support boundaries', () => {
    expect(assistant).toContain("data-public-platform-assistant='true'");
    expect(assistant).toContain("fetch('/api/public-platform-assistant'");
    expect(assistant).toContain("dataMode: 'public_knowledge'");
    expect(support).toContain("fetch('/api/platform-v7/inquiries'");
    expect(support).toContain("consent: consent ? 'yes' : 'no'");
  });

  it('uses an explicit AI identity and a truthful public-mode boundary', () => {
    expect(assistant).toContain("title: 'ИИ-помощник'");
    expect(assistant).toContain("subtitle: 'Публичный режим · без доступа к данным сделок'");
    expect(assistant).toContain("data-conversation={hasConversation ? 'true' : 'false'}");
  });

  it('renders a deterministic intent-first start screen without waiting for the catalog request', () => {
    expect(assistant).toContain('starterPrompts: [');
    expect(assistant).toContain("className='pc-public-assistant-welcome'");
    expect(assistant).toContain("className='pc-public-assistant-starter-block'");
    expect(assistant).toContain('catalog?.starterPrompts?.length ? catalog.starterPrompts : ui.starterPrompts');
    expect(modalCss).toContain('.pc-public-assistant-welcome {');
    expect(modalCss).toContain('.pc-public-assistant-starter-block {');
    expect(modalCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important');
  });

  it('keeps the composer compact and removes the redundant reset action before a conversation starts', () => {
    expect(assistant).toContain("data-single-action={!hasConversation ? 'true' : 'false'}");
    expect(assistant).toContain("{hasConversation ? <button type='button' className='pc-public-assistant-secondary'");
    expect(modalCss).toContain(".pc-public-assistant-form[data-single-action='true']");
    expect(modalCss).toContain('.pc-public-assistant-primary:disabled');
    expect(modalCss).toContain('opacity: 1 !important');
  });

  it('does not force the mobile keyboard open when the sheet is opened', () => {
    expect(assistant).toContain("window.matchMedia('(min-width: 721px)').matches");
    expect(assistant).toContain('if (shouldAutofocusComposer()) textareaRef.current?.focus()');
  });

  it('uses one focus ring and a sticky compact support action', () => {
    expect(modalCss).toContain('.p7-support-chat-panel select:focus-visible');
    expect(modalCss).toContain('outline: none !important');
    expect(modalCss).toContain('box-shadow: 0 0 0 2px rgba(21, 148, 93, 0.22) !important');
    expect(modalCss).toContain('.p7-support-chat-submit {');
    expect(modalCss).toContain('position: sticky;');
    expect(modalCss).toContain('min-height: 46px !important');
    expect(modalCss).toContain('min-height: 96px !important');
  });

  it('keeps subtitles readable and preserves accessibility fallbacks', () => {
    expect(modalCss).toContain('.pc-public-assistant-identity span:not(.pc-public-assistant-mark)');
    expect(modalCss).toContain('white-space: normal !important');
    expect(modalCss).toContain('-webkit-line-clamp: 2');
    expect(modalCss).toContain('@media (max-width: 350px)');
    expect(modalCss).toContain('@media (forced-colors: active)');
    expect(modalCss).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

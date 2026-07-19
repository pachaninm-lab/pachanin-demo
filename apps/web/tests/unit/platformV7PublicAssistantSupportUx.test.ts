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

  it('shows starter intents on mobile instead of leaving an empty chat region', () => {
    expect(assistant).toContain("className='pc-public-assistant-starters'");
    expect(modalCss).toContain('.pc-public-assistant-starters {');
    expect(modalCss).toContain('display: grid !important');
    expect(modalCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important');
    expect(modalCss).toContain(":not(:has(.pc-public-assistant-answer)) .pc-public-assistant-messages");
    expect(modalCss).toContain('max-height: 190px !important');
  });

  it('keeps the composer fixed, compact and explicit in disabled state', () => {
    expect(modalCss).toContain('.pc-public-assistant-form {');
    expect(modalCss).toContain('position: sticky !important');
    expect(modalCss).toContain('min-height: 50px !important');
    expect(modalCss).toContain('.pc-public-assistant-primary:disabled');
    expect(modalCss).toContain('opacity: 1 !important');
  });

  it('uses a single focus ring instead of a doubled outline and glow', () => {
    expect(modalCss).toContain('.p7-support-chat-panel select:focus-visible');
    expect(modalCss).toContain('outline: none !important');
    expect(modalCss).toContain('box-shadow: 0 0 0 2px rgba(21, 148, 93, 0.22) !important');
  });

  it('keeps the support form compact while retaining accessible controls', () => {
    expect(modalCss).toContain('.p7-support-chat-form {');
    expect(modalCss).toContain('gap: 10px !important');
    expect(modalCss).toContain('min-height: 46px !important');
    expect(modalCss).toContain('min-height: 96px !important');
    expect(modalCss).toContain('.p7-support-chat-submit {');
    expect(modalCss).toContain('min-height: 48px !important');
  });

  it('keeps subtitles readable instead of clipping them with an ellipsis', () => {
    expect(modalCss).toContain('.pc-public-assistant-identity span:not(.pc-public-assistant-mark)');
    expect(modalCss).toContain('white-space: normal !important');
    expect(modalCss).toContain('-webkit-line-clamp: 2');
  });

  it('preserves forced-colors and small-screen fallbacks', () => {
    expect(modalCss).toContain('@media (max-width: 350px)');
    expect(modalCss).toContain('@media (forced-colors: active)');
    expect(modalCss).toContain('border: 1px solid ButtonText !important');
  });
});

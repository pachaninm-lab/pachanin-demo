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

  it('uses the same public-home tokens for both modal surfaces', () => {
    expect(modalCss).toContain('.pc-public-assistant-panel,\n.p7-support-chat-panel');
    expect(modalCss).toContain('--pc-modal-green: var(--pc-ppe-v5-green, #087a3b)');
    expect(modalCss).toContain('--pc-modal-radius: var(--pc-ppe-v5-radius, 14px)');
    expect(modalCss).toContain('border-radius: var(--pc-modal-radius) !important');
    expect(modalCss).toContain('box-shadow: 0 18px 52px rgba(9, 33, 24, 0.16) !important');
  });

  it('gives AI and support one white institutional header system', () => {
    expect(modalCss).toContain('.pc-public-assistant-header,\n.p7-support-chat-head');
    expect(modalCss).toContain('background: #ffffff !important');
    expect(modalCss).toContain('.pc-public-assistant-mark,\n.p7-support-chat-mark');
    expect(modalCss).toContain('border-radius: var(--pc-modal-radius-small) !important');
    expect(modalCss).toContain('font-weight: 820 !important');
  });

  it('uses one field, focus and action hierarchy', () => {
    expect(modalCss).toContain('.pc-public-assistant-form textarea,\n.p7-support-chat-form input');
    expect(modalCss).toContain('min-height: 48px !important');
    expect(modalCss).toContain('box-shadow: 0 0 0 2px rgba(8, 122, 59, 0.18) !important');
    expect(modalCss).toContain('.pc-public-assistant-primary,\n.p7-support-chat-submit');
    expect(modalCss).toContain('background: var(--pc-modal-green) !important');
    expect(modalCss).toContain('opacity: 1 !important');
  });

  it('keeps the support form compact and the assistant composer anchored', () => {
    expect(modalCss).toContain('.p7-support-chat-form {');
    expect(modalCss).toContain('gap: 11px !important');
    expect(modalCss).toContain('min-height: 112px !important');
    expect(modalCss).toContain('.pc-public-assistant-form {');
    expect(modalCss).toContain('position: sticky !important');
    expect(modalCss).toContain('min-height: 56px !important');
  });

  it('preserves mobile bottom-sheet, short-viewport and accessibility fallbacks', () => {
    expect(modalCss).toContain('border-radius: 18px 18px 0 0 !important');
    expect(modalCss).toContain('@media (max-height: 600px) and (max-width: 720px)');
    expect(modalCss).toContain('@media (max-width: 350px)');
    expect(modalCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(modalCss).toContain('@media (forced-colors: active)');
    expect(modalCss).toContain('border: 1px solid ButtonText !important');
  });
});

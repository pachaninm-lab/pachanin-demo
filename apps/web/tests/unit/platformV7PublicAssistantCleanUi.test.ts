import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const assistant = read('apps/web/components/platform-v7/PublicPlatformAssistant.tsx');
const css = read('apps/web/styles/platform-v7-public-assistant.css');

describe('platform-v7 clean public AI window', () => {
  it('keeps one compact empty state with no more than three quick prompts', () => {
    expect(assistant).toContain("className='pc-public-assistant-empty'");
    expect(assistant).toContain('.slice(0, 3)');
    expect(assistant).toContain("className='pc-public-assistant-quick-actions'");
    expect(assistant).not.toContain('pc-public-assistant-boundary');
  });

  it('uses one integrated composer instead of a permanent secondary action row', () => {
    expect(assistant).toContain("className='pc-public-assistant-composer-shell'");
    expect(assistant).toContain("className='pc-public-assistant-composer-button'");
    expect(assistant).toContain("className='pc-public-assistant-privacy'");
    expect(assistant).not.toContain('pc-public-assistant-form-actions');
    expect(assistant).not.toContain('pc-public-assistant-primary');
    expect(assistant).not.toContain('pc-public-assistant-secondary');
  });

  it('shows reset only after conversation content exists', () => {
    expect(assistant).toContain('const hasConversation = messages.length > 0');
    expect(assistant).toContain("className='pc-public-assistant-header-action'");
    expect(assistant).toContain('{hasConversation ? (');
    expect(assistant).toContain('onClick={reset}');
  });

  it('preserves visible sources and collapses secondary provenance', () => {
    expect(assistant).toContain("className='pc-public-assistant-source-list'");
    expect(assistant).toContain("className='pc-public-assistant-details'");
    expect(assistant).toContain('<summary>{ui.details}</summary>');
    expect(assistant).not.toContain('pc-public-assistant-version');
    expect(assistant).toContain("data-knowledge-version={catalog?.knowledgeVersion || 'loading'}");
  });

  it('keeps the public data boundary once and retains cancellation and focus safety', () => {
    expect(assistant.match(/Публичный режим · без доступа к данным личных кабинетов/gu)).toHaveLength(1);
    expect(assistant).toContain("data-kind='stop'");
    expect(assistant).toContain("event.key === 'Escape'");
    expect(assistant).toContain('summary,[tabindex]');
  });

  it('fits mobile widths without horizontal document overflow', () => {
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('@media (max-width: 390px)');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('max-width: 76vw');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });

  it('retains reduced-motion and forced-colors accessibility fallbacks', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('border: 1px solid ButtonText');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const product = read('components/gekta/GektaProductShell.tsx');
const viewport = read('components/gekta/GektaViewportAuthority.tsx');
const composer = read('components/gekta/GektaComposer.tsx');
const empty = read('components/gekta/GektaEmptyState.tsx');

describe('Gekta empty-start keyboard contract', () => {
  it('orders hero, composer and examples before a conversation exists', () => {
    expect(empty).toContain("data-gekta-composer-slot='true'");
    expect(empty.indexOf('{hero}')).toBeLessThan(empty.indexOf("data-gekta-composer-slot='true'"));
    expect(empty.indexOf("data-gekta-composer-slot='true'")).toBeLessThan(empty.indexOf("data-gekta-examples='true'"));
    expect(composer).toContain("import { createPortal } from 'react-dom'");
    expect(composer).toContain('return startSlot ? createPortal(composer, startSlot) : composer');
  });

  it('pins the start shell and composer to the visible keyboard viewport', () => {
    expect(viewport).toContain("workspace?.classList.contains('overflow-hidden') || keyboardOpen");
    expect(product).toContain("html[data-gekta-keyboard-open='true'] [data-gekta-chat-workspace='true']:not(.overflow-hidden)");
    expect(product).toContain('padding-bottom: 0 !important');
    expect(composer).toContain("document.documentElement.dataset.gektaKeyboardOpen === 'true'");
    expect(composer).toContain("attributeFilter: ['data-gekta-keyboard-open']");
  });

  it('preserves focus, selection and direction while the composer changes containers', () => {
    expect(composer).toContain('type RelocationState');
    expect(composer).toContain('document.activeElement === textarea');
    expect(composer).toContain('textarea.selectionStart');
    expect(composer).toContain('textarea.selectionEnd');
    expect(composer).toContain("textarea.focus({ preventScroll: true })");
    expect(composer).toContain('textarea.setSelectionRange(state.start, state.end, state.direction)');
  });

  it('keeps page scroll before focus and message scroll after chat activation', () => {
    expect(product).toContain("[data-gekta-chat-workspace='true']:not(.overflow-hidden) main > div:first-of-type");
    expect(product).toContain('overflow: visible');
    expect(product).toContain("[data-gekta-chat-workspace='true'].overflow-hidden main > div:first-of-type");
    expect(product).toContain('overflow-y: auto');
  });
});

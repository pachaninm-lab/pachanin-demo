import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const product = read('components/gekta/GektaProductShell.tsx');
const experience = read('components/gekta/GektaExperienceFrame.tsx');
const hero = read('components/gekta/GektaHero.tsx');
const discovery = read('components/gekta/GektaDiscoverySections.tsx');
const workspace = read('components/gekta/GektaChatWorkspace.tsx');
const viewport = read('components/gekta/GektaViewportAuthority.tsx');
const composer = read('components/gekta/GektaComposer.tsx');
const attachments = read('components/gekta/GektaAttachments.tsx');
const empty = read('components/gekta/GektaEmptyState.tsx');
const drawer = read('components/gekta/GektaMobileDrawer.tsx');
const dialogFocus = read('components/gekta/useDialogFocus.ts');
const sidebar = read('components/gekta/GektaSidebar.tsx');
const projects = read('components/gekta/GektaProjectList.tsx');
const floating = read('components/gekta/GektaFloatingEntry.tsx');

describe('Gekta mobile UX red-team contracts', () => {
  it('follows the actually visible viewport with a bounded keyboard inset and one document scroll authority', () => {
    expect(product).toContain('<GektaViewportAuthority />');
    expect(viewport).toContain('window.visualViewport');
    expect(viewport).toContain('window.requestAnimationFrame(syncViewport)');
    expect(viewport).toContain('new ResizeObserver');
    expect(viewport).toContain("--gekta-visual-viewport-height");
    expect(viewport).toContain("--gekta-keyboard-inset");
    expect(viewport).toContain("--gekta-composer-height");
    expect(viewport).toContain('Math.max(0, Math.min(maxInset');
    expect(viewport).toContain("document.addEventListener('focusin'");
    expect(viewport).not.toContain("document.body.style.overflow = 'hidden'");
    expect(viewport).not.toContain("root.style.overflow = 'hidden'");
    expect(product).toContain("[data-gekta-chat-workspace='true']:not(.overflow-hidden)");
    expect(product).toContain('overflow: visible');
    expect(product).toContain("[data-gekta-chat-workspace='true'].overflow-hidden main > div:first-of-type");
    expect(product).toContain('overflow-y: auto');
    expect(product).toContain("[data-gekta-chat-workspace='true'].overflow-hidden");
    expect(product).toContain('position: fixed');
    expect(product).toContain('top: var(--gekta-visual-viewport-top, 0px)');
    expect(product).toContain('height: var(--gekta-visual-viewport-height, 100dvh)');
  });

  it('places the composer between the compact hero and two examples before chat starts', () => {
    expect(empty).toContain("data-gekta-composer-slot='true'");
    expect(empty.indexOf('{hero}')).toBeLessThan(empty.indexOf("data-gekta-composer-slot='true'"));
    expect(empty.indexOf("data-gekta-composer-slot='true'")).toBeLessThan(empty.indexOf("data-gekta-examples='true'"));
    expect(composer).toContain("import { createPortal } from 'react-dom'");
    expect(composer).toContain("workspace.classList.contains('overflow-hidden')");
    expect(composer).toContain("[data-gekta-composer-slot='true']");
    expect(composer).toContain('return startSlot ? createPortal(composer, startSlot) : composer');
    expect(product).toContain("main > div:last-of-type:empty");
  });

  it('keeps mobile header actions and the scroll affordance inside the 44px contract', () => {
    expect(product).toContain("[data-gekta-header-new-chat='true']");
    expect(workspace).toMatch(/className='[^']*min-h-11[^']*' aria-label=\{ui\.productHome\} data-gekta-brand-home='true'/);
    expect(product).toContain('min-width: 44px');
    expect(product).toContain('min-height: 44px');
    expect(composer).toContain("data-gekta-composer-root='true'");
    expect(product).toContain("bottom: calc(var(--gekta-composer-height, 116px) + 12px) !important");
    expect(product).toContain('width: 44px');
    expect(product).toContain('height: 44px');
    expect(viewport).toContain('К последнему сообщению');
    expect(viewport).toContain('Go to the latest message');
    expect(viewport).toContain('前往最新消息');
  });

  it('uses iOS-safe form sizing, one focus ring and complete disabled semantics', () => {
    expect(composer).toContain('rows={1}');
    expect(composer).toContain('text-[16px]');
    expect(composer).toContain('Math.min(144, Math.max(68');
    expect(composer).toContain('Boolean(value.trim() || documents.length)');
    expect(composer).toContain('ATTACHMENT_ONLY_PROMPT');
    expect(composer).toContain('CircleSlash2');
    expect(composer).toContain('text-[14px] leading-5');
    expect(composer).toContain('Не отправляй пароли, токены и другие секреты.');
    expect(product).toContain("input:not([type='checkbox']):not([type='radio']):not([type='file'])");
    expect(product).toContain('font-size: 16px !important');
    expect(product).toContain("[data-gekta-phone-card='true'] button");
    expect(attachments).toContain('textareaFocused');
    expect(attachments).not.toContain('focus-within:border-emerald-700');
    expect(attachments).toContain('shadow-[0_10px_30px');
  });

  it('shows only two first-screen examples and preserves the rest behind disclosure', () => {
    expect(empty).toContain('starters.slice(0, 2)');
    expect(empty).toContain('...starters.slice(2)');
    expect(empty).toContain('...copy.extraStarters');
    expect(empty).toContain("min-h-[78px]");
    expect(empty).not.toContain('hidden={!expanded}');
    expect(empty).toContain("className={expanded ? 'mt-4 grid");
    expect(empty).toContain(": 'hidden'}");
  });

  it('keeps the composer as the only primary entry inside Gekta', () => {
    expect(experience).not.toContain("data-gekta-floating-entry='product'");
    expect(experience).not.toContain('GEKTA_ENTER_CHAT_EVENT');
    expect(hero).not.toContain('GektaProductCta');
    expect(discovery).not.toContain('GektaProductCta');
  });

  it('makes the drawer modal, bounded and reversible', () => {
    expect(drawer).toContain("var(--gekta-visual-viewport-top, 0px)");
    expect(drawer).toContain("var(--gekta-visual-viewport-height, 100dvh)");
    expect(drawer).toContain("min(88vw, 360px, calc(100vw - 48px))");
    expect(drawer).toContain("element.setAttribute('inert', '')");
    expect(drawer).toContain("element.setAttribute('aria-hidden', 'true')");
    expect(drawer).toContain("element.removeAttribute('inert')");
    expect(drawer).toContain("aria-modal='true'");
    expect(drawer).toContain('min-h-14 shrink-0');
    expect(drawer).toContain("target?.closest('a[href]')");
    expect(dialogFocus).toContain("event.key === 'Escape'");
    expect(dialogFocus).toContain('window.requestAnimationFrame');
    expect(dialogFocus).toContain("restore.closest('[inert]')");
  });

  it('lets mobile users scroll navigation instead of sacrificing project/history space', () => {
    expect(sidebar).toContain("<div className='md:hidden'>{navigation}</div>");
    expect(sidebar).toContain("<div className='hidden md:block'>{navigation}</div>");
    expect(sidebar).toContain('overflow-y-auto overscroll-contain');
  });

  it('keeps project controls touch-safe and replaces browser-native prompts with inline actions', () => {
    expect(projects).toContain("className='flex h-11 w-11 items-center");
    expect(projects).toContain('opacity-100');
    expect(projects).toContain('md:opacity-0');
    expect(projects).toContain('addDescription');
    expect(projects).toContain('deletePendingId');
    expect(projects).toContain('renameDraft');
    expect(projects).not.toContain('window.prompt');
    expect(projects).not.toContain('window.confirm');
  });

  it('never stacks a standalone G button on top of public assistant/contact launchers', () => {
    expect(floating).toContain("body:has(.pc-public-contact-dock) .pc-gekta-floating");
    expect(floating).toContain("body:has(.pc-public-assistant-shortcut) .pc-gekta-floating");
    expect(floating).toContain("body:has(.p7-support-chat-button) .pc-gekta-floating");
    expect(floating).toContain("body:has([role='dialog'][aria-modal='true']) .pc-gekta-floating");
  });

  it('keeps the public mobile footer links inside the 44px touch contract without double bottom reserve', () => {
    expect(floating).toContain('.pc-v7-public-entry .pc-v6-footer nav a');
    expect(floating).toContain('min-height: 44px');
    expect(floating).toContain('display: inline-flex');
    expect(floating).toContain('padding-bottom: 0 !important');
  });
});

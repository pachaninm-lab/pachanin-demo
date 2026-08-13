import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const product = read('components/gekta/GektaProductShell.tsx');
const viewport = read('components/gekta/GektaViewportAuthority.tsx');
const composer = read('components/gekta/GektaComposer.tsx');
const attachments = read('components/gekta/GektaAttachments.tsx');
const empty = read('components/gekta/GektaEmptyState.tsx');
const drawer = read('components/gekta/GektaMobileDrawer.tsx');
const sidebar = read('components/gekta/GektaSidebar.tsx');
const projects = read('components/gekta/GektaProjectList.tsx');
const floating = read('components/gekta/GektaFloatingEntry.tsx');

describe('Gekta mobile UX red-team contracts', () => {
  it('follows the actually visible mobile viewport and measures the composer', () => {
    expect(product).toContain('<GektaViewportAuthority />');
    expect(viewport).toContain('window.visualViewport');
    expect(viewport).toContain('new ResizeObserver(syncComposer)');
    expect(viewport).toContain("--gekta-visual-viewport-height");
    expect(viewport).toContain("--gekta-composer-height");
    expect(product).toContain("[data-gekta-chat-workspace='true'].overflow-hidden");
  });

  it('keeps the scroll affordance clear of the variable-height composer', () => {
    expect(composer).toContain("data-gekta-composer-root='true'");
    expect(product).toContain("bottom: calc(var(--gekta-composer-height, 116px) + 12px) !important");
    expect(product).toContain('width: 44px');
    expect(product).toContain('height: 44px');
  });

  it('uses a compact iOS-safe composer with an unambiguous focus treatment', () => {
    expect(composer).toContain("rows={1}");
    expect(composer).toContain("text-[16px]");
    expect(composer).toContain("Задай вопрос по сельскому хозяйству");
    expect(composer).toContain('COMPACT_BOUNDARY');
    expect(attachments).toContain('focus-within:border-emerald-700');
    expect(attachments).toContain('shadow-[0_10px_30px');
  });

  it('reduces first-screen choice overload without removing examples', () => {
    expect(empty).toContain('starters.slice(0, 3)');
    expect(empty).toContain('...starters.slice(3)');
    expect(empty).toContain('...copy.extraStarters');
    expect(empty).toContain("min-h-[82px]");
  });

  it('keeps the drawer inside the visual viewport and gives it usable width', () => {
    expect(drawer).toContain("var(--gekta-visual-viewport-top, 0px)");
    expect(drawer).toContain("var(--gekta-visual-viewport-height, 100dvh)");
    expect(drawer).toContain("w-[min(92vw,360px)]");
    expect(drawer).toContain('min-h-14 shrink-0');
  });

  it('lets mobile users scroll navigation instead of sacrificing project/history space', () => {
    expect(sidebar).toContain("<div className='md:hidden'>{navigation}</div>");
    expect(sidebar).toContain("<div className='hidden md:block'>{navigation}</div>");
    expect(sidebar).toContain('overflow-y-auto overscroll-contain');
  });

  it('keeps project controls touch-safe and reveals destructive actions on touch', () => {
    expect(projects).toContain("className='flex h-11 w-11 items-center");
    expect(projects).toContain('opacity-100');
    expect(projects).toContain('md:opacity-0');
    expect(projects).toContain('addDescription');
  });

  it('never stacks a standalone G button on top of public assistant/contact launchers', () => {
    expect(floating).toContain("body:has(.pc-public-contact-dock) .pc-gekta-floating");
    expect(floating).toContain("body:has(.pc-public-assistant-shortcut) .pc-gekta-floating");
    expect(floating).toContain("body:has(.p7-support-chat-button) .pc-gekta-floating");
    expect(floating).toContain("body:has([role='dialog'][aria-modal='true']) .pc-gekta-floating");
  });

  it('keeps the public mobile footer links inside the 44px touch contract', () => {
    expect(floating).toContain('.pc-v7-public-entry .pc-v6-footer nav a');
    expect(floating).toContain('min-height: 44px');
    expect(floating).toContain('display: inline-flex');
  });
});

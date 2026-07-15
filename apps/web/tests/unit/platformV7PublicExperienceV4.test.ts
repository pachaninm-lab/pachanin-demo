import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = readFileSync('app/platform-v7/page.tsx', 'utf8');
const explorerPage = readFileSync('app/platform-v7/how-it-works/page.tsx', 'utf8');
const entryGate = readFileSync('components/platform-v7/PublicDealEntryGate.tsx', 'utf8');
const adapter = readFileSync('components/platform-v7/PublicDealExplorerV4.tsx', 'utf8');
const preview = readFileSync('components/platform-v7/PublicDealPreview.tsx', 'utf8');
const support = readFileSync('components/platform-v7/ChatSupportWidget.tsx', 'utf8');
const css = readFileSync('styles/platform-v7-public-product-experience-v5.css', 'utf8');
const copy = readFileSync('i18n/public-product-experience-v4.ts', 'utf8');
const exactHeadAcceptance = readFileSync('../../docs/platform-v7/autopilot/public-home-v5-exact-head.md', 'utf8');
const autopilotState = JSON.parse(readFileSync('../../docs/platform-v7/autopilot/autopilot-state.json', 'utf8')) as {
  approvedConcurrentScopes?: Record<string, string[]>;
};

describe('Public Product Experience V5 institutional hardening', () => {
  it('keeps the home task-first and progressively discloses secondary roles', () => {
    expect(root).toContain('allPrimaryPerspectives.slice(0, 5)');
    expect(root).toContain('pc-ppe-hero-progress-mobile');
    expect(root).toContain('ui.home.perspectives.more');
    expect(root).toContain('ui.home.final.primary');
    expect(root).toContain("id='deal-example'");
    expect(root).toContain("id='participants'");
    expect(root).toContain("id='reliability'");
  });

  it('uses service navigation and a verifiable trust layer', () => {
    expect(root).toContain('nav={nav}');
    expect(root).toContain('showMobileMenu');
    expect(root).toContain('ui.header.howItWorks');
    expect(root).toContain('ui.home.trust.cards.map');
    expect(root).toContain("href='/platform-v7/status'");
    expect(root).toContain("href='/platform-v7/privacy'");
    expect(root).toContain("href='/platform-v7/terms'");
    expect(root).toContain("href='/platform-v7/contact'");
    expect(explorerPage).toContain('ui.explorer.demoNotice');
  });

  it('makes the illustrative boundary explicit and removes fake-live identifiers', () => {
    expect(copy).toContain("primary: 'Разобрать демонстрационную сделку'");
    expect(copy).toContain("demoLabel: 'Демонстрационная сделка'");
    expect(copy).toContain('не содержит реальных сделок');
    expect(copy).toContain("primary: 'Review the demonstration deal'");
    expect(copy).toContain("primary: '查看演示交易'");
    expect(preview).toContain('preview.demoNote');
    expect(preview).toContain('preview.perspectiveValue');
    expect(preview).toContain('preview.settlementValue');
    expect(preview).not.toContain('DEAL-2408');
  });

  it('uses participant language and four public business areas', () => {
    expect(entryGate).toContain('ui.explorer.entryBadge');
    expect(entryGate).toContain('PublicDealExplorerV4');
    expect(entryGate).toContain('lens: option.lens');
    expect(entryGate).toContain("name: 'role_selected'");
    expect(adapter).toContain('publicBusinessAreas');
    expect(adapter).toContain("['execution', 'documents', 'money', 'risk']");
    expect(adapter).toContain('.pc-ppe-lens-list > button:nth-child(2)');
    expect(adapter).toContain('.pc-ppe-lens-list > button:nth-child(6)');
    expect(adapter).toContain('perspective: ui.explorer.roleLabel');
    expect(adapter).toContain('scenario: ui.explorer.scenarioLabel');
  });

  it('uses concrete event-to-evidence language instead of generic claims', () => {
    expect(root).toContain('pc-ppe-evidence-chain');
    expect(root).toContain('ui.home.proof.steps.map');
    expect(copy).toContain("{ label: 'Событие'");
    expect(copy).toContain("{ label: 'Основание'");
    expect(copy).toContain("{ label: 'Ограничение'");
    expect(root).not.toContain('pc-ppe-proof-list');
  });

  it('implements support as an accessible modal bottom sheet', () => {
    expect(support).toContain("role='dialog'");
    expect(support).toContain("aria-modal='true'");
    expect(support).toContain("event.key === 'Escape'");
    expect(support).toContain("event.key !== 'Tab'");
    expect(support).toContain("body.style.position = 'fixed'");
    expect(support).toContain('triggerRef.current?.focus()');
    expect(support).toContain("className='p7-support-chat-backdrop'");
    expect(support).not.toContain('syncSupportViewport');
    expect(support).not.toContain('Участник платформы');
    expect(css).toContain('right: max(14px');
    expect(css).not.toContain('right: -5px');
  });

  it('enforces mobile reflow, reduced motion and forced-colour resilience', () => {
    expect(css).toContain('@media (max-width: 380px)');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) !important');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('padding-bottom: max(88px');
    expect(css).toContain('max-height: calc(100dvh');
  });

  it('registers exact source-controlled scope and acceptance evidence', () => {
    const scope = autopilotState.approvedConcurrentScopes?.['agent/public-home-v5-institutional-10of10'];
    expect(scope).toBeDefined();
    expect(scope).toContain('apps/web/components/platform-v7/ChatSupportWidget.tsx');
    expect(scope).toContain('apps/web/styles/platform-v7-public-product-experience-v5.css');
    expect(scope).toContain('docs/platform-v7/autopilot/autopilot-state.json');
    expect(exactHeadAcceptance).toContain('320, 360, 375, 390 and 430 CSS px');
    expect(exactHeadAcceptance).toContain('controlled pilot / pre-integration');
    expect(exactHeadAcceptance).toContain('successful exact-head CI');
  });

  it('retains the canonical conversion funnel', () => {
    expect(adapter).toContain("return 'deal_preview_opened'");
    expect(adapter).toContain("return 'role_selected'");
    expect(adapter).toContain("return 'scenario_started'");
    expect(adapter).toContain("return 'scenario_completed'");
    expect(adapter).toContain("return 'organization_connect_started'");
    expect(root).toContain("eventName='deal_preview_opened'");
    expect(root).toContain("eventName='organization_connect_started'");
  });
});

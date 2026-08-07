import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, 'apps/web/components/platform-v7/PublicDealExplorerV4.tsx'),
  'utf8',
);
const mobileCss = fs.readFileSync(
  path.join(root, 'apps/web/styles/platform-v7-public-deal-explorer-mobile.css'),
  'utf8',
);

describe('platform-v7 public deal explorer mobile UX', () => {
  it('puts explicit role and scenario controls before the guided walkthrough', () => {
    expect(source).toContain("className='pc-ppe-v4-mobile-controls'");
    expect(source).toContain('TOUR_PERSPECTIVES.map');
    expect(source).toContain('TOUR_SCENARIOS.map');
    expect(source.indexOf("className='pc-ppe-v4-mobile-controls'"))
      .toBeLessThan(source.indexOf("className='pc-ppe-v4-guide-bar'"));
  });

  it('shows all three mobile scenarios together with usable touch targets', () => {
    expect(mobileCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(mobileCss).toContain('overflow: visible !important;');
    expect(mobileCss).toContain('min-height: 52px !important;');
    expect(mobileCss).toContain('white-space: normal !important;');
    expect(source).toContain(".pc-ppe-page .pc-ppe-explorer-toolbar {\n            display: none;");
  });

  it('keeps mobile role and scenario changes in browser history while guided playback replaces stage state', () => {
    expect(source).toContain("window.history[historyMode === 'push' ? 'pushState' : 'replaceState']");
    expect(source).toContain("pushPresentedState(next);\n    emitMobileSelection('perspective_selected'");
    expect(source).toContain("pushPresentedState(next);\n    emitMobileSelection('scenario_selected'");
    expect(source).toContain("replacePresentedState(first);\n    setGuideMode('playing');");
  });

  it('keeps the mobile hierarchy role/scenario -> walkthrough -> lenses -> deal -> role context', () => {
    expect(source).toContain("grid-template-areas:\n              'lenses'\n              'main'\n              'context';");
    expect(source).toContain('.pc-ppe-context-panel .pc-ppe-select-label');
    expect(source).toContain("className='pc-ppe-primary-button' onClick={startGuide}");
  });

  it('reduces mobile obstruction without removing the three contact actions', () => {
    expect(source).toContain('width: min(286px');
    expect(source).toContain('padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));');
    expect(source).toContain('body .pc-public-contact-dock-action strong');
    expect(mobileCss).toContain(".pc-ppe-v4-guide-bar[data-guide-mode='idle']");
    expect(mobileCss).toContain('margin-bottom: 62px !important;');
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const story = read('i18n/platform-v7-home-story-operating.ts');
const css = read('styles/platform-v7-international-home-fix.css');

describe('platform-v7 canonical Deal scrollytelling', () => {
  it('keeps all seven stages in one canonical Deal path', () => {
    expect(home).toContain("id='deal-path'");
    expect(home).toContain('story.process.phases.slice(0, 3)');
    expect(home).toContain('story.process.phases.slice(3)');

    for (const index of ['01', '02', '03', '04', '05', '06', '07']) {
      expect(story).toContain(`index: '${index}'`);
    }

    expect(css).toContain("#deal-path #phases-more-toggle");
    expect(css).toContain("#deal-path label[for='phases-more-toggle']");
    expect(css).toContain("#deal-path #phases-more-cards");
    expect(css).toContain('display: contents !important;');
  });

  it('uses sticky pacing only on desktop and preserves linear mobile reading', () => {
    expect(css).toContain('@media (min-width: 1024px)');
    expect(css).toContain('position: sticky !important;');
    expect(css).toContain("top: calc(var(--pc-public-header-total-height, 64px) + 24px);");
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('#deal-path article {\n    position: relative !important;');
    expect(css).toContain('top: auto !important;');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none !important;');
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicHeroMedia } from '@/components/platform-v7/PublicHeroMedia';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('public hero critical-path image', () => {
  it('embeds exactly the approved SVG bytes, not a replacement visual', () => {
    const markup = renderToStaticMarkup(createElement(PublicHeroMedia));
    const source = markup.match(/src="([^"]+)"/)?.[1];
    expect(source).toBeDefined();
    const prefix = 'data:image/svg+xml,';
    expect(source!.startsWith(prefix)).toBe(true);
    expect(decodeURIComponent(source!.slice(prefix.length))).toBe(
      read('public/platform-v7/hero-agro-infrastructure.svg'),
    );
    expect(markup).not.toContain('<link');
    expect(markup).not.toContain('<script');
  });

  it('keeps the existing image, crop hook, dimensions and eager rendering contract', () => {
    const markup = renderToStaticMarkup(createElement(PublicHeroMedia));
    expect(markup.match(/<img\b/g)).toHaveLength(1);
    for (const attribute of [
      'class="pc-cp-hero-media"', 'alt=""', 'width="400"', 'height="320"',
      'loading="eager"', 'decoding="sync"', 'fetchpriority="high"', 'aria-hidden="true"',
    ]) expect(markup.toLowerCase()).toContain(attribute);
  });

  it('uses the inline server image without retaining an unused external preload', () => {
    const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
    expect(home).toContain("import { PublicHeroMedia } from './PublicHeroMedia'");
    expect(home).toContain('<PublicHeroMedia />');
    expect(home).not.toContain("src='/platform-v7/hero-agro-infrastructure.svg'");
    expect(read('app/layout.tsx')).not.toContain("href='/platform-v7/hero-agro-infrastructure.svg'");
    const component = read('components/platform-v7/PublicHeroMedia.tsx');
    expect(component).not.toContain("'use client'");
    expect(component).not.toMatch(/fetch\(|readFile|useEffect|setTimeout|requestIdleCallback/);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const absolute = (file: string) => path.join(process.cwd(), file);
const read = (file: string) => fs.readFileSync(absolute(file), 'utf8');

const landing = read('apps/web/app/platform-v7/page.tsx');
const typography = read('apps/web/styles/platform-v7-public-typography.css');

describe('platform-v7 public homepage typography', () => {
  it('loads the dedicated typography layer after the visual landing layers', () => {
    const worldClassImport = "import '@/styles/platform-v7-public-world-class.css';";
    const typographyImport = "import '@/styles/platform-v7-public-typography.css';";

    expect(landing).toContain(worldClassImport);
    expect(landing).toContain(typographyImport);
    expect(landing.indexOf(typographyImport)).toBeGreaterThan(landing.indexOf(worldClassImport));
  });

  it('covers the full homepage hierarchy with stable local font stacks', () => {
    expect(typography).toContain('--pc-entry-font-body');
    expect(typography).toContain('--pc-entry-font-display');
    expect(typography).toContain('.pc-v7-public-entry .pc-site-header');
    expect(typography).toContain('.pc-v7-public-entry .entry-hero h1');
    expect(typography).toContain('.pc-v7-public-entry .entry-section-head h2');
    expect(typography).toContain('.pc-v7-public-entry .entry-intelligence-main h2');
    expect(typography).toContain('.pc-v7-public-entry .entry-footer nav a');
    expect(typography).toContain("html:is([lang='zh-CN'], [data-p7-language='zh'])");
  });

  it('does not introduce remote font dependencies or synthetic ultra-heavy weights', () => {
    expect(typography).not.toMatch(/@import\s+url/i);
    expect(typography).not.toMatch(/https?:\/\//i);
    expect(typography).not.toContain('font-weight: 950');
    expect(landing).not.toContain('fontWeight: 950');
  });

  it('keeps mobile typography in the dedicated stylesheet instead of inline patches', () => {
    expect(typography).toContain('@media (max-width: 720px)');
    expect(typography).toContain('@media (max-width: 380px)');
    expect(landing).not.toContain('font-size:clamp(42px,11.4vw,50px)');
    expect(landing).not.toContain('font-size:clamp(38px,10.7vw,44px)');
  });
});

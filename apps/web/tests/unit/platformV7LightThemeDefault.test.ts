import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const themeSync = () => readFileSync(path.join(process.cwd(), 'apps/web/components/v7r/PlatformThemeSync.tsx'), 'utf8');

describe('platform-v7 theme default', () => {
  it('uses light theme when there is no explicit dark preference', () => {
    const source = themeSync();

    expect(source).toContain("return value === 'dark' ? 'dark' : 'light';");
    expect(source).toContain("return 'light';");
    expect(source).not.toContain("return value === 'light' ? 'light' : 'dark';");
    expect(source).not.toContain("return 'dark';\n  }\n}");
  });

  it('keeps dark available only as an explicit theme value', () => {
    const source = themeSync();

    expect(source).toContain("type PlatformV7Theme = 'light' | 'dark';");
    expect(source).toContain("theme === 'dark' ? '#06110f' : '#f8fafc'");
    expect(source).toContain("document.documentElement.setAttribute('data-theme', theme)");
  });
});

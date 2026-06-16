import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const runtimeRoots = [
  'apps/web/app/platform-v7',
  'apps/web/components/platform-v7',
  'apps/web/components/v7r',
] as const;

const allowedGlyphs = new Set([
  'bag',
  'truck',
  'shield-check',
  'alert',
  'doc',
  'scale',
  'coins',
  'flask',
  'route',
  'camera',
  'clock',
  'users',
  'gauge',
]);

function listRuntimeFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listRuntimeFiles(full);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [full];
  });
}

describe('platform-v7 premium glyph usage guard', () => {
  it('keeps PremiumCtaButton/PremiumStatCard glyph props inside the supported glyph union', () => {
    const files = runtimeRoots.flatMap((root) => listRuntimeFiles(path.join(process.cwd(), root)));
    const invalid = files.flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const matches = Array.from(source.matchAll(/glyph=['"]([^'"]+)['"]/g));
      return matches
        .map((match) => match[1])
        .filter((glyph) => !allowedGlyphs.has(glyph))
        .map((glyph) => `${path.relative(process.cwd(), file)}: ${glyph}`);
    });

    expect(invalid).toEqual([]);
  });
});

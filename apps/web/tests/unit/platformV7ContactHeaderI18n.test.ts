import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'apps/web/components/platform-v7/ContactFixedHeader.tsx'),
  'utf8',
);

describe('platform-v7 contact header i18n accessibility', () => {
  it('renders the brand home accessible name from locale-native copy', () => {
    expect(source).toContain("brandHome: 'Прозрачная Цена — на главную'");
    expect(source).toContain("brandHome: 'Transparent Price — home'");
    expect(source).toContain("brandHome: '透明价格 — 返回首页'");
    expect(source).toContain('brandHomeLabel={copy.brandHome}');
  });
});

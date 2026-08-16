import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const runtimeBoundary = read('apps/web/components/platform-v7/HydrationSafeChatSupport.tsx');
const cjk = read('apps/web/styles/platform-v7-public-cjk-runtime.css');
const landing = read('apps/web/app/platform-v7/page.tsx');

describe('Platform V7 public CJK typography contract', () => {
  it('mounts the narrow CJK runtime layer on the shared public boundary', () => {
    expect(runtimeBoundary).toContain("import '@/styles/platform-v7-public-cjk-runtime.css';");
  });

  it('provides the exact local CJK stack required by production acceptance', () => {
    expect(cjk).toContain('"PingFang SC"');
    expect(cjk).toContain('"Noto Sans SC"');
    expect(cjk).toContain('"Microsoft YaHei"');
    expect(cjk).toContain('html:lang(zh) .pc-v7-public-entry');
    expect(cjk).toContain('font-family: var(--pc-entry-font-body)');
    expect(cjk).toContain('letter-spacing: 0');
    expect(cjk).toContain('line-height: 1.14');
  });

  it('does not reintroduce the legacy render-blocking typography bundle or remote fonts', () => {
    expect(landing).not.toContain("import '@/styles/platform-v7-public-typography.css'");
    expect(runtimeBoundary).not.toContain("platform-v7-public-typography.css");
    expect(cjk).not.toMatch(/@import\s+url/iu);
    expect(cjk).not.toMatch(/https?:\/\//iu);
  });
});

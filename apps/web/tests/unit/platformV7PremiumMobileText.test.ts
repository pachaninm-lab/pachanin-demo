import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 premium mobile text density', () => {
  it('keeps premium header compact on mobile', () => {
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');

    expect(css).toContain('@container (max-width: 640px)');
    expect(css).toContain('.topChrome {');
    expect(css).toContain('min-height: 52px;');
    expect(css).toContain('.mainNav a { display: none; }');
    expect(css).toContain('max-width: 43vw;');
    expect(css).toContain('text-overflow: ellipsis;');
    expect(css).toContain('max-width: 50vw;');
    expect(css).toContain('min-height: 40px;');
  });

  it('keeps first screen compact after role focus labels were added', () => {
    const css = read('apps/web/components/platform-v7/premium/ExecutionUi.module.css');
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');

    expect(ui).toContain('{roleLabels[role]} · {roleFocusLabels[role]} · {balanceLabel}');
    expect(css).toContain('.statusTitle p { -webkit-line-clamp: 1; font-size: 13px; }');
    expect(css).toContain('.eyebrow { font-size: 10px; line-height: 15px; letter-spacing: 0.1em; }');
    expect(css).toContain('.fact:nth-of-type(n + 4) { display: none; }');
    expect(css).toContain('@media (max-width: 374px)');
    expect(css).toContain('.fact:nth-of-type(n + 3) { display: none; }');
  });
});

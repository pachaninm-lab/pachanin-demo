import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('platform-v7 buyer matches compatibility route', () => {
  it('redirects to the governed RFQ authority without invented match facts', () => {
    const source = read('apps/web/app/platform-v7/buyer/matches/page.tsx');
    expect(source).toContain("import { redirect } from 'next/navigation'");
    expect(source).toContain("redirect('/platform-v7/buyer/rfq')");
    expect(source).not.toContain('GrainWorkflowPage');
    expect(source).not.toContain('88%');
    expect(source).not.toContain('рассчитана');
    expect(source).not.toContain('style=');
  });
});

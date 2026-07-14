import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const aliases = [
  ['apps/web/app/platform-v7/seller/batches/page.tsx', '/platform-v7/fgis-access'],
  ['apps/web/app/platform-v7/seller/batches/new/page.tsx', '/platform-v7/fgis-access'],
  ['apps/web/app/platform-v7/seller/fgis-parties/page.tsx', '/platform-v7/fgis-access'],
  ['apps/web/app/platform-v7/seller/quick-sale/page.tsx', '/platform-v7/auction/import'],
] as const;

describe('platform-v7 seller inventory compatibility routes', () => {
  it.each(aliases)('routes %s to the governed authority %s', (file, target) => {
    const source = read(file);
    expect(source).toContain("import { redirect } from 'next/navigation'");
    expect(source).toContain(`redirect('${target}')`);
    expect(source).not.toContain('GrainWorkflowPage');
    expect(source).not.toContain('GrainExecutionPage');
    expect(source).not.toContain('SANDBOX_FGIS_PARTIES');
    expect(source).not.toContain('SANDBOX_LOT_PASSPORTS');
    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('72–100%');
    expect(source).not.toContain('style=');
  });

  it('does not let quick sale bypass auction import and admission', () => {
    const source = read('apps/web/app/platform-v7/seller/quick-sale/page.tsx');
    expect(source).toContain("redirect('/platform-v7/auction/import')");
    expect(source).not.toContain("mode='quick-sale'");
  });
});

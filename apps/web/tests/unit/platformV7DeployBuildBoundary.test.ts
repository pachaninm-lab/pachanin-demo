import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const tsconfigPath = path.join(process.cwd(), 'apps/web/tsconfig.json');
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8')) as { exclude?: string[] };

describe('platform-v7 deploy build boundary', () => {
  it('keeps unit and e2e tests out of the Next production build tsconfig', () => {
    const exclude = tsconfig.exclude ?? [];

    expect(exclude).toContain('tests');
    expect(exclude).toContain('**/*.test.ts');
    expect(exclude).toContain('**/*.test.tsx');
    expect(exclude).toContain('**/*.spec.ts');
    expect(exclude).toContain('**/*.spec.tsx');
  });
});

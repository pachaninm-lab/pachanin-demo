import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const globals = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

describe('Platform V7 public trust block removal', () => {
  it('removes the maturity section and its navigation entry from the rendered homepage', () => {
    expect(globals).toContain('.pc-v7-public-entry #maturity');
    expect(globals).toContain('.pc-v7-public-entry .pc-site-header a[href="#maturity"]');
    expect(globals).toContain('display: none !important');
  });
});

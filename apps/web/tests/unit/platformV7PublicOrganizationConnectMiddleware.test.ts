import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const middleware = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8');

describe('public organization connect middleware authority', () => {
  it('keeps the public same-origin intake endpoint outside cabinet authentication', () => {
    expect(middleware).toContain("'/api/platform-v7/organization-connect'");
  });
});

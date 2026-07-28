import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const home = readFileSync(join(process.cwd(), 'components/platform-v7/PlatformV7StrategicHome.tsx'), 'utf8');

describe('Platform V7 public trust block removal', () => {
  it('physically removes the rejected maturity section and its navigation entry', () => {
    expect(home).not.toContain("href='#maturity'");
    expect(home).not.toContain("id='maturity'");
    expect(home).not.toContain("id='integrations'");
    expect(home).not.toContain('story.nav.trust');
    expect(home).not.toContain('story.trust.');
    expect(home).not.toContain('trustIcons');
  });
});

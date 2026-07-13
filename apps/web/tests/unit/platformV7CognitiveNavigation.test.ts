import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

describe('cognitive role navigation', () => {
  it('removes duplicate targets and the vague More item', () => {
    expect(controller).toContain('const seen = new Set<string>()');
    expect(controller).toContain("item.label === 'Ещё'");
    expect(controller).toContain('seen.has(key)');
  });

  it('keeps only four primary actions and hides secondary routes progressively', () => {
    expect(controller).toContain('.slice(0, 4)');
    expect(controller).toContain('<summary>Все разделы</summary>');
    expect(controller).toContain('Основное');
  });
});

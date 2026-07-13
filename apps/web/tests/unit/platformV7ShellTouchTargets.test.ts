import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.module.css'), 'utf8');

describe('platform-v7 shell touch targets', () => {
  it('keeps primary navigation controls large enough for field use', () => {
    expect(styles).toContain('min-height: 56px');
    expect(styles).toContain('min-height: 58px');
    expect(styles).toContain('@media (max-width: 640px)');
  });
});

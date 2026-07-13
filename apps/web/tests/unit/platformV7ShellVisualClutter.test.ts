import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.module.css'), 'utf8');

describe('platform-v7 shell visual clutter', () => {
  it('hides persistent technical status rows and the repeated integration warning', () => {
    expect(styles).toContain('.pc-v4-meta');
    expect(styles).toContain('.pc-v4-pilot-note');
    expect(styles).toContain('display: none !important');
  });
});

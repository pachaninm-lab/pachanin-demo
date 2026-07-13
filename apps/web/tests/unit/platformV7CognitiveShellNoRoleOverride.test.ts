import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

describe('cognitive shell role authority', () => {
  it('does not read an active role from session storage', () => {
    expect(controller).not.toContain('sessionStorage');
    expect(controller).not.toContain('ACTIVE_ROLE_KEY');
  });
});

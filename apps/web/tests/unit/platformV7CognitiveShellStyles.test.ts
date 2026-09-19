import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');
const styles = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.module.css'), 'utf8');

describe('cognitive shell styles', () => {
  it('uses a CSS module rather than adding another inline style layer', () => {
    expect(controller).toContain("import styles from './PlatformV7ShellUxController.module.css'");
    expect(controller).not.toContain('<style>');
    expect(controller).not.toContain('style={{');
    expect(styles).toContain('.roleDock');
  });
});

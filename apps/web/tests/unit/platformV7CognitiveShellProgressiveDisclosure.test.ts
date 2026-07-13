import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

describe('role navigation progressive disclosure', () => {
  it('keeps primary navigation visible and secondary routes closed by default', () => {
    expect(controller).toContain('<details className={styles.moreSections}>');
    expect(controller).not.toContain('<details open');
  });
});

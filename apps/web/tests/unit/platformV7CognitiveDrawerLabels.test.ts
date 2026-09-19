import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

describe('cognitive drawer labels', () => {
  it('uses plain labels for primary and secondary navigation', () => {
    expect(controller).toContain('Основное');
    expect(controller).toContain('Все разделы');
    expect(controller).not.toContain('Полное меню функций роли');
  });
});

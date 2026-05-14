import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 mobile header role switcher', () => {
  it('keeps the portal role switcher compact enough for the mobile header', () => {
    const source = read('apps/web/components/platform-v7/RoleHeaderSwitcher.tsx');

    expect(source).toContain('function roleControlStyle()');
    expect(source).toContain('minWidth: 132');
    expect(source).toContain('maxWidth: 168');
    expect(source).toContain("flex: '0 1 168px'");
    expect(source).not.toContain('minWidth: 170');
    expect(source).not.toContain('maxWidth: 210');
  });

  it('does not render the caption as visible mobile header text', () => {
    const source = read('apps/web/components/platform-v7/RoleHeaderSwitcher.tsx');

    expect(source).toContain('function roleCaptionStyle()');
    expect(source).toContain("display: 'none'");
    expect(source).toContain('Выбрать');
    expect(source).toContain("aria-label={`Текущая роль: ${ROLE_LABELS[routeRole]}. Выбрать другую роль`}");
  });

  it('keeps the select width elastic instead of fixed wide', () => {
    const source = read('apps/web/components/platform-v7/RoleHeaderSwitcher.tsx');

    expect(source).toContain('function roleSelectStyle()');
    expect(source).toContain('minWidth: 0');
    expect(source).toContain("width: '100%'");
    expect(source).toContain('maxWidth: 132');
    expect(source).not.toContain('minWidth: 112');
    expect(source).not.toContain('maxWidth: 138');
  });
});

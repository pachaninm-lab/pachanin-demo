import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const component = readFileSync(resolve(__dirname, '../../components/platform-v7/ScopedShellGuard.tsx'), 'utf8');
const css = readFileSync(resolve(__dirname, '../../components/platform-v7/ScopedShellGuard.module.css'), 'utf8');

describe('ScopedShellGuard mobile header policy', () => {
  it('uses declarative policy metadata and a scoped module instead of runtime CSS', () => {
    expect(component).toContain('shell.dataset.shellPolicy = shellPolicy');
    expect(component).toContain("import styles from './ScopedShellGuard.module.css'");
    expect(component).not.toContain('dangerouslySetInnerHTML');
    expect(component).not.toContain('<style');
  });

  it('keeps field and role-scoped search hidden with responsive token-safe rules', () => {
    expect(css).toContain("[data-shell-policy='field']");
    expect(css).toContain("[data-shell-policy='role-scoped']");
    expect(css).toContain("button[aria-label='Открыть поиск']");
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('--shell-header-offset: 68px');
    expect(css).not.toContain('!important');
  });
});

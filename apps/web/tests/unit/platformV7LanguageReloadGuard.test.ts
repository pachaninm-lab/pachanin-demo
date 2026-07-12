import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 language switch reload', () => {
  it('uses an explicit lang query or the server-rendered document language, not stale storage', () => {
    const source = read('apps/web/components/platform-v7/HeaderLanguageSwitch.tsx');

    expect(source).toContain('readLanguageFromUrl');
    expect(source).toContain('readLanguageFromDocument');
    expect(source).toContain('readLanguageFromUrl() ?? readLanguageFromDocument()');
    expect(source).not.toContain('readLocaleCookie');
    expect(source).not.toContain('readStoredLanguage');
  });

  it('reloads the current route after changing language so server translations rerender', () => {
    const source = read('apps/web/components/platform-v7/HeaderLanguageSwitch.tsx');

    expect(source).toContain('reloadCurrentRouteForLanguage');
    expect(source).toContain("url.searchParams.set('lang', language)");
    expect(source).toContain("url.searchParams.set('l10n', String(Date.now()))");
    expect(source).toContain('window.location.replace(url.toString())');
    expect(source).toContain('writeStoredLanguage(nextCode)');
  });
});

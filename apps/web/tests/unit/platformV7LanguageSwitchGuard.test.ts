import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 language switch runtime', () => {
  it('uses the unified platform dictionary set from the header switch', () => {
    const source = read('apps/web/components/platform-v7/HeaderLanguageSwitch.tsx');

    expect(source).toContain('buildDictionaries');
    expect(source).toContain('readCachedDictionaryState');
    expect(source).toContain('fetchRemoteDictionaryState');
    expect(source).toContain("SUPPORTED_LANGUAGE_CODES: readonly LanguageCode[] = ['ru', 'en', 'zh']");
    expect(source).not.toContain('REGISTER_EN');
    expect(source).not.toContain('REGISTER_ZH');
  });

  it('blocks browser auto-translation before the runtime takes over', () => {
    const head = read('apps/web/app/platform-v7/head.tsx');
    const switcher = read('apps/web/components/platform-v7/HeaderLanguageSwitch.tsx');

    expect(head).toContain('name="google" content="notranslate"');
    expect(switcher).toContain('lockBrowserAutoTranslate');
    expect(switcher).toContain("setAttribute('translate', 'no')");
    expect(switcher).toContain("classList.add('notranslate')");
  });
});

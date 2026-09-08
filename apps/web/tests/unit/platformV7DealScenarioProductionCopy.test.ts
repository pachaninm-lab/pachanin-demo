import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 deal scenario production copy', () => {
  it('keeps the compatibility route positioned as an execution circuit', () => {
    const source = read('apps/web/app/platform-v7/demo/DemoCleanClient.tsx');

    expect(source).toContain('Сценарий исполнения показывает путь после цены');
    expect(source).toContain('Внешние интеграции подключаются по договору и ключам доступа');
    expect(source).toContain('DL-EXEC-001');
    expect(source).toContain('The execution scenario shows the path after price agreement');
    expect(source).toContain('外部集成按合同和访问密钥接入');
    expect(source).toContain("volume: '240 т'");
    expect(source).toContain("volume: '240 t'");
    expect(source).toContain("volume: '240 吨'");
    expect(source).toContain('<p>{t.volume}</p>');
    expect(source).not.toContain('<p>240 т</p>');
  });

  it('keeps the Deal execution route source-native in RU EN and ZH', () => {
    const source = read('apps/web/app/platform-v7/deal-flow/page.tsx');
    const enStart = source.indexOf('  en: {');
    const zhStart = source.indexOf('  zh: {');
    const end = source.indexOf('} as const;', zhStart);

    expect(enStart).toBeGreaterThan(0);
    expect(zhStart).toBeGreaterThan(enStart);
    expect(end).toBeGreaterThan(zhStart);
    expect(source).toContain("import { getLocale } from 'next-intl/server'");
    expect(source).toContain("data-p7-no-translate='true'");
    expect(source).toContain("pageNav: 'Deal execution page navigation'");
    expect(source).toContain("pageActions: 'Page actions'");
    expect(source).toContain("back: 'Back to home'");
    expect(source).toContain("access: 'acceptance, weight, lot state and related documents'");
    expect(source).toContain("access: 'confirmed settlement grounds'");
    expect(source).toContain("const href = (pathname: string) => `${pathname}?lang=${lang}`;");
    expect(source).toContain("href={href('/platform-v7/register')}");
    expect(source).toContain("href={href('/platform-v7/contact')}");
    expect(source).toContain("bankAction: 'Connect a bank to the platform'");
    expect(source).toContain("bankAction: '接入银行机构'");
    expect(source).toContain("<Link href={href('/platform-v7/register')}>{t.bankAction}</Link>");
    expect(source).not.toContain("/platform-v7/bank");
    expect(source).not.toContain("protectedHref");
    expect(source.slice(enStart, zhStart)).not.toMatch(/[А-Яа-яЁё]/u);
    expect(source.slice(zhStart, end)).not.toMatch(/[А-Яа-яЁё]/u);
  });

});

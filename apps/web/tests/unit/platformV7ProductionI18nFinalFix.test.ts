import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDictionaries,
  translateValue,
} from '@/lib/platform-v7/i18n/translation-runtime';

const dictionaries = buildDictionaries(null);
const publicEntryPage = fs.readFileSync(
  path.join(process.cwd(), 'apps/web/app/pc-public-entry/platform-v7/page.tsx'),
  'utf8',
);

describe('Platform V7 final production i18n fixes', () => {
  it('translates every Russian short month token in structured date/time values', () => {
    const months = [
      ['янв.', 'Jan'],
      ['февр.', 'Feb'],
      ['мар.', 'Mar'],
      ['апр.', 'Apr'],
      ['мая', 'May'],
      ['июн.', 'Jun'],
      ['июл.', 'Jul'],
      ['авг.', 'Aug'],
      ['сент.', 'Sep'],
      ['окт.', 'Oct'],
      ['нояб.', 'Nov'],
      ['дек.', 'Dec'],
    ] as const;

    for (const [ru, en] of months) {
      expect(translateValue(`12 ${ru}, 09:01`, 'en', dictionaries)).toBe(`12 ${en}, 09:01`);
    }
    expect(translateValue('12 мар., 09:01', 'zh', dictionaries)).toBe('12 3月, 09:01');
  });

  it('makes public metadata locale-authoritative instead of shipping a static Russian title', () => {
    expect(publicEntryPage).toContain("import { getLocale } from 'next-intl/server'");
    expect(publicEntryPage).toContain('export async function generateMetadata()');
    expect(publicEntryPage).not.toContain('export const metadata: Metadata');
    expect(publicEntryPage).toContain("title: 'Transparent Price — digital infrastructure for crop-trade execution'");
    expect(publicEntryPage).toContain("title: '透明价格 — 种植业交易执行数字基础设施'");
    expect(publicEntryPage).toContain("openGraphLocale: 'en_US'");
    expect(publicEntryPage).toContain("openGraphLocale: 'zh_CN'");
  });
});

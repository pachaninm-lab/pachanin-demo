import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const header = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
const contact = read('apps/web/components/platform-v7/ContactFixedHeader.tsx');
const roleCss = read('apps/web/components/platform-v7/PublicDealRoleScenario.module.css');

describe('platform-v7 public UX phase 1', () => {
  it('keeps one canonical 64px public header authority without wrapping on phones', () => {
    expect(header).toContain("data-public-site-header='canonical'");
    expect(header).toContain('flex-wrap: nowrap !important;');
    expect(header).toContain('height: 64px !important;');
    expect(header).toContain('--entry-public-header-base: 64px !important;');
    expect(header).toContain(".pc-site-header[data-public-site-header='canonical'] .pc-site-brand-text");
    expect(header).toContain('display: none !important;');
  });

  it('keeps locale-native contact brand-home accessibility copy in the shared header', () => {
    expect(contact).toContain("brandHome: 'Прозрачная Цена — на главную'");
    expect(contact).toContain("brandHome: 'Transparent Price — home'");
    expect(contact).toContain("brandHome: '透明价格 — 返回首页'");
    expect(contact).toContain('brandHomeLabel={copy.brandHome}');
    expect(contact).not.toContain(':has(.p7-contact-register)');
  });

  it('uses readable single-column role detail cards at 390 and 430 mobile widths', () => {
    expect(roleCss).toContain('@media (max-width: 430px)');
    expect(roleCss).toMatch(/\.actionGrid,\s*\n\s*\.contextRow \{ grid-template-columns: 1fr; \}/);
    expect(roleCss).toContain('overflow-wrap: normal; word-break: normal;');
  });
});

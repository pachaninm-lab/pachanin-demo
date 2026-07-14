import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const pages = {
  help: read('apps/web/app/platform-v7/help/page.tsx'),
  pricing: read('apps/web/app/platform-v7/pricing/page.tsx'),
  roadmap: read('apps/web/app/platform-v7/roadmap/page.tsx'),
};
const css = read('apps/web/app/platform-v7/_styles/supporting-v8.module.css');
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 public supporting surfaces v8', () => {
  it('uses Design System v8 and one token-only responsive CSS module', () => {
    for (const page of Object.values(pages)) {
      expect(page).toContain('@pc/design-system-v8');
      expect(page).toContain("supporting-v8.module.css");
      expect(page).not.toMatch(forbiddenPresentation);
      expect(page).toContain("type Locale = 'ru' | 'en' | 'zh'");
    }
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\brgba?\s*\(/i);
    expect(css).not.toContain('!important');
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('@media (forced-colors: active)');
  });

  it('removes fabricated fixed pricing and take-rate claims', () => {
    expect(pages.pricing).not.toContain('0 ₽');
    expect(pages.pricing).not.toContain('0.7%');
    expect(pages.pricing).not.toContain('29 400 ₽');
    expect(pages.pricing).not.toContain('700 000 ₽');
    expect(pages.pricing).toContain('Публичные тарифы и take rate пока не утверждены');
    expect(pages.pricing).toContain('Public tariffs and a take rate are not approved');
    expect(pages.pricing).toContain('公开套餐和 take rate 尚未批准');
  });

  it('removes dated delivery promises and separates maturity layers', () => {
    expect(pages.roadmap).not.toContain('Q2 2026');
    expect(pages.roadmap).not.toContain('Q3 2026');
    expect(pages.roadmap).not.toContain('bank mock');
    expect(pages.roadmap).toContain('Целевая архитектура');
    expect(pages.roadmap).toContain('Controlled-launch readiness');
    expect(pages.roadmap).toContain('外部集成');
    expect(pages.roadmap).toContain('Production');
  });

  it('keeps help inside the canonical Deal and server authority boundary', () => {
    expect(pages.help).toContain('канонический контур Сделки');
    expect(pages.help).toContain('canonical Deal circuit');
    expect(pages.help).toContain('规范交易闭环');
    expect(pages.help).not.toContain('Cmd/Ctrl+K');
    expect(pages.help).not.toContain('автоматической выплаты');
  });
});

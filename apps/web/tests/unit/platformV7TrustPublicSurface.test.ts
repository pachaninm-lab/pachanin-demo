import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const page = fs.readFileSync(path.join(root, 'apps/web/app/platform-v7/trust/page.tsx'), 'utf8');
const supportRuntime = fs.readFileSync(path.join(root, 'apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx'), 'utf8');

describe('Platform V7 public Trust surface', () => {
  it('explains trust through Deal architecture rather than maturity or provider-status presentation', () => {
    expect(page).toContain('Полномочия принадлежат участнику, а не экрану');
    expect(page).toContain('У Сделки одна связная история');
    expect(page).toContain('Внешние системы остаются отдельными контурами');
    expect(page).toContain('Гекта помогает понять, но не становится стороной Сделки');

    expect(page).not.toContain('verifiedLabel');
    expect(page).not.toContain('verifiedText');
    expect(page).not.toContain('неподтверждённый статус');
    expect(page).not.toContain('confirmed production exchange');
    expect(page).not.toContain('external availability');
    expect(page).not.toContain('live bank');
  });

  it('keeps the same trust model in RU EN ZH', () => {
    expect(page).toContain('Публичный выбор роли не назначает права.');
    expect(page).toContain('Choosing a role on a public page does not grant permissions.');
    expect(page).toContain('在公开页面选择角色不会授予权限。');

    expect(page).toContain('У Гекты нет самостоятельного права изменить Сделку, перевести деньги или принять критическое решение.');
    expect(page).toContain('Gekta has no independent authority to change a Deal, move money or make a critical decision.');
    expect(page).toContain('Gekta 没有独立权限自行修改交易、转移资金或作出关键决定。');
  });

  it('uses registration as the primary conversion path without granting authority from the public page', () => {
    expect(page).toContain("href={`/platform-v7/register${lang}`} className='pc-trust-primary'");
    expect(page).toContain("className='pc-v6-header-cta pc-trust-header-register'");
    expect(page).toContain('публичные примеры на этой странице прав не назначают');
    expect(page).toContain('public examples on this page do not grant permissions');
    expect(page).toContain('本页公开示例不会授予权限');
  });

  it('keeps the canonical public header, locale continuity and linked public routes', () => {
    expect(page).toContain('<PublicSiteHeader');
    expect(page).toContain('localeControl={<PublicLocaleLink />}');
    expect(page).toContain('/platform-v7/how-it-works${lang}');
    expect(page).toContain('/platform-v7/about${lang}');
    expect(page).toContain('/platform-v7/contact${lang}');
    expect(page).toContain('/platform-v7/privacy${lang}');
  });

  it('keeps Trust on the public assistant/support authority instead of the private-workspace runtime', () => {
    expect(supportRuntime).toContain("'/platform-v7/trust',");
    expect(supportRuntime).toContain('{renderDock ? <PublicContactDock /> : null}');
    expect(supportRuntime).toContain("<AiAssistantPanel variant='floating' />");
  });

  it('keeps Login reachable on 320px while preserving the registration CTA in the header', () => {
    expect(page).toContain("className='pc-trust-nav-login'");
    expect(page).toContain("className='entry-login pc-trust-header-login'");
    expect(page).toContain("registerShort: 'Регистрация'");
    expect(page).toContain("registerShort: 'Register'");
    expect(page).toContain("registerShort: '注册'");
    expect(page).toContain("@media(max-width:430px){.pc-trust-page .pc-site-header[data-public-site-header='canonical'] .pc-trust-header-login{display:none!important}");
    expect(page).toContain('.pc-site-mobile-nav .pc-trust-nav-login{display:flex}');
  });

  it('preserves the established Trust acceptance anchors without restoring the old document-like page', () => {
    expect(page).toContain("className='pc-trust-grid pc-trust-domains'");
    expect(page).toContain("const CARD_IDS = ['controls', 'history', 'external', 'ai'] as const;");
    expect(page).toContain('Критические решения подтверждает уполномоченный участник.');
    expect(page).toContain('Платформа не заявляет без доказательств');
  });

  it('keeps mobile, reduced-motion and forced-colors behavior explicit', () => {
    expect(page).toContain('@media(max-width:600px)');
    expect(page).toContain('@media(prefers-reduced-motion:reduce)');
    expect(page).toContain('@media(forced-colors:active)');
    expect(page).toContain('.pc-trust-path{grid-template-columns:1fr}');
    expect(page).toContain('.pc-trust-page .pc-site-brand{min-height:44px}');
    expect(page).toContain('min-height:48px');
  });
});

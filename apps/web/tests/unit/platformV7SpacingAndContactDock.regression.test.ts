import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('platform-v7 spacing and contact dock regression', () => {
  const root = resolve(process.cwd());
  const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

  it('mounts Gekta-only communication on the canonical landing and full support elsewhere', () => {
    const layout = read('apps/web/app/pc-public-entry/platform-v7/layout.tsx');

    expect(layout).toContain("import('@/components/platform-v7/PublicContactDock')");
    expect(layout).toContain("import('@/components/platform-v7/HydrationSafeChatSupport')");
    expect(layout).toContain('const canonicalLanding = isCanonicalLanding(pathname);');
    expect(layout).not.toContain('if (isCanonicalLanding(pathname)) return children;');
    expect(layout).toContain("<PublicContactDock assistantContext='public' publicMode={canonicalLanding ? 'gekta' : 'full'} />");
    expect(layout).toContain('<HydrationSafeChatSupport renderDock={false} legacyPublicPolish={!canonicalLanding} />');
  });

  it('does not let the canonical spacing layer hide or reposition the contact dock', () => {
    const spacing = read('apps/web/styles/platform-v7-spacing-system.css');

    expect(spacing).not.toMatch(/\.pc-public-contact-dock\s*\{[^}]*display\s*:\s*none/is);
    expect(spacing).not.toMatch(/\.pc-public-contact-dock\s*\{[^}]*position\s*:/is);
    expect(spacing).not.toMatch(/\.pc-public-contact-dock\s*\{[^}]*bottom\s*:/is);
  });

  it('keeps final public typography readable after every legacy density layer', () => {
    for (const path of [
      'apps/web/styles/platform-v7-canonical-home-v1.css',
      'apps/web/styles/platform-v7-canonical-public-v1.css',
    ]) {
      const css = read(path);
      const authority = css.lastIndexOf('FINAL PUBLIC TYPOGRAPHY + MOTION AUTHORITY — 2026-09-21');
      expect(authority).toBeGreaterThan(css.lastIndexOf('font-size:6.5px'));
      expect(authority).toBeGreaterThan(css.lastIndexOf('font-size:7px'));
      expect(css.slice(authority)).toContain('--pc-type-caption:12px');
      expect(css.slice(authority)).toContain('.pc-cp-eyebrow');
      expect(css.slice(authority)).toContain('font-size:12px!important');
      expect(css.slice(authority)).toContain('.pc-cp-bottom-nav a{font-size:12px!important');
      expect(css.slice(authority)).toContain('grid-template-columns:repeat(6,minmax(0,1fr))!important');
      expect(css.slice(authority)).toContain('grid-template-columns:repeat(7,112px)!important');
      const finalFontSizes = [...css.slice(authority).matchAll(/font-size\\s*:\\s*([0-9.]+)px/g)].map((match) => Number(match[1]));
      expect(finalFontSizes.length).toBeGreaterThan(0);
      expect(Math.min(...finalFontSizes)).toBeGreaterThanOrEqual(12);
    }

    const header = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
    expect(header).not.toContain('font-family:Inter,ui-sans-serif');
    expect(header).toContain('font-family:-apple-system,BlinkMacSystemFont');
    expect(header).toContain("font-size:14px!important");
    expect(header).toContain(".pc-site-locale-option{font-size:12px!important}");
    expect(header).not.toContain(".pc-site-locale-option{font-size:11px!important}");
    expect(header).toContain('min-width:44px');

    const assistant = read('apps/web/styles/platform-v7-public-assistant-polish.css');
    expect(assistant).toContain('FINAL PUBLIC ASSISTANT TYPOGRAPHY AUTHORITY — 2026-09-21');
    expect(assistant).not.toContain('font-size: 9.5px !important;');
    expect(assistant).not.toContain('font-size: 10.5px !important;');
  });

  it('keeps edited public copy human, fact-bounded and free of internal implementation jargon', () => {
    const copy = [
      'apps/web/components/platform-v7/PlatformV7StrategicHome.tsx',
      'apps/web/components/platform-v7/PublicCanonicalPrimitives.tsx',
      'apps/web/app/platform-v7/about/page.tsx',
      'apps/web/app/platform-v7/ai-in-action/page.tsx',
      'apps/web/app/platform-v7/gekta/page.tsx',
      'apps/web/app/platform-v7/capabilities/page.tsx',
      'apps/web/app/platform-v7/deal-flow/page.tsx',
      'apps/web/app/platform-v7/how-it-works/page.tsx',
      'apps/web/app/platform-v7/market/page.tsx',
      'apps/web/app/platform-v7/trust/page.tsx',
    ].map(read).join('\n');

    for (const phrase of [
      '9 канонических ролей',
      '9 canonical roles',
      'authoritative financial state',
      'unavailable/stale',
      'без самостоятельной критической власти',
      'without fabricated production data',
      'Публичный выбор роли не выдаёт права',
    ]) {
      expect(copy).not.toContain(phrase);
    }

    expect(copy).toContain('Проверяемые факты');
    for (const phrase of [
      'One system from market to Deal closure',
      'turns the facts available to you into a clear picture',
      'The whole Deal without hand-offs between disconnected tools',
      'One control principle across every capability',
      'Trust starts with facts you can verify',
      'Pulls context together, highlights risks and explains available options',
      'Pulls Deal context together, highlights risks',
      'One context, seven stages, verifiable facts.',
      'Один контекст, семь этапов, проверяемые факты.',
      'Four trust pillars',
      'Четыре столпа доверия',
      '信任来自可核验的事实',
      'Reliable data. Strong agriculture.',
      'Verifiable facts instead of promises.',
      'Everything needed to execute the Deal',
      'A clear path from lot to closure',
      'Gekta works with your Deal context',
      'Authorised context only',
      'Gekta pulls available Deal facts together',
      'Сводит контекст в одном месте',
      '可靠数据。更强农业。',
    ]) {
      expect(copy).not.toContain(phrase);
    }

    expect(copy).toContain('See who acted, why, and on what evidence.');
    expect(copy).toContain('Each stage shows its facts and responsible participant.');
    expect(copy).toContain('What we check');
    expect(copy).toContain('Fact · source · authority · decision');
    expect(copy).toContain('Gekta works with the Deal data you can access');
    expect(copy).toContain('看清谁执行了操作、依据是什么、事实来自哪里。');
  });

});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 anonymous public market teaser', () => {
  const helper = read('lib/public-market-server.ts');
  const teaser = read('components/platform-v7/PublicMarketTeaser.tsx');
  const css = read('components/platform-v7/PublicMarketTeaser.module.css');
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');

  it('reads the public projection without forwarding an authenticated session', () => {
    expect(helper).toContain("serverApiUrl('/market/lots')");
    expect(helper).toContain("cache: 'no-store'");
    expect(helper).toContain("headers: { accept: 'application/json' }");
    expect(helper).not.toContain('serverAuthHeaders');
    expect(helper).toContain("scope: 'PUBLIC_MARKET'");
    expect(helper).toContain("projection: 'ANONYMIZED_PUBLIC_MARKET'");
    expect(helper).toContain("sellerIdentity: 'REDACTED'");
  });

  it('fails closed instead of substituting demo lots', () => {
    expect(helper).toContain('available: false');
    expect(helper).toContain('items: Object.freeze([])');
    expect(teaser).toContain('Демо-лоты не подставляются');
    expect(teaser).toContain('No demo lots are substituted');
    expect(teaser).toContain('系统不会填充演示批次');
    expect(teaser).not.toMatch(/LOT-001|BID-001|DL-2607-014/);
  });

  it('shows only an anonymized teaser and gates identity, full details and bidding behind auth', () => {
    expect(teaser).toContain('Продавец скрыт');
    expect(teaser).toContain('Наличие заявлено продавцом');
    expect(teaser).toContain('Независимое подтверждение не получено');
    expect(teaser).toContain('Полная карточка, контрагент, предложение и ставка доступны только после входа.');
    expect(teaser).toContain('/platform-v7/register?lang=');
    expect(teaser).toContain('/platform-v7/login?lang=');
    expect(teaser).not.toContain('lot.seller');
    expect(teaser).not.toContain('lot.address');
    expect(teaser).not.toContain('lot.publicRef}</');
    expect(teaser).not.toMatch(/href=.*publicRef/);
  });

  it('renders the market on the home page with a direct localized navigation anchor', () => {
    expect(home).toContain("import { PublicMarketTeaser } from './PublicMarketTeaser';");
    expect(home).toContain("<a href='#market'>{marketNavLabel}</a>");
    expect(home).toContain('<PublicMarketTeaser locale={locale} />');
    expect(teaser).toContain("id='market'");
    expect(teaser).toContain("data-testid='public-market-teaser'");
  });

  it('has explicit mobile layouts and keeps critical access controls usable on narrow screens', () => {
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('grid-template-columns: 1fr;');
    expect(css).toContain('.actions');
    expect(css).toContain('@media (max-width: 390px)');
  });
});

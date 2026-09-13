import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 public farmer market teaser', () => {
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const teaser = read('components/platform-v7/PublicMarketTeaser.tsx');
  const teaserCss = read('components/platform-v7/PublicMarketTeaser.module.css');
  const server = read('lib/public-market-server.ts');

  it('places the real market immediately after the hero proof and before the long narrative', () => {
    expect(home).toContain("import { PublicMarketTeaser } from './PublicMarketTeaser';");
    const market = home.indexOf('<PublicMarketTeaser');
    const participants = home.indexOf("<section id='participants'");
    const proof = home.indexOf('className={styles.proofStrip}');
    expect(proof).toBeGreaterThan(-1);
    expect(market).toBeGreaterThan(proof);
    expect(participants).toBeGreaterThan(market);
  });

  it('loads only the anonymized public PostgreSQL projection without authenticated server headers', () => {
    expect(server).toContain("serverApiUrl('/lots/market')");
    expect(server).toContain("value.source !== 'POSTGRESQL'");
    expect(server).toContain("value.visibility !== 'ANONYMIZED'");
    expect(server).not.toContain('serverAuthHeaders');
    expect(server).not.toMatch(/sellerOrg|sellerUser|tenantId|address|contact|certificate|sourceExternal/i);
  });

  it('requires registration for lot action and provides no public full-lot route', () => {
    expect(teaser).toContain("href={registerHref}>{copy.open}");
    expect(teaser).toContain("href={loginHref}>{copy.login}");
    expect(teaser).not.toContain('/platform-v7/auction?lotId=');
    expect(teaser).not.toContain('/lots/');
    expect(teaser).toContain("data-testid='platform-v7-public-market'");
  });

  it('has explicit truthful empty, unavailable and mobile states', () => {
    expect(teaser).toContain("snapshot.state === 'unavailable'");
    expect(teaser).toContain('snapshot.items.length === 0');
    expect(teaser).toContain('Мы не подставляем демонстрационные данные');
    expect(teaserCss).toContain('@media (max-width: 767px)');
    expect(teaserCss).toContain('.grid { grid-template-columns: 1fr; }');
  });

  it('keeps RU, EN and ZH copy in the same market component', () => {
    expect(teaser).toContain('Предложения фермеров уже на главной');
    expect(teaser).toContain('Farmer offers are visible on the homepage');
    expect(teaser).toContain('农户报价直接展示在首页');
  });
});

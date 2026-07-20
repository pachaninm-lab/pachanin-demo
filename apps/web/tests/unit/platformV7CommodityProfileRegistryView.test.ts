import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('platform-v7 industrial commodity profile registry view', () => {
  const component = source('components/platform-v7/CommodityProfileRegistryView.tsx');
  const styles = source('components/platform-v7/CommodityProfileRegistryView.module.css');
  const domain = source('../../packages/domain-core/src/commodity-profile.ts');

  it('is server-supplied and never manufactures runtime profile authority', () => {
    expect(component).toContain("data-authority='server-supplied'");
    expect(component).toContain("state: RegistryState");
    expect(component).toContain('profiles?: readonly CommodityProfileRegistryRecord[]');
    expect(component).not.toContain('const MOCK_');
    expect(component).not.toContain('localStorage');
    expect(component).not.toContain('sessionStorage');
    expect(component).not.toContain("fetch('");
    expect(component).not.toContain('demo');
    expect(component).not.toContain('pilot');
  });

  it('keeps lifecycle action authority outside the interface', () => {
    expect(component).toContain('primaryAction?: CommodityProfileRegistryAction');
    expect(component).toContain('onPrimaryAction?: (profileId: string, actionCode: string) => void');
    expect(component).toContain('selected.primaryAction.disabled');
    expect(component).toContain('selected.primaryAction.requiresConfirmation');
    expect(component).toContain('Действие и полномочия рассчитаны сервером');
    expect(component).not.toContain("setState('EFFECTIVE')");
  });

  it('implements compact registry plus progressive detail instead of a card wall', () => {
    expect(component).toContain('<table className={styles.table}>');
    expect(component).toContain('<details open>');
    expect(component).toContain('{copy.quality}');
    expect(component).toContain('{copy.documents}');
    expect(component).toContain('{copy.storage}');
    expect(component).toContain('{copy.acceptance}');
    expect(component).toContain('{copy.provenance}');
    expect(component).toContain('{copy.history}');
    expect(styles).toContain('grid-template-columns: minmax(520px, .95fr) minmax(420px, 1.05fr)');
  });

  it('covers honest loading, empty, error, permission and concurrency states', () => {
    expect(component).toContain("type RegistryState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden' | 'conflict'");
    expect(component).toContain("kind === 'conflict'");
    expect(component).toContain("kind === 'forbidden'");
    expect(component).toContain("kind === 'empty'");
    expect(component).toContain("role={critical ? 'alert' : undefined}");
  });

  it('supports RU EN ZH, keyboard use, mobile field work and accessibility modes', () => {
    expect(component).toContain('const COPY: Record<Locale, Copy>');
    expect(component).toContain('const ARCHETYPE_LABELS: Record<Locale');
    expect(component).toContain("aria-labelledby='commodity-profile-registry-title'");
    expect(component).toContain("aria-current={active ? 'true' : undefined}");
    expect(component).toContain("type='search'");
    expect(styles).toContain('@media (max-width: 430px)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('@media (forced-colors: active)');
    expect(styles).toContain('min-height: 44px');
    expect(styles).toContain('overscroll-behavior: contain');
  });

  it('uses the six-archetype fixed-precision domain authority', () => {
    for (const archetype of [
      'DRY_BULK',
      'SEED_PLANTING',
      'ROOT_INDUSTRIAL',
      'FRESH_PACKED',
      'GREENHOUSE_RECURRING',
      'ORGANIC_EXPORT_QUARANTINE',
    ]) {
      expect(domain).toContain(`'${archetype}'`);
    }
    expect(domain).toContain('JavaScript numbers are never authority');
    expect(domain).toContain('hashCommodityProfileContent');
    expect(domain).toContain('PC_PROFILE_VERSION_IMMUTABLE');
    expect(domain).toContain('PC_PROFILE_EFFECTIVE_OVERLAP');
  });
});

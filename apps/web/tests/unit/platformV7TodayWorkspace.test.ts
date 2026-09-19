import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('platform-v7 Today workspace scale and cognitive safety', () => {
  const dashboard = source('components/platform-v7/RoleIntentDashboard.tsx');
  const styles = source('components/platform-v7/RoleIntentDashboard.module.css');
  const designSystemStyles = source('../../packages/design-system-v8/src/components.module.css');

  it('keeps one primary deal while supporting server cursor pagination', () => {
    expect(dashboard).toContain('const PAGE_SIZE = 20');
    expect(dashboard).toContain("params.set('cursor', cursor)");
    expect(dashboard).toContain('nextCursor: string | null');
    expect(dashboard).toContain('mergeDeals(current.deals, page.deals)');
    expect(dashboard).toContain('Показать ещё сделки');
    expect(dashboard).toContain('<CanonicalDealWorkspace role={role} dealId={current.id} />');
  });

  it('deduplicates pages and never replaces an already usable screen with a load-more failure', () => {
    expect(dashboard).toContain('const byId = new Map<string, AccessibleDealRef>()');
    expect(dashboard).toContain("current.kind === 'ready'");
    expect(dashboard).toContain('loadMoreError: message');
    expect(dashboard).toContain("role='alert'");
  });

  it('inherits large touch targets from v8 and keeps mobile-safe scrolling', () => {
    expect(dashboard).toContain("from '@pc/design-system-v8'");
    expect(styles).toContain('.loadMoreButton');
    expect(designSystemStyles).toContain('min-height: var(--ds-control-height)');
    expect(styles).toContain('overscroll-behavior: contain');
    expect(styles).toContain('@media (max-width: 430px)');
    expect(styles).toContain('@media (forced-colors: active)');
  });
});

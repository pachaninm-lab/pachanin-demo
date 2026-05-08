import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_API_ACTION_MAP } from '@/lib/platform-v7/api-action-map';
import { PLATFORM_V7_API_BOUNDARIES } from '@/lib/platform-v7/api-boundary-contracts';

describe('platform-v7 api action map backlog', () => {
  it('keeps unmapped write boundaries explicit until action policies are added', () => {
    const unmappedWrites = PLATFORM_V7_API_BOUNDARIES.filter(
      (boundary) => boundary.method !== 'GET' && !PLATFORM_V7_API_ACTION_MAP[boundary.id],
    ).map((boundary) => boundary.id);

    expect(unmappedWrites).toHaveLength(2);
    expect(unmappedWrites).not.toContain('accept_trip');
    expect(unmappedWrites).not.toContain('open_incident');
  });

  it('does not hide money-affecting unmapped writes', () => {
    const unmappedMoneyWrites = PLATFORM_V7_API_BOUNDARIES.filter(
      (boundary) =>
        boundary.method !== 'GET' &&
        boundary.affectsMoney &&
        !PLATFORM_V7_API_ACTION_MAP[boundary.id],
    ).map((boundary) => boundary.id);

    expect(unmappedMoneyWrites).toHaveLength(1);
    expect(unmappedMoneyWrites).not.toContain('accept_trip');
    expect(unmappedMoneyWrites).not.toContain('open_incident');
  });
});

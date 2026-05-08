import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_API_ACTION_MAP } from '@/lib/platform-v7/api-action-map';
import { PLATFORM_V7_API_BOUNDARIES } from '@/lib/platform-v7/api-boundary-contracts';

const expectedUnmappedWriteBoundaries = [
  'confirm_deal_terms',
  'accept_trip',
  'open_incident',
  'resolve_dispute',
  'append_support_message',
] as const;

describe('platform-v7 api action map backlog', () => {
  it('keeps unmapped write boundaries explicit until action policies are added', () => {
    const unmappedWrites = PLATFORM_V7_API_BOUNDARIES.filter(
      (boundary) => boundary.method !== 'GET' && !PLATFORM_V7_API_ACTION_MAP[boundary.id],
    ).map((boundary) => boundary.id);

    expect(unmappedWrites).toEqual(expectedUnmappedWriteBoundaries);
  });

  it('does not hide money-affecting unmapped writes', () => {
    const unmappedMoneyWrites = PLATFORM_V7_API_BOUNDARIES.filter(
      (boundary) =>
        boundary.method !== 'GET' &&
        boundary.affectsMoney &&
        !PLATFORM_V7_API_ACTION_MAP[boundary.id],
    ).map((boundary) => boundary.id);

    expect(unmappedMoneyWrites).toEqual(['accept_trip', 'open_incident', 'resolve_dispute']);
  });
});

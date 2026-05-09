import { describe, expect, it } from 'vitest';
import { getPlatformV7VisibleFields } from '@/lib/platform-v7/role-access';

const fields = ['phone', 'email', 'exactAddress', 'bankDetails', 'fullDocuments', 'closedOfferTerms'] as const;

describe('platform-v7 visible field filter', () => {
  it('removes buyer restricted fields from mixed field lists', () => {
    expect(getPlatformV7VisibleFields('buyer', fields)).toEqual(['fullDocuments']);
  });

  it('removes investor restricted fields from mixed field lists', () => {
    expect(getPlatformV7VisibleFields('investor', fields)).toEqual([]);
  });

  it('keeps unrestricted operator field lists intact', () => {
    expect(getPlatformV7VisibleFields('operator', fields)).toEqual([...fields]);
  });
});

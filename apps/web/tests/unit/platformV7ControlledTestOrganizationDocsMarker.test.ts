import { describe, expect, it } from 'vitest';
import { CONTROLLED_TEST_ORGANIZATIONS } from '../../lib/platform-v7/controlled-test-organizations';

describe('controlled test organization markers', () => {
  it('marks every controlled organization as test data', () => {
    expect(CONTROLLED_TEST_ORGANIZATIONS.every((item) => item.testData)).toBe(true);
  });
});

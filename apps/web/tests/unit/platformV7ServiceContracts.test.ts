import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_REQUIRED_SERVICE_NAMES } from '@/lib/platform-v7/service-contracts';

const REQUIRED = [
  'batch',
  'lot',
  'rfq',
  'proposal',
  'deal',
  'money',
  'document',
  'logistics',
  'trip',
  'dispute',
  'support',
  'rating',
  'audit',
  'notification',
  'integrations',
] as const;

describe('platform-v7 service contracts', () => {
  it('keeps the full controlled-pilot backend service boundary explicit', () => {
    expect(PLATFORM_V7_REQUIRED_SERVICE_NAMES).toEqual(REQUIRED);
  });

  it('does not mark service boundary as production-ready', () => {
    expect(PLATFORM_V7_REQUIRED_SERVICE_NAMES.join(' ')).not.toMatch(/production-ready|fully live|fully integrated/i);
  });
});

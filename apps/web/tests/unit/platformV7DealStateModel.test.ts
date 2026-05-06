import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_DEAL_STATUS_ORDER,
  canPlatformV7DealTransition,
  getPlatformV7DealNextStatuses,
  isPlatformV7DealTerminal,
} from '@/lib/platform-v7/deal-state-model';

describe('platform-v7 deal state model', () => {
  it('keeps the core execution status order explicit', () => {
    expect(PLATFORM_V7_DEAL_STATUS_ORDER[0]).toBe('draft');
    expect(PLATFORM_V7_DEAL_STATUS_ORDER).toContain('money_reserved');
    expect(PLATFORM_V7_DEAL_STATUS_ORDER).toContain('awaiting_documents');
    expect(PLATFORM_V7_DEAL_STATUS_ORDER).toContain('in_transit');
    expect(PLATFORM_V7_DEAL_STATUS_ORDER).toContain('awaiting_money_release');
    expect(PLATFORM_V7_DEAL_STATUS_ORDER).toContain('dispute');
    expect(PLATFORM_V7_DEAL_STATUS_ORDER.at(-1)).toBe('cancelled');
  });

  it('allows only controlled forward transitions and manual review paths', () => {
    expect(canPlatformV7DealTransition('draft', 'awaiting_reserve')).toBe(true);
    expect(canPlatformV7DealTransition('awaiting_reserve', 'money_reserved')).toBe(true);
    expect(canPlatformV7DealTransition('money_reserved', 'awaiting_documents')).toBe(true);
    expect(canPlatformV7DealTransition('awaiting_documents', 'awaiting_logistics')).toBe(true);
    expect(canPlatformV7DealTransition('awaiting_logistics', 'in_transit')).toBe(true);
    expect(canPlatformV7DealTransition('awaiting_money_release', 'closed')).toBe(true);
    expect(canPlatformV7DealTransition('in_transit', 'money_reserved')).toBe(false);
    expect(canPlatformV7DealTransition('closed', 'awaiting_money_release')).toBe(false);
  });

  it('keeps disputes and manual review as explicit non-silent branches', () => {
    expect(getPlatformV7DealNextStatuses('awaiting_documents')).toContain('manual_review');
    expect(getPlatformV7DealNextStatuses('awaiting_documents')).toContain('dispute');
    expect(getPlatformV7DealNextStatuses('dispute')).toContain('manual_review');
    expect(getPlatformV7DealNextStatuses('dispute')).toContain('awaiting_money_release');
  });

  it('marks only closed and cancelled as terminal', () => {
    expect(isPlatformV7DealTerminal('closed')).toBe(true);
    expect(isPlatformV7DealTerminal('cancelled')).toBe(true);
    expect(isPlatformV7DealTerminal('dispute')).toBe(false);
    expect(isPlatformV7DealTerminal('manual_review')).toBe(false);
  });
});

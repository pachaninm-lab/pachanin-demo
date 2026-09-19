import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE,
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
} from '@/lib/platform-v7/routes';

describe('PlatformV7 bank payment-basis route surface', () => {
  it('registers the payment-basis route across platform route surfaces', () => {
    expect(PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE).toBe('/platform-v7/bank/payment-basis');
    expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);
    expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).toContain(PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);
    expect(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES).toContain(PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE);
  });
});

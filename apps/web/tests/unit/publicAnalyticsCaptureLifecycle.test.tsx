import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicAnalytics } from '@/components/analytics/PublicAnalytics';

vi.mock('next/navigation', () => ({
  usePathname: () => '/platform-v7',
}));

afterEach(() => cleanup());

describe('PostHog public analytics capture lifecycle', () => {
  it('emits one page view across action-reference rerenders and same-route remounts', async () => {
    const firstAction = vi.fn(async () => undefined);
    const rendered = render(
      <PublicAnalytics locale='ru' capturePublicProductAnalyticsAction={firstAction} />,
    );

    await waitFor(() => expect(firstAction).toHaveBeenCalledTimes(1));
    expect(firstAction.mock.calls[0]?.[0]).toMatchObject({
      name: 'public_page_view',
      properties: {
        locale: 'ru',
        source: 'public_analytics_bridge',
      },
    });

    const replacementAction = vi.fn(async () => undefined);
    rendered.rerender(
      <PublicAnalytics locale='ru' capturePublicProductAnalyticsAction={replacementAction} />,
    );

    await act(async () => Promise.resolve());
    expect(firstAction).toHaveBeenCalledTimes(1);
    expect(replacementAction).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
        detail: { name: 'deal_demo_open', source: 'home_preview' },
      }));
    });
    await waitFor(() => expect(replacementAction).toHaveBeenCalledTimes(1));
    expect(replacementAction.mock.calls[0]?.[0]).toMatchObject({ name: 'deal_demo_open' });

    rendered.unmount();
    const remountedAction = vi.fn(async () => undefined);
    render(<PublicAnalytics locale='ru' capturePublicProductAnalyticsAction={remountedAction} />);
    await act(async () => Promise.resolve());
    expect(remountedAction).not.toHaveBeenCalled();
  });
});

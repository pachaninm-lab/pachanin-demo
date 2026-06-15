import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  platformV7AccessRequestNextAction,
  platformV7AccessRequestCanEnter,
  platformV7BuildAccessStatusView,
  type PlatformV7AccessRequestStatus,
} from '@/lib/platform-v7/access-request';
import AccessStatusPage from '@/app/platform-v7/access/page';

describe('PR-9 access request lifecycle', () => {
  it('gives a clear next action for every status', () => {
    const statuses: PlatformV7AccessRequestStatus[] = ['draft', 'submitted', 'pending_approval', 'manual_review', 'approved', 'rejected'];
    for (const status of statuses) {
      expect(platformV7AccessRequestNextAction(status).length).toBeGreaterThan(0);
    }
    expect(platformV7AccessRequestCanEnter('approved')).toBe(true);
    expect(platformV7AccessRequestCanEnter('manual_review')).toBe(false);
  });

  it('builds a status view with lifecycle and pilot note', () => {
    const view = platformV7BuildAccessStatusView({ id: 'a', organizationName: 'Org', requestedRole: 'Покупатель', status: 'manual_review' });
    expect(view.canEnter).toBe(false);
    expect(view.lifecycle.some((s) => s.status === 'manual_review' && s.reached)).toBe(true);
    expect(view.lifecycle.find((s) => s.status === 'approved')?.reached).toBe(false);
    expect(view.pilotNote).toContain('пилот');
  });
});

describe('PR-9 access status page', () => {
  it('renders the access status with next action and no demo/mock/sandbox copy', () => {
    const { container } = render(<AccessStatusPage />);
    expect(screen.getByTestId('platform-v7-access-page')).toBeInTheDocument();
    expect(screen.getByText(/Следующее действие/)).toBeInTheDocument();
    expect(container.textContent || '').not.toMatch(/demo|mock|sandbox|test mode/i);
  });
});

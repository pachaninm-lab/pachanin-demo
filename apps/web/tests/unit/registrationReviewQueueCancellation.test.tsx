import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationReviewQueue } from '@/components/platform-v7/staff/RegistrationReviewQueue';

const application = {
  applicationId: 'application-1',
  status: 'ORGANIZATION_VERIFICATION_PENDING',
  requestedWorkspace: 'seller',
  requestedRole: 'FARMER',
  organization: {
    name: 'ООО Тест',
    legalName: 'ООО Тест',
    status: 'PENDING',
    inn: '7700000000',
    kpp: null,
    ogrn: null,
    region: 'Москва',
  },
  applicant: {
    fullName: 'Иван Тестов',
    position: 'Директор',
    email: 'test@example.test',
    phone: '+79990000000',
  },
  submittedAt: '2026-09-03T12:00:00.000Z',
  version: '4',
  correlationId: 'registration-correlation-1',
  checks: { emailVerified: true, kycStatus: 'PENDING', amlStatus: 'CLEAR', sanctionHit: false },
  duplicateSignals: { organizationsWithSameInn: 0, applicationsWithSameEmail: 0 },
  riskFlags: [],
  history: [],
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('RegistrationReviewQueue owner cancellation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(async () => new Uint8Array(32).fill(7).buffer),
      },
      randomUUID: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
    });
  });

  it('shows the destructive action only to PLATFORM_OWNER and removes the card after success', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/staff/registration/applications') {
        return response({ applications: [application] });
      }
      if (url === '/api/staff/session-context') {
        return response({ active: true, session: { staffRole: 'PLATFORM_OWNER' } });
      }
      if (url.endsWith('/registration/applications/application-1/cancel')) {
        return response({ applicationId: 'application-1', status: 'CANCELLED', replayed: false });
      }
      throw new Error(`Unexpected fetch: ${url} ${init?.method || 'GET'}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RegistrationReviewQueue locale="ru" csrfToken="csrf-token-123" />);
    expect(await screen.findByText('ООО Тест')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Удалить заявку' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Удалить заявку «ООО Тест»?')).toBeInTheDocument();
    expect(within(dialog).getByText(/Действие будет записано в журнале аудита/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить заявку' }));

    expect(await screen.findByText('Заявка удалена из очереди.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('ООО Тест')).not.toBeInTheDocument());

    const cancelCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/cancel'));
    expect(cancelCall).toBeDefined();
    const init = cancelCall?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('csrf-token-123');
    expect(headers['Idempotency-Key']).toMatch(/^owner-registration-cancel:/);
    expect(headers['X-Correlation-Id']).toContain('owner-registration-cancel:');
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'Удалено владельцем из очереди' });
  });

  it('does not expose the cancellation button to another reviewer role', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/staff/registration/applications') {
        return response({ applications: [application] });
      }
      if (url === '/api/staff/session-context') {
        return response({ active: true, session: { staffRole: 'PLATFORM_ADMIN' } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RegistrationReviewQueue locale="ru" csrfToken="csrf-token-123" />);
    expect(await screen.findByText('ООО Тест')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить заявку' })).not.toBeInTheDocument();
  });
});

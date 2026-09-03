import { webcrypto } from 'node:crypto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationReviewQueue } from '@/components/platform-v7/staff/RegistrationReviewQueue';

const APPLICATION = {
  applicationId: 'application-owner-cancel-1',
  status: 'ORGANIZATION_VERIFICATION_PENDING',
  requestedWorkspace: 'seller',
  requestedRole: 'FARMER',
  organization: {
    name: 'ООО Тест',
    legalName: 'ООО Тест',
    status: 'PENDING',
    inn: '7701234567',
    kpp: '770101001',
    ogrn: '1234567890123',
    region: 'Москва',
  },
  applicant: {
    fullName: 'Иван Иванов',
    position: 'Директор',
    email: 'ivan@example.test',
    phone: '+79990000000',
  },
  submittedAt: '2026-09-03T12:00:00.000Z',
  version: '7',
  correlationId: 'registration-correlation-1',
  checks: { emailVerified: true, kycStatus: 'CLEAR', amlStatus: 'CLEAR', sanctionHit: false },
  duplicateSignals: { organizationsWithSameInn: 0, applicationsWithSameEmail: 0 },
  riskFlags: [],
  history: [],
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ownerFetch(cancelPayload: unknown = {
  applicationId: APPLICATION.applicationId,
  status: 'CANCELLED',
  replayed: false,
}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const target = String(input);
    if (target === '/api/staff/registration/applications') {
      return jsonResponse({ applications: [APPLICATION] });
    }
    if (target === '/api/staff/session-context') {
      return jsonResponse({ active: true, session: { staffRole: 'PLATFORM_OWNER' } });
    }
    if (target.endsWith(`/${APPLICATION.applicationId}/cancel`)) {
      return jsonResponse(cancelPayload);
    }
    throw new Error(`Unexpected fetch: ${target} ${String(init?.method || 'GET')}`);
  });
}

describe('RegistrationReviewQueue owner cancellation', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('confirms cancellation, sends security headers and removes the card without reload', async () => {
    const fetchMock = ownerFetch();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<RegistrationReviewQueue locale="ru" csrfToken="csrf-token" />);

    expect(await screen.findByText('ООО Тест')).toBeTruthy();
    const deleteButton = await screen.findByRole('button', { name: 'Удалить заявку' });
    await user.click(deleteButton);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Удалить заявку «ООО Тест»?')).toBeTruthy();
    expect(within(dialog).getByText(
      'Заявка исчезнет из рабочей очереди. Действие будет записано в журнале аудита.',
    )).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(screen.getByText('ООО Тест')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Удалить заявку' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить заявку' }));

    await waitFor(() => expect(screen.queryByText('ООО Тест')).toBeNull());
    expect(screen.getByText('Заявка удалена из очереди.')).toBeTruthy();

    const cancelCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith(`/${APPLICATION.applicationId}/cancel`),
    );
    expect(cancelCall).toBeDefined();
    const init = cancelCall?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(init.method).toBe('POST');
    expect(headers['X-CSRF-Token']).toBe('csrf-token');
    expect(headers['Idempotency-Key']).toMatch(/^registration-cancel:/);
    expect(headers['X-Correlation-Id']).toMatch(/^registration-cancel:/);
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'Удалено владельцем из очереди' });

    expect(fetchMock.mock.calls.filter(([input]) =>
      String(input) === '/api/staff/registration/applications',
    )).toHaveLength(1);
  });

  it('does not render the destructive action for a non-owner reviewer', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const target = String(input);
      if (target === '/api/staff/registration/applications') {
        return jsonResponse({ applications: [APPLICATION] });
      }
      if (target === '/api/staff/session-context') {
        return jsonResponse({ active: true, session: { staffRole: 'PLATFORM_ADMIN' } });
      }
      throw new Error(`Unexpected fetch: ${target}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RegistrationReviewQueue locale="ru" csrfToken="csrf-token" />);

    expect(await screen.findByText('ООО Тест')).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Удалить заявку' })).toBeNull();
  });

  it('maps FRESH_MFA_REQUIRED to the bounded owner-facing message', async () => {
    const fetchMock = ownerFetch({ code: 'FRESH_MFA_REQUIRED' });
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const target = String(input);
      if (target === '/api/staff/registration/applications') {
        return jsonResponse({ applications: [APPLICATION] });
      }
      if (target === '/api/staff/session-context') {
        return jsonResponse({ active: true, session: { staffRole: 'PLATFORM_OWNER' } });
      }
      if (target.endsWith(`/${APPLICATION.applicationId}/cancel`)) {
        return jsonResponse({ code: 'FRESH_MFA_REQUIRED' }, 403);
      }
      throw new Error(`Unexpected fetch: ${target}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<RegistrationReviewQueue locale="ru" csrfToken="csrf-token" />);
    await user.click(await screen.findByRole('button', { name: 'Удалить заявку' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить заявку' }));

    expect(await screen.findByText('Подтвердите действие через MFA.')).toBeTruthy();
    expect(screen.getByText('ООО Тест')).toBeTruthy();
  });
});

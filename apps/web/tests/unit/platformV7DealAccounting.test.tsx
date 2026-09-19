import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DealAccountingClient } from '@/app/platform-v7/deals/[id]/accounting/DealAccountingClient';

function mockFetch(response: () => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async () => response()));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DealAccountingClient', () => {
  it('names every missing source rather than only refusing', async () => {
    // "Документ собрать нельзя" without the list leaves the person guessing
    // which of nine sources to go and chase.
    mockFetch(() =>
      json({
        assembled: false,
        missing: ['NO_ACCEPTED_WEIGHT', 'NO_QUALITY_SAMPLE', 'NO_TAX_PROFILE'],
      }),
    );

    render(<DealAccountingClient dealId="deal-1" />);

    await waitFor(() => expect(screen.getByText('Нет принятого веса')).toBeInTheDocument());
    expect(screen.getByText('Нет финализированного качества')).toBeInTheDocument();
    expect(screen.getByText('Не заявлен налоговый профиль')).toBeInTheDocument();
  });

  it('shows an unknown source code rather than swallowing it', async () => {
    // A source the screen has no wording for is still a source somebody must
    // chase; hiding it would make the list quietly incomplete.
    mockFetch(() => json({ assembled: false, missing: ['NO_SUCH_SOURCE_YET'] }));

    render(<DealAccountingClient dealId="deal-1" />);

    await waitFor(() => expect(screen.getByText('NO_SUCH_SOURCE_YET')).toBeInTheDocument());
  });

  it('says the document can be prepared when everything is present', async () => {
    mockFetch(() => json({ assembled: true }));

    render(<DealAccountingClient dealId="deal-1" />);

    await waitFor(() =>
      expect(screen.getByText(/Все источники на месте/)).toBeInTheDocument(),
    );
  });

  it('does not present an outage as a complete set of sources', async () => {
    mockFetch(() => Promise.reject(new Error('network')));

    render(<DealAccountingClient dealId="deal-1" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Не удалось проверить источники/);
    expect(screen.queryByText(/Все источники на месте/)).not.toBeInTheDocument();
  });
});

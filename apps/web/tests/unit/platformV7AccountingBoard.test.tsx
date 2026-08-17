import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AccountingTaskBoardClient } from '@/app/platform-v7/accounting/AccountingTaskBoardClient';

/**
 * The board's contract with the person reading it.
 *
 * The cases that matter are the unhappy ones: an unreachable server must not
 * produce a screen that looks like an empty queue, and a refusal must not look
 * like an outage. Both mistakes end with somebody believing there is nothing to
 * do.
 */

const PROJECTION = {
  view: 'WORK_QUEUE',
  headline: 'Сегодня требуется 1 действие.',
  counts: { needsMe: 1, waitingOnOthers: 0, errors: 0, dueToday: 1, total: 1 },
};

const TASK = {
  id: 'task-1',
  taskType: 'DOCUMENT_NOT_SIGNED',
  origin: 'DERIVED' as const,
  resolutionMode: 'SYSTEM_VERIFIED',
  status: 'OPEN',
  responsibleCapability: 'documents.sign',
  assignedMembershipId: null,
  deadlineAt: null,
  documentId: 'doc-1',
  title: 'Нужна ваша подпись',
  humanDescription: 'УПД № 114 ещё не подписан.',
  version: '0',
};

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => handler(String(input))));
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

describe('AccountingTaskBoardClient', () => {
  it('shows the work and its counts, both from the server', async () => {
    mockFetch((url) => json(url.includes('projection') ? PROJECTION : [TASK]));

    render(<AccountingTaskBoardClient />);

    await waitFor(() => expect(screen.getByText('Нужна ваша подпись')).toBeInTheDocument());
    expect(screen.getByText('УПД № 114 ещё не подписан.')).toBeInTheDocument();
    expect(screen.getByText('Сегодня требуется 1 действие.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Проверить и подписать' })).toBeInTheDocument();
  });

  it('refuses to look like an empty queue when the server is unreachable', async () => {
    // The failure this test exists for: an outage rendering as "нет задач",
    // which reads as "всё сделано" to the person who has to act.
    mockFetch(() => Promise.reject(new Error('network')));

    render(<AccountingTaskBoardClient />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Не удалось получить задачи/);
    expect(screen.queryByText('Открытых задач нет.')).not.toBeInTheDocument();
  });

  it('says "no access" rather than "unavailable" when it is refused', async () => {
    mockFetch(() => json({ code: 'FORBIDDEN' }, 403));

    render(<AccountingTaskBoardClient />);

    await waitFor(() =>
      expect(screen.getByText(/нет доступа к бухгалтерским задачам/)).toBeInTheDocument(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('distinguishes an expired session from both', async () => {
    mockFetch(() => json({ code: 'UNAUTHENTICATED' }, 401));

    render(<AccountingTaskBoardClient />);

    await waitFor(() => expect(screen.getByText(/Сессия истекла/)).toBeInTheDocument());
  });

  it('shows an empty queue only when the server actually returned none', async () => {
    mockFetch((url) =>
      json(
        url.includes('projection')
          ? { ...PROJECTION, headline: 'Очередь пуста.', counts: { needsMe: 0, waitingOnOthers: 0, errors: 0, dueToday: 0, total: 0 } }
          : [],
      ),
    );

    render(<AccountingTaskBoardClient />);

    await waitFor(() => expect(screen.getByText('Открытых задач нет.')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers exactly one action per card', async () => {
    mockFetch((url) => json(url.includes('projection') ? PROJECTION : [TASK]));

    render(<AccountingTaskBoardClient />);

    await waitFor(() => expect(screen.getByText('Нужна ваша подпись')).toBeInTheDocument());
    const card = screen.getByText('Нужна ваша подпись').closest('li');
    expect(card).not.toBeNull();
    expect(card!.querySelectorAll('button')).toHaveLength(1);
  });

  it('names every KPI in words, so a number is never anonymous', async () => {
    mockFetch((url) => json(url.includes('projection') ? PROJECTION : [TASK]));

    render(<AccountingTaskBoardClient />);

    for (const label of ['Требует меня', 'Ждём других', 'Ошибки', 'Срок сегодня']) {
      await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument());
    }
  });
});

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { P7ActionLog } from '@/components/platform-v7/P7ActionLog';
import type { PlatformActionLogEntry } from '@/lib/platform-v7/action-log';

const entries: PlatformActionLogEntry[] = [
  {
    id: 'DL-9102-confirm-success',
    scope: 'deal',
    status: 'success',
    objectId: 'DL-9102',
    action: 'confirm-acceptance',
    actor: 'operator',
    at: '2026-04-26T10:00:01Z',
    message: 'Acceptance confirmed.',
  },
  {
    id: 'DL-9102-confirm-started',
    scope: 'deal',
    status: 'started',
    objectId: 'DL-9102',
    action: 'confirm-acceptance',
    actor: 'operator',
    at: '2026-04-26T10:00:00Z',
    message: 'Acceptance started.',
  },
  {
    id: 'DL-9103-release-error',
    scope: 'bank',
    status: 'error',
    objectId: 'DL-9103',
    action: 'bank-release',
    actor: 'bank',
    at: '2026-04-26T10:00:02Z',
    message: 'Release failed.',
    error: 'network',
  },
];

describe('P7ActionLog', () => {
  it('renders empty state', () => {
    render(<P7ActionLog title='Журнал действий' entries={[]} />);

    expect(screen.getByText('Журнал действий')).toBeInTheDocument();
    expect(screen.getByText('Действий пока нет.')).toBeInTheDocument();
  });

  it('renders started, success and error entries with labels', () => {
    render(<P7ActionLog title='Журнал действий' entries={entries} />);

    expect(screen.getByText('Успешно')).toBeInTheDocument();
    expect(screen.getByText('Выполняется')).toBeInTheDocument();
    expect(screen.getByText('Ошибка')).toBeInTheDocument();
    expect(screen.getByText('Acceptance confirmed.')).toBeInTheDocument();
    expect(screen.getByText('Acceptance started.')).toBeInTheDocument();
    expect(screen.getByText('Release failed.')).toBeInTheDocument();
    expect(screen.getByText('Ошибка: network')).toBeInTheDocument();
  });

  it('respects maxEntries', () => {
    render(<P7ActionLog title='Журнал действий' entries={entries} maxEntries={1} />);

    expect(screen.getByText('Acceptance confirmed.')).toBeInTheDocument();
    expect(screen.queryByText('Acceptance started.')).not.toBeInTheDocument();
    expect(screen.queryByText('Release failed.')).not.toBeInTheDocument();
  });
});

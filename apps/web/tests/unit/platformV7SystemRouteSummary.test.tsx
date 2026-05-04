import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SystemRouteSummary } from '@/components/platform-v7/SystemRouteSummary';
import { getPlatformV7SystemSurface } from '@/components/platform-v7/SystemRouteSummaryGate';

describe('SystemRouteSummary', () => {
  it('renders the demo route as a guided execution route', () => {
    render(<SystemRouteSummary surface='demo' />);

    expect(screen.getByTestId('platform-v7-system-surface-demo')).toBeInTheDocument();
    expect(screen.getAllByText('Демо-маршрут сделки').length).toBeGreaterThan(0);
    expect(screen.getByText('3 минуты по цепочке исполнения')).toBeInTheDocument();
    expect(screen.getByText(/лот → ставка → сделка → резерв → рейс → приёмка → документы → деньги → спор/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Начать демо' })).toHaveAttribute('href', '/platform-v7/demo');
  });

  it('renders deploy-check as a service-only surface', () => {
    render(<SystemRouteSummary surface='deployCheck' />);

    expect(screen.getByTestId('platform-v7-system-surface-deployCheck')).toBeInTheDocument();
    expect(screen.getByText('Служебная проверка')).toBeInTheDocument();
    expect(screen.getByText('не пользовательский экран')).toBeInTheDocument();
    expect(screen.getByText(/не должен участвовать во внешней демонстрации/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Вернуться в платформу' })).toHaveAttribute('href', '/platform-v7');
  });

  it('renders compliance and lab as audit-safe operational surfaces', () => {
    render(<SystemRouteSummary surface='compliance' />);
    expect(screen.getByTestId('platform-v7-system-surface-compliance')).toBeInTheDocument();
    expect(screen.getByText(/sandbox\/readiness не должен выглядеть как юридически полностью закрытый live-допуск/i)).toBeInTheDocument();

    render(<SystemRouteSummary surface='lab' />);
    expect(screen.getByTestId('platform-v7-system-surface-lab')).toBeInTheDocument();
    expect(screen.getByText(/качество влияет на приёмку, спор и деньги/i)).toBeInTheDocument();
  });
});

describe('getPlatformV7SystemSurface', () => {
  it('maps extended and system routes to system surfaces', () => {
    expect(getPlatformV7SystemSurface('/platform-v7/operator')).toBe('operator');
    expect(getPlatformV7SystemSurface('/platform-v7/operator-cockpit/queues')).toBe('operatorQueues');
    expect(getPlatformV7SystemSurface('/platform-v7/control-tower')).toBe('controlTower');
    expect(getPlatformV7SystemSurface('/platform-v7/lab')).toBe('lab');
    expect(getPlatformV7SystemSurface('/platform-v7/compliance')).toBe('compliance');
    expect(getPlatformV7SystemSurface('/platform-v7/demo')).toBe('demo');
    expect(getPlatformV7SystemSurface('/platform-v7/notifications')).toBe('notifications');
    expect(getPlatformV7SystemSurface('/platform-v7/profile')).toBe('profile');
    expect(getPlatformV7SystemSurface('/platform-v7/auth')).toBe('auth');
    expect(getPlatformV7SystemSurface('/platform-v7/login')).toBe('auth');
    expect(getPlatformV7SystemSurface('/platform-v7/register')).toBe('register');
    expect(getPlatformV7SystemSurface('/platform-v7/deploy-check')).toBe('deployCheck');
  });

  it('does not map core role and audit routes handled by other summary gates', () => {
    expect(getPlatformV7SystemSurface('/platform-v7/seller')).toBeUndefined();
    expect(getPlatformV7SystemSurface('/platform-v7/bank')).toBeUndefined();
    expect(getPlatformV7SystemSurface('/platform-v7/documents')).toBeUndefined();
    expect(getPlatformV7SystemSurface('/platform-v7/disputes')).toBeUndefined();
  });
});

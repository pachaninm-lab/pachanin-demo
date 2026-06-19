import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExecutionSimulationActionPanel } from '@/components/v7r/ExecutionSimulationActionPanel';

// The interactive domain-core action engine is intentionally disabled for the
// Netlify build ("Интерактивные команды временно отключены…"); the panel
// currently renders a compact pre-integration verification scenario. These
// tests assert that canonical compact panel.
describe('ExecutionSimulationActionPanel', () => {
  it('renders the compact pre-integration verification panel', () => {
    render(<ExecutionSimulationActionPanel />);

    expect(screen.getByTestId('execution-simulation-action-panel')).toBeInTheDocument();
    expect(screen.getByText('Проверочные действия сделки')).toBeInTheDocument();
    expect(screen.getByText('Сценарий проверки')).toBeInTheDocument();
  });

  it('lists the five verification steps', () => {
    render(<ExecutionSimulationActionPanel />);

    expect(screen.getByText('1. Лот')).toBeInTheDocument();
    expect(screen.getByText('2. Сделка')).toBeInTheDocument();
    expect(screen.getByText('3. Рейс')).toBeInTheDocument();
    expect(screen.getByText('4. Качество')).toBeInTheDocument();
    expect(screen.getByText('5. Разбор')).toBeInTheDocument();
  });

  it('signals that interactive commands are temporarily disabled', () => {
    render(<ExecutionSimulationActionPanel />);

    expect(
      screen.getByText(/Интерактивные команды временно отключены/),
    ).toBeInTheDocument();
  });
});

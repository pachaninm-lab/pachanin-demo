import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ExecutionSimulationActionPanel } from '@/components/v7r/ExecutionSimulationActionPanel';

function cardByTitle(title: string): HTMLElement {
  const titleNode = screen.getByText(title);
  const card = titleNode.parentElement;
  if (!card) throw new Error(`Card not found for title: ${title}`);
  return card;
}

function clickCardAction(title: string) {
  const card = cardByTitle(title);
  const button = within(card).getByRole('button', { name: 'Выполнить' });
  fireEvent.click(button);
}

describe('ExecutionSimulationActionPanel', () => {
  it('renders simulation KPIs, action cards and disabled reasons from domain-core', () => {
    render(<ExecutionSimulationActionPanel />);

    expect(screen.getByTestId('execution-simulation-action-panel')).toBeInTheDocument();
    expect(screen.getByText('GMV sandbox')).toBeInTheDocument();
    expect(screen.getByText('К выпуску')).toBeInTheDocument();
    expect(screen.getByText('Открытых споров')).toBeInTheDocument();
    expect(screen.getByText('Текущий статус')).toBeInTheDocument();

    expect(screen.getByText('1. Создать лот')).toBeInTheDocument();
    expect(screen.getByText('5. Запросить резерв')).toBeInTheDocument();
    expect(screen.getByText('10. Открыть спор')).toBeInTheDocument();

    expect(screen.getByText('Сначала создай лот')).toBeInTheDocument();
    expect(screen.getByText('Банк подтверждает только запрошенный резерв')).toBeInTheDocument();
    expect(screen.getByText('Лаборатория доступна после подтверждения веса')).toBeInTheDocument();
  });

  it('runs a reserve request through the new domain-core action engine and writes UI/audit/timeline', () => {
    render(<ExecutionSimulationActionPanel />);

    clickCardAction('5. Запросить резерв');

    expect(screen.getByText('Запрошен резерв средств в sandbox-контуре')).toBeInTheDocument();
    expect(screen.getByText(/5\. Запросить резерв: Запрошен резерв средств в sandbox-контуре/)).toBeInTheDocument();
    expect(screen.getByText('DL-9113 · requestReserve')).toBeInTheDocument();
    expect(screen.getByText('Запрошен резерв средств в sandbox-контуре')).toBeInTheDocument();
    expect(screen.getByText('Reserve requested')).toBeInTheDocument();
  });

  it('unlocks the next banking action after reserve request and writes the next audit event', () => {
    render(<ExecutionSimulationActionPanel />);

    clickCardAction('5. Запросить резерв');
    clickCardAction('6. Подтвердить резерв');

    expect(screen.getByText('Резерв средств подтверждён в sandbox-контуре')).toBeInTheDocument();
    expect(screen.getByText(/6\. Подтвердить резерв: Резерв средств подтверждён в sandbox-контуре/)).toBeInTheDocument();
    expect(screen.getByText('DL-9113 · confirmReserve')).toBeInTheDocument();
    expect(screen.getByText('Reserve confirmed')).toBeInTheDocument();
  });

  it('keeps unavailable actions disabled instead of allowing an invalid transition', () => {
    render(<ExecutionSimulationActionPanel />);

    const disputeCard = cardByTitle('10. Открыть спор');
    const disputeButton = within(disputeCard).getByRole('button', { name: 'Выполнить' });

    expect(disputeButton).toBeDisabled();
    expect(within(disputeCard).getByText('Спор открывается после лаборатории или приёмки')).toBeInTheDocument();
  });
});

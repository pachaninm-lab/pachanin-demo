import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformCommandCenterHub } from '@/components/v7r/PlatformCommandCenterHub';

describe('platform-v7 command center entry', () => {
  it('renders the execution entry with bank-boundary wording', () => {
    render(<PlatformCommandCenterHub />);

    expect(screen.getByTestId('platform-command-center-hero')).toBeInTheDocument();
    expect(screen.getByText('Центр исполнения сделки')).toBeInTheDocument();
    expect(screen.getByText('Рабочий контур сделки')).toBeInTheDocument();
    expect(screen.getByText('проверка выплаты')).toBeInTheDocument();
    expect(screen.getByText(/основание для банковской проверки выплаты/i)).toBeInTheDocument();
    expect(screen.getByText(/можно передавать банку только после закрытия условий/i)).toBeInTheDocument();
    expect(screen.getByText('передать основание банку')).toBeInTheDocument();
  });

  it('does not expose money-release or technical claims on the command center entry', () => {
    const { container } = render(<PlatformCommandCenterHub />);
    const text = container.textContent || '';

    expect(text).not.toMatch(/выпуск денег/i);
    expect(text).not.toMatch(/можно выпускать/i);
    expect(text).not.toMatch(/выпустить деньги/i);
    expect(text).not.toMatch(/платформа выпускает деньги/i);
    expect(text).not.toMatch(/деньги автоматически выпускаются/i);
    expect(text).not.toMatch(/production-ready/i);
    expect(text).not.toMatch(/fully live/i);
    expect(text).not.toMatch(/callback/i);
    expect(text).not.toMatch(/runtime/i);
  });
});

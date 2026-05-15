import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArbitratorShellPage from '@/app/platform-v7/arbitrator/page';

vi.mock('@/components/platform-v7/RoleExecutionSummary', () => ({
  RoleExecutionSummary: () => <div data-testid="role-execution-summary" />,
}));
vi.mock('@/components/platform-v7/JournalPreview', () => ({
  JournalPreview: () => <div data-testid="journal-preview" />,
}));
vi.mock('@/app/platform-v7r/arbitrator/page', () => ({
  default: () => <div data-testid="arbitrator-runtime" />,
}));

const source = readFileSync(new URL('../../app/platform-v7/arbitrator/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 arbitrator decision polish', () => {
  it('renders decision frame with evidence, amount, manual review and journal', () => {
    render(<ArbitratorShellPage />);

    expect(screen.getByText('Арбитр · спор → доказательства → решение')).toBeInTheDocument();
    expect(screen.getByText('Принять решение по спорной части на основании фактов')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Собрать доказательства/i })).toHaveAttribute('href', '/platform-v7/evidence-pack');
    expect(screen.getByText('Арбитр · рамка решения')).toBeInTheDocument();
    expect(screen.getByText('Решение арбитра создаёт основание для ручной проверки')).toBeInTheDocument();
    expect(screen.getByText(/ручной сверки основания оператором/i)).toBeInTheDocument();
    expect(screen.getByText('Сумма спора')).toBeInTheDocument();
    expect(screen.getByText('Доказательства')).toBeInTheDocument();
    expect(screen.getByText('Следующий шаг')).toBeInTheDocument();
    expect(screen.getByText('Журнал')).toBeInTheDocument();
    expect(screen.getByText(/акт, протокол, вес, фото и журнал должны быть видимы/i)).toBeInTheDocument();
  });

  it('keeps arbitrator source free from automatic money movement and overclaims', () => {
    expect(source).not.toMatch(/платформа выпускает деньги/i);
    expect(source).not.toMatch(/деньги автоматически выпускаются/i);
    expect(source).not.toMatch(/автоматически выплат/i);
    expect(source).not.toMatch(/банк автоматически/i);
    expect(source).not.toMatch(/основание для проверки/);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/callback/i);
  });
});

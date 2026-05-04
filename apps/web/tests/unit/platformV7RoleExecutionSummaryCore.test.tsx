import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';

const coreRoles = [
  ['seller', 'Продавец', 'коммерческий контур'],
  ['buyer', 'Покупатель', 'коммерческий контур'],
  ['logistics', 'Логистика', 'полевой контур'],
  ['driver', 'Водитель', 'полевой контур'],
  ['elevator', 'Элеватор', 'полевой контур'],
] as const;

describe('RoleExecutionSummary core role polish', () => {
  it.each(coreRoles)('renders the %s role execution summary with core questions', (role, title, mode) => {
    render(<RoleExecutionSummary role={role} />);

    expect(screen.getByTestId(`role-execution-summary-${role}`)).toBeInTheDocument();
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.getByText(mode)).toBeInTheDocument();
    expect(screen.getByText('controlled-pilot')).toBeInTheDocument();
    expect(screen.getByText('Что происходит сейчас')).toBeInTheDocument();
    expect(screen.getByText('Что заблокировано')).toBeInTheDocument();
    expect(screen.getByText('Где деньги')).toBeInTheDocument();
    expect(screen.getByText('Где документы')).toBeInTheDocument();
    expect(screen.getByText('Где груз / исполнение')).toBeInTheDocument();
    expect(screen.getByText('Кто следующий')).toBeInTheDocument();
  });

  it('keeps seller from seeing buyer credit line', () => {
    render(<RoleExecutionSummary role='seller' />);
    expect(screen.getByText(/кредит покупателя/i)).toBeInTheDocument();
    expect(screen.getByText(/кредитную линию покупателя/i)).toBeInTheDocument();
  });

  it('keeps logistics and driver away from money and bid data', () => {
    render(<RoleExecutionSummary role='logistics' />);
    expect(screen.getByText(/цена зерна, банковский резерв, кредит и закрытые ставки/i)).toBeInTheDocument();

    render(<RoleExecutionSummary role='driver' />);
    expect(screen.getByText(/деньги, ставки, банк, покупатель, кредит, чужие рейсы/i)).toBeInTheDocument();
  });

  it('keeps elevator focused on receiving facts and payout impact', () => {
    render(<RoleExecutionSummary role='elevator' />);
    expect(screen.getByText(/вес, качество, акт и отклонения/i)).toBeInTheDocument();
    expect(screen.getByText(/акт приёмки, акт расхождения и протокол качества/i)).toBeInTheDocument();
  });
});

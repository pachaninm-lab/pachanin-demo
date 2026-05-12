import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { P7MoneySafetyAuditStrip } from '@/components/platform-v7/P7MoneySafetyAuditStrip';
import { P7ExecutionActionsPanel } from '@/components/platform-v7/P7ExecutionActionsPanel';

const OLD_MONEY_AUDIT_COPY = [
  /Money safety audit/i,
  /E7 guard layer/i,
  /bank callback/i,
  /Data layer/i,
  /no live money movement/i,
  /Idempotency key/i,
];

const OLD_ACTION_PANEL_COPY = [
  /E4 · Action feedback core/i,
  /controlled-pilot\/manual/i,
  /toast/i,
  /rollback/i,
  /live ФГИС/i,
  /live банк/i,
  /Target не найден/i,
  /Журнал действий E4/i,
];

describe('platform-v7 operational panel copy boundary', () => {
  it('renders money safety audit as a bank-check surface, not a developer console', () => {
    const { container } = render(<P7MoneySafetyAuditStrip />);
    const text = container.textContent || '';

    expect(screen.getByText('Проверка денег перед запросом в банк')).toBeInTheDocument();
    expect(screen.getByText(/Это основание для проверки, а не платёжный механизм платформы/)).toBeInTheDocument();
    expect(screen.getByText('тестовый контур · без движения денег')).toBeInTheDocument();
    expect(screen.getAllByText('Ключ операции').length).toBeGreaterThan(0);

    for (const pattern of OLD_MONEY_AUDIT_COPY) {
      expect(text).not.toMatch(pattern);
    }
  });

  it('renders execution actions as user-facing deal actions, not action-feedback internals', () => {
    const { container } = render(
      <P7ExecutionActionsPanel
        title='Действия по исполнению сделки'
        subtitle='Оператор видит доступные шаги, причины остановки и журнал действий.'
        items={[]}
      />,
    );
    const text = container.textContent || '';

    expect(screen.getByText('Действия по сделке')).toBeInTheDocument();
    expect(screen.getByText(/Все действия ниже фиксируют состояние, журнал и возможность отката в пилотном контуре/)).toBeInTheDocument();
    expect(screen.getByText(/Они не заявляют боевое подключение к ФГИС, банку, ЭДО, СберКорус или УКЭП/)).toBeInTheDocument();
    expect(screen.getByText('Журнал действий')).toBeInTheDocument();

    for (const pattern of OLD_ACTION_PANEL_COPY) {
      expect(text).not.toMatch(pattern);
    }
  });
});

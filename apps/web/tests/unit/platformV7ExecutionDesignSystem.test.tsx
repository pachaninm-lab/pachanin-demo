import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  EXECUTION_ROLE_LABELS,
  EXECUTION_STATUS_TONES,
  ExecutionActionButton,
  ExecutionCanvas,
  ExecutionCardGrid,
  ExecutionKpiCard,
  ExecutionOperationalCard,
  ExecutionStatusBadge,
} from '@/components/platform-v7/ExecutionDesignSystem';
import {
  GRAIN_EXECUTION_ACTION_LABELS,
  GRAIN_EXECUTION_CARD_GRAMMAR,
  GRAIN_EXECUTION_COCKPIT_THEME,
  GRAIN_EXECUTION_MOBILE_VIEWPORTS,
  GRAIN_EXECUTION_ROLE_ORDER,
} from '@/lib/platform-v7/design/execution-cockpit';

describe('ExecutionDesignSystem', () => {
  it('defaults the execution canvas to light and keeps dark explicit', () => {
    const { rerender } = render(
      <ExecutionCanvas title='Контур исполнения' role='operator' testId='execution-canvas'>
        Рабочая область
      </ExecutionCanvas>,
    );

    expect(screen.getByTestId('execution-canvas')).toHaveAttribute('data-theme', 'light');
    expect(screen.getByText(EXECUTION_ROLE_LABELS.operator)).toBeInTheDocument();

    rerender(
      <ExecutionCanvas title='Контур исполнения' role='operator' theme='dark' testId='execution-canvas'>
        Рабочая область
      </ExecutionCanvas>,
    );

    expect(screen.getByTestId('execution-canvas')).toHaveAttribute('data-theme', 'dark');
  });

  it('defines the expected status tone vocabulary for execution work', () => {
    expect(GRAIN_EXECUTION_COCKPIT_THEME.defaultTheme).toBe('light');
    expect(GRAIN_EXECUTION_ROLE_ORDER).toContain('driver');
    expect(EXECUTION_STATUS_TONES.success.label).toBe('готово');
    expect(EXECUTION_STATUS_TONES.warning.label).toBe('ожидает');
    expect(EXECUTION_STATUS_TONES.danger.label).toBe('стоп');
    expect(EXECUTION_STATUS_TONES.info.label).toBe('проверка');
    expect(EXECUTION_STATUS_TONES.money.label).toBe('деньги');
  });

  it('keeps operational card grammar and mobile viewport gates explicit', () => {
    expect(GRAIN_EXECUTION_CARD_GRAMMAR).toEqual(['title', 'status', 'shortFact', 'blocker', 'nextStep', 'action']);
    expect(GRAIN_EXECUTION_ACTION_LABELS).toContain('Закрыть СДИЗ');
    expect(GRAIN_EXECUTION_ACTION_LABELS).toContain('Запросить подтверждение резерва');
    expect(GRAIN_EXECUTION_ACTION_LABELS).toContain('Передать основание банку');
    expect(GRAIN_EXECUTION_ACTION_LABELS).toContain('Зафиксировать вес');
    expect(GRAIN_EXECUTION_MOBILE_VIEWPORTS).toContainEqual({ width: 390, height: 844 });
    expect(GRAIN_EXECUTION_MOBILE_VIEWPORTS).toContainEqual({ width: 812, height: 375 });
  });

  it('renders status badges with stable tone attributes', () => {
    render(<ExecutionStatusBadge tone='warning'>ручная проверка</ExecutionStatusBadge>);

    const badge = screen.getByText('ручная проверка').closest('span');
    expect(badge).toHaveAttribute('data-tone', 'warning');
    expect(badge).toHaveAccessibleName(/ожидает/i);
  });

  it('renders the required operational card grammar', () => {
    render(
      <ExecutionOperationalCard
        title='Банковское основание'
        status='ожидает документы'
        statusTone='warning'
        shortFact='В резерве 9,65 млн ₽; к передаче банку 0 ₽'
        blocker='СДИЗ и ЭТрН не закрыты'
        cause='Нет закрытого документа приёмки'
        nextStep='Передать основание банку после закрытия пакета'
        action={{ label: 'Передать основание банку', href: '/platform-v7/bank/release-safety' }}
        testId='operation-card'
      />,
    );

    expect(screen.getByTestId('operation-card')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Банковское основание' })).toBeInTheDocument();
    expect(screen.getByText('Короткий факт')).toBeInTheDocument();
    expect(screen.getByText('В резерве 9,65 млн ₽; к передаче банку 0 ₽')).toBeInTheDocument();
    expect(screen.getByText('Блокер / причина')).toBeInTheDocument();
    expect(screen.getAllByText('СДИЗ и ЭТрН не закрыты').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Следующий шаг')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Передать основание банку/i })).toHaveAttribute('href', '/platform-v7/bank/release-safety');
  });

  it('renders concrete action buttons as buttons or links', () => {
    const onClick = vi.fn();
    const { rerender } = render(<ExecutionActionButton action={{ label: 'Зафиксировать вес', onClick }} />);

    screen.getByRole('button', { name: /Зафиксировать вес/i }).click();
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<ExecutionActionButton action={{ label: 'Прикрепить протокол', href: '/platform-v7/lab' }} />);
    expect(screen.getByRole('link', { name: /Прикрепить протокол/i })).toHaveAttribute('href', '/platform-v7/lab');
  });

  it('renders KPI and responsive grids without prescribing role content', () => {
    render(
      <ExecutionCardGrid min={180} testId='execution-grid'>
        <ExecutionKpiCard label='Документы' value='4/6' note='нужна проверка' tone='info' />
        <ExecutionKpiCard label='Под удержанием' value='624 тыс. ₽' note='спорная часть' tone='warning' />
      </ExecutionCardGrid>,
    );

    expect(screen.getByTestId('execution-grid')).toBeInTheDocument();
    expect(screen.getByText('Документы')).toBeInTheDocument();
    expect(screen.getByText('4/6')).toBeInTheDocument();
    expect(screen.getByText('Под удержанием')).toBeInTheDocument();
    expect(screen.getByText('624 тыс. ₽')).toBeInTheDocument();
  });
});

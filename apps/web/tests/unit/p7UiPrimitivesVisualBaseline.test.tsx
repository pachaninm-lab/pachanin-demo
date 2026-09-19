import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  P7Grid,
  P7LinkButton,
  P7MetricCard,
  P7Notice,
  P7PanelShell,
  P7StatusPill,
} from '@/components/platform-v7/P7UiPrimitives';

describe('platform-v7 ui primitives visual baseline', () => {
  it('renders polished panel, metrics, notice, pill and link button primitives', () => {
    render(
      <P7PanelShell>
        <P7StatusPill tone='green'>Готово к проверке</P7StatusPill>
        <P7Grid>
          <P7MetricCard title='Резерв' value='12,4 млн ₽' note='Сумма в тестовом контуре' tone='green' />
          <P7MetricCard title='Остановлено' value='2' note='Нужны документы' tone='red' />
        </P7Grid>
        <P7Notice title='Правило' tone='blue'>Платформа показывает основание, банк подтверждает проверку.</P7Notice>
        <P7LinkButton href='/platform-v7/bank' kind='primary'>Открыть банк</P7LinkButton>
      </P7PanelShell>,
    );

    expect(screen.getByText('Готово к проверке')).toBeInTheDocument();
    expect(screen.getByText('Резерв')).toBeInTheDocument();
    expect(screen.getByText('12,4 млн ₽')).toBeInTheDocument();
    expect(screen.getByText('Остановлено')).toBeInTheDocument();
    expect(screen.getByText('Правило')).toBeInTheDocument();
    expect(screen.getByText(/Платформа показывает основание/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть банк' })).toHaveAttribute('href', '/platform-v7/bank');
  });

  it('does not introduce technical or overclaiming copy through primitives', () => {
    const { container } = render(
      <P7PanelShell>
        <P7Notice title='Проверка' tone='amber'>Действие фиксируется в пилотном контуре.</P7Notice>
      </P7PanelShell>,
    );

    const text = container.textContent || '';
    expect(text).not.toMatch(/production-ready/i);
    expect(text).not.toMatch(/fully live/i);
    expect(text).not.toMatch(/callback/i);
    expect(text).not.toMatch(/runtime/i);
    expect(text).not.toMatch(/платформа выпускает деньги/i);
  });
});

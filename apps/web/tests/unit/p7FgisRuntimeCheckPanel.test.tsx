import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { P7FgisRuntimeCheckPanel } from '@/components/platform-v7/P7FgisRuntimeCheckPanel';

function unsafeCopyGuard(text: string) {
  expect(text).not.toMatch(/production-ready/i);
  expect(text).not.toMatch(/fully live/i);
  expect(text).not.toMatch(/fully integrated/i);
  expect(text).not.toMatch(/ФГИС подтвержд[ёе]н/i);
  expect(text).not.toMatch(/партия подтверждена/i);
  expect(text).not.toMatch(/СДИЗ подтвержд[ёе]н/i);
  expect(text).not.toMatch(/остаток подтвержд[ёе]н/i);
}

describe('P7FgisRuntimeCheckPanel', () => {
  it('creates a visible pending FGIS check request without external confirmation claims', () => {
    const { container } = render(<P7FgisRuntimeCheckPanel partyId='FGIS-PARTY-2403' actorRole='operator' />);

    expect(screen.getByTestId('p7-fgis-runtime-check-panel')).toHaveTextContent('запрос ещё не создан');
    expect(screen.getByText(/ФГИС-сверка пока не запрошена/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Запросить сверку ФГИС' }));

    expect(screen.getByTestId('p7-fgis-runtime-status')).toHaveTextContent('запрос создан');
    expect(screen.getByTestId('p7-fgis-runtime-status')).toHaveTextContent('запрос сверки ФГИС создан');
    expect(screen.getByTestId('p7-fgis-runtime-status')).toHaveTextContent('ждёт внешнее событие ФГИС');
    expect(screen.getByTestId('p7-fgis-runtime-status')).toHaveTextContent('не считает партию, остаток или СДИЗ подтверждёнными');
    expect(screen.getByTestId('p7-fgis-runtime-status')).toHaveTextContent('ожидается подтверждение ФГИС');
    expect(screen.getByText('fgis_check_requested')).toBeInTheDocument();
    expect(screen.getByText(/Ожидается подтверждение внешней системы: fgis/)).toBeInTheDocument();
    expect(screen.getByText(/Не подтверждает ФГИС, партию, остаток или СДИЗ/)).toBeInTheDocument();
    unsafeCopyGuard(container.textContent || '');
  });

  it('shows blocked state for a role that cannot request FGIS check', () => {
    const { container } = render(<P7FgisRuntimeCheckPanel partyId='FGIS-PARTY-2403' actorRole='driver' />);

    fireEvent.click(screen.getByRole('button', { name: 'Запросить сверку ФГИС' }));

    expect(screen.getByTestId('p7-fgis-runtime-status')).toHaveTextContent('действие остановлено');
    expect(screen.getByTestId('p7-fgis-runtime-status')).toHaveTextContent('сверка ФГИС не создана');
    expect(screen.getByText('У роли нет права выполнить это действие.')).toBeInTheDocument();
    expect(screen.queryByText('fgis_check_requested')).not.toBeInTheDocument();
    unsafeCopyGuard(container.textContent || '');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QualityDeltaBars, qualityIndicatorState } from '@/components/platform-v7/QualityDeltaBars';
import { WeighStationPanel, formatTons } from '@/components/platform-v7/WeighStationPanel';

const INDICATORS = [
  { label: 'Влажность', value: 13.1, unit: '%', max: 14, limitLabel: 'допуск до 14%' },
  { label: 'Клейковина', value: 23, unit: '%', min: 21, limitLabel: 'минимум 21%' },
  { label: 'Сорная примесь', value: 2.4, unit: '%', max: 2, limitLabel: 'допуск до 2%' },
];

describe('QualityDeltaBars', () => {
  it('duplicates every indicator state as text', () => {
    render(<QualityDeltaBars title='Протокол качества · показатели' indicators={INDICATORS} />);

    expect(screen.getByTestId('quality-delta-bars')).toBeInTheDocument();
    expect(screen.getAllByText('в допуске')).toHaveLength(2);
    expect(screen.getAllByText('вне допуска')).toHaveLength(1);
    expect(screen.getByText('допуск до 2%')).toBeInTheDocument();
  });

  it('flags out-of-tolerance values without hiding the fact', () => {
    expect(qualityIndicatorState({ label: 'Сорная примесь', value: 2.4, unit: '%', max: 2, limitLabel: '' })).toBe('stop');
    expect(qualityIndicatorState({ label: 'Влажность', value: 13.1, unit: '%', max: 14, limitLabel: '' })).toBe('ok');
    expect(qualityIndicatorState({ label: 'Клейковина', value: 19, unit: '%', min: 21, limitLabel: '' })).toBe('stop');
  });
});

describe('WeighStationPanel', () => {
  it('shows declared, accepted and red deviation beyond tolerance with text status', () => {
    render(<WeighStationPanel tripId='TRIP-2403-001' declaredTons={600} acceptedTons={598.8} toleranceTons={0.5} />);

    expect(screen.getByTestId('weigh-station-panel')).toBeInTheDocument();
    expect(screen.getByText('600 т')).toBeInTheDocument();
    expect(screen.getByText('598,8 т')).toBeInTheDocument();
    expect(screen.getByText('-1,2 т')).toBeInTheDocument();
    expect(screen.getByText('расхождение сверх допуска — нужен акт расхождения')).toBeInTheDocument();
  });

  it('reports in-tolerance deviation honestly', () => {
    render(<WeighStationPanel tripId='TRIP-X' declaredTons={100} acceptedTons={99.8} toleranceTons={0.5} />);

    expect(screen.getByText('в пределах допуска')).toBeInTheDocument();
  });

  it('formats tons in ru-RU', () => {
    expect(formatTons(598.8)).toBe('598,8 т');
    expect(formatTons(600)).toBe('600 т');
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DriverMissionRouteCard } from '@/components/platform-v7/DriverMissionRouteCard';

const CHECKLIST = [
  { label: 'Фото погрузки', done: true },
  { label: 'Пломба зафиксирована', done: true },
  { label: 'Фото выгрузки', done: false },
];

describe('DriverMissionRouteCard', () => {
  it('renders trip, route pulse progress and photo checklist with text states', () => {
    render(
      <DriverMissionRouteCard
        tripId='TRIP-2403-001'
        route='Тамбовская область → Элеватор ВРЖ-08'
        progressPercent={62}
        stageLabel='в пути'
        photoChecklist={CHECKLIST}
      />,
    );

    expect(screen.getByTestId('driver-mission-route-card')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '62');
    expect(screen.getByText('2 из 3')).toBeInTheDocument();
    expect(screen.getAllByText('готово')).toHaveLength(2);
    expect(screen.getAllByText('ожидается')).toHaveLength(1);
  });

  it('does not claim money control from telemetry', () => {
    render(
      <DriverMissionRouteCard tripId='TRIP-X' route='А → Б' progressPercent={10} stageLabel='в пути' photoChecklist={[]} />,
    );

    expect(screen.getByText(/не управляет деньгами/)).toBeInTheDocument();
  });

  it('clamps progress into 0..100', () => {
    render(
      <DriverMissionRouteCard tripId='TRIP-Y' route='А → Б' progressPercent={140} stageLabel='в пути' photoChecklist={[]} />,
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

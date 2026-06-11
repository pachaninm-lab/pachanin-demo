import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import LogisticsPage from '@/app/platform-v7/logistics/page';

describe('PlatformV7 logistics route', () => {
  it('renders the logistics cockpit hero with the transport-only boundary', async () => {
    render(await LogisticsPage());

    expect(screen.getByText('Логистика · рейс → водитель → ЭТрН → приёмка')).toBeInTheDocument();
    expect(screen.getByText(/Довести рейс до приёмки и закрыть транспортные документы/)).toBeInTheDocument();
    expect(screen.getByText(/Коммерческие условия и банковские действия скрыты/)).toBeInTheDocument();
  });

  it('renders trip, arrival and incident metrics', async () => {
    render(await LogisticsPage());

    expect(screen.getAllByText('В пути').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Прибыли/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Инциденты/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TRIP-2403-001/).length).toBeGreaterThan(0);
  });

  it('keeps the weight-deviation incident deal visible', async () => {
    render(await LogisticsPage());

    expect(screen.getAllByText(/DL-9102/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/отклонение веса/i).length).toBeGreaterThan(0);
  });

  it('frames external transport contours as pre-integration', async () => {
    const { container } = render(await LogisticsPage());
    const html = container.textContent ?? '';

    expect(html).toContain('в предынтеграционном контуре');
    expect(html).not.toMatch(/live gps|боевой перевозчик подключ|fully live|production-ready/i);
  });

  it('keeps driver money isolation: no bank or payout surfaces', async () => {
    const { container } = render(await LogisticsPage());
    const html = container.textContent ?? '';

    expect(html).not.toMatch(/выпуск денег|платформа гарантирует оплату|деньги переведены/i);
  });
});

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CockpitHero,
  DonutGauge,
  PremiumStatCard,
  ProcessStepper,
  StatusPill,
  TrendSparkline,
  PremiumCtaButton,
} from '@/components/platform-v7/premium';

describe('platform-v7 premium cockpit primitives', () => {
  it('renders a KPI stat card with value, label and tone', () => {
    const { container } = render(<PremiumStatCard glyph='bag' value='12' label='Активных закупок' tone='info' />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Активных закупок')).toBeInTheDocument();
    expect(container.querySelector('.pc-prem-kpi[data-tone="info"]')).not.toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders a donut gauge with accessible percentage and caption', () => {
    render(<DonutGauge value={78} sublabel='готовность' caption='Уверенность к поставке' />);
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('Уверенность к поставке')).toBeInTheDocument();
    expect(screen.getByLabelText('78%')).toBeInTheDocument();
  });

  it('clamps donut gauge values into 0..100', () => {
    render(<DonutGauge value={140} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders a trend sparkline with a delta label', () => {
    render(<TrendSparkline points={[1, 3, 2, 5, 4, 6]} deltaLabel='+340 ₽/т' caption='Тренд белка' />);
    expect(screen.getByText('+340 ₽/т')).toBeInTheDocument();
    expect(screen.getByText('Тренд белка')).toBeInTheDocument();
    expect(screen.getByLabelText('Тренд')).toBeInTheDocument();
  });

  it('renders a status pill with tone', () => {
    const { container } = render(<StatusPill tone='warning'>Повышенный</StatusPill>);
    expect(screen.getByText('Повышенный')).toBeInTheDocument();
    expect(container.querySelector('.pc-prem-pill[data-tone="warning"]')).not.toBeNull();
  });

  it('renders a process stepper marking done/current states', () => {
    const { container } = render(
      <ProcessStepper
        steps={[
          { label: 'Сделка', state: 'done' },
          { label: 'Партия', state: 'done' },
          { label: 'Приёмка', state: 'current' },
          { label: 'Документы', state: 'upcoming' },
        ]}
      />,
    );
    expect(container.querySelectorAll('.pc-prem-step[data-state="done"]').length).toBe(2);
    expect(container.querySelector('.pc-prem-step[data-state="current"]')).not.toBeNull();
    expect(screen.getByText('Приёмка')).toBeInTheDocument();
  });

  it('renders a hero with accent headline and a primary CTA link', () => {
    const { container } = render(
      <CockpitHero eyebrow='Покупатель' title='Ваши закупки' accent='под контролем' lead='Контур закупки.'>
        <PremiumCtaButton href='/platform-v7/buyer' glyph='shield-check'>
          Подтвердить приёмку
        </PremiumCtaButton>
      </CockpitHero>,
    );
    expect(screen.getByText('под контролем')).toBeInTheDocument();
    expect(container.querySelector('.pc-prem-hero__accent')).not.toBeNull();
    const cta = screen.getByRole('link', { name: /Подтвердить приёмку/ });
    expect(cta).toHaveAttribute('href', '/platform-v7/buyer');
  });
});

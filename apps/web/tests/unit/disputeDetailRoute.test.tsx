import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7DisputeDetailPage, { generateMetadata } from '@/app/platform-v7/disputes/[id]/page';
import { PLATFORM_V7_DISPUTES_ROUTE } from '@/lib/platform-v7/routes';

describe('PlatformV7DisputeDetailPage', () => {
  it('generates dispute metadata from the domain selector', () => {
    const metadata = generateMetadata({ params: { id: 'DK-2024-89' } });

    expect(metadata.title).toBe('Спор DK-2024-89');
    expect(String(metadata.description)).toContain('удержание, доказательства, SLA');
  });

  it('renders dispute detail hold calculator link through the dispute route constant', () => {
    render(<PlatformV7DisputeDetailPage params={{ id: 'DK-2024-89' }} />);

    expect(screen.getByText('Отдельный расчёт удержания')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть калькулятор удержания' })).toHaveAttribute(
      'href',
      `${PLATFORM_V7_DISPUTES_ROUTE}/DK-2024-89/hold`,
    );
  });

  it('keeps evidence/dispute wording inside pilot boundaries', () => {
    render(<PlatformV7DisputeDetailPage params={{ id: 'DK-2024-89' }} />);

    expect(screen.getByText(/Объектный пакет для пилотного контура/)).toBeInTheDocument();
    expect(screen.getByText(/Живая загрузка файлов, КЭП и боевой архив требуют внешних подключений/)).toBeInTheDocument();
    expect(screen.queryByText(/production-ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/live arbitration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/legally final/i)).not.toBeInTheDocument();
  });
});

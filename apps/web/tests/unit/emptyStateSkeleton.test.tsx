import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/platform-v7/EmptyState';
import { Skeleton, SkeletonLines } from '@/components/platform-v7/Skeleton';

describe('EmptyState', () => {
  it('renders title, description and optional action', () => {
    render(
      <EmptyState
        title='Сделок пока нет'
        description='Когда появятся сделки, они будут здесь.'
        action={<a href='/platform-v7/deals'>Открыть сделки</a>}
      />,
    );

    expect(screen.getByTestId('platform-v7-empty-state')).toHaveAttribute('role', 'status');
    expect(screen.getByText('Сделок пока нет')).toBeInTheDocument();
    expect(screen.getByText(/Когда появятся сделки/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть сделки' })).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('renders a placeholder and a multi-line loading block', () => {
    const { container } = render(
      <>
        <Skeleton data-testid='sk' width={120} height={20} />
        <SkeletonLines lines={4} />
      </>,
    );

    expect(screen.getByTestId('sk')).toHaveClass('p7-skeleton');
    expect(screen.getByRole('status', { name: 'Загрузка' })).toBeInTheDocument();
    expect(container.querySelectorAll('.p7-skeleton')).toHaveLength(5);
  });
});

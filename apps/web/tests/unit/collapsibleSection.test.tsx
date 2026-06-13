import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders header, summary and toggles open state', () => {
    render(
      <CollapsibleSection title='Контур доступа' summary='3 шага' data-testid='gates'>
        <p>Сначала выбирается роль</p>
      </CollapsibleSection>,
    );

    const toggle = screen.getByRole('button', { name: /Контур доступа/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('3 шага')).toBeInTheDocument();
    expect(screen.getByText('Скрыть')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Показать')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps content in the DOM for SSR/accessibility even when collapsed', () => {
    render(
      <CollapsibleSection title='Детали' defaultOpen={false}>
        <p>Скрытая деталь рейса</p>
      </CollapsibleSection>,
    );

    expect(screen.getByRole('button', { name: /Детали/ })).toHaveAttribute('aria-expanded', 'false');
    // content remains queryable in DOM (progressive disclosure, not unmount)
    expect(screen.getByText('Скрытая деталь рейса')).toBeInTheDocument();
  });
});

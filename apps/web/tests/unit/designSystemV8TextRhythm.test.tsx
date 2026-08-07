import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Prose, TextStack } from '@pc/design-system-v8';

describe('Design System v8 text rhythm', () => {
  it('renders a semantic text stack with an explicit spacing contract', () => {
    render(
      <TextStack data-testid='text-stack' spacing='paragraph' align='center'>
        <h2>Заголовок</h2>
        <p>Первый абзац</p>
        <p>Второй абзац</p>
      </TextStack>,
    );

    const stack = screen.getByTestId('text-stack');
    expect(stack).toHaveAttribute('data-text-stack', 'paragraph');
    expect(screen.getByRole('heading', { level: 2, name: 'Заголовок' })).toBeInTheDocument();
    expect(screen.getByText('Первый абзац')).toBeInTheDocument();
    expect(screen.getByText('Второй абзац')).toBeInTheDocument();
  });

  it('keeps long-form content inside the governed prose boundary', () => {
    render(
      <Prose data-testid='prose'>
        <h2>Условия сделки</h2>
        <p>Первый смысловой блок.</p>
        <p>Следующий смысловой блок.</p>
        <ul><li>Пункт один</li><li>Пункт два</li></ul>
      </Prose>,
    );

    expect(screen.getByTestId('prose')).toHaveAttribute('data-prose', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

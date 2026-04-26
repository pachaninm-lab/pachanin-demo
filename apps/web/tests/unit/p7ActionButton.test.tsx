import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { P7ActionButton } from '@/components/platform-v7/P7ActionButton';

describe('P7ActionButton', () => {
  it('renders idle label', () => {
    render(<P7ActionButton>Run action</P7ActionButton>);
    expect(screen.getByRole('button', { name: 'Run action' })).toBeInTheDocument();
  });

  it('renders loading label and busy state', () => {
    render(<P7ActionButton state='loading' loadingLabel='Working'>Run action</P7ActionButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(screen.getByText('Working')).toBeInTheDocument();
  });

  it('renders success label and color', () => {
    render(<P7ActionButton state='success' successLabel='Done'>Run action</P7ActionButton>);
    const button = screen.getByRole('button', { name: 'Done' });
    expect(button).toHaveStyle({ background: '#027A48' });
  });

  it('renders error label and color', () => {
    render(<P7ActionButton state='error' errorLabel='Failed'>Run action</P7ActionButton>);
    const button = screen.getByRole('button', { name: 'Failed' });
    expect(button).toHaveStyle({ background: '#B42318' });
  });

  it('keeps native disabled state', () => {
    render(<P7ActionButton disabled>Run action</P7ActionButton>);
    expect(screen.getByRole('button', { name: 'Run action' })).toBeDisabled();
  });
});

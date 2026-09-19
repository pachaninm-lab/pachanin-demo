import React from 'react';
import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GrainActionFeedbackPanel } from '@/components/platform-v7/GrainActionFeedbackPanel';

it('renders separated platform-v7 feedback panel sections', () => {
  render(<GrainActionFeedbackPanel />);

  expect(screen.getByText('Действия по сделке')).toBeInTheDocument();
  expect(screen.getByText('Связанные обращения')).toBeInTheDocument();
  expect(screen.getByText('Что произойдёт после нажатия')).toBeInTheDocument();
});
